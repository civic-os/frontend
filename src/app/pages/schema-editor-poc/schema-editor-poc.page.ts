/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Component, inject, signal, computed, effect, viewChild, ElementRef, OnDestroy, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { ThemeService } from '../../services/theme.service';
import { SchemaEntityTable, SchemaEntityProperty } from '../../interfaces/entity';
import { forkJoin, take } from 'rxjs';
import { SchemaInspectorPanelComponent } from '../../components/schema-inspector-panel/schema-inspector-panel.component';

/**
 * Proof of Concept page for the interactive Schema Editor using JointJS.
 *
 * This POC validates:
 * - JointJS rendering performance with database schema
 * - Entity boxes with draggable interaction
 * - Relationship visualization (FK and M:M)
 * - Click interaction for entity selection
 * - Theme integration (dark/light mode)
 *
 * If successful, this will be expanded into the full Schema Editor (Phase 1).
 */
@Component({
  selector: 'app-schema-editor-poc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SchemaInspectorPanelComponent],
  templateUrl: './schema-editor-poc.page.html',
  styleUrl: './schema-editor-poc.page.css'
})
export class SchemaEditorPocPage implements OnDestroy {
  private schemaService = inject(SchemaService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  // ViewChild reference to canvas container
  canvasContainer = viewChild<ElementRef<HTMLDivElement>>('canvasContainer');

  // Theme observer for dynamic color updates
  private themeObserver?: MutationObserver;

  // Reactive state using signals
  loading = signal(true);
  error = signal<string | null>(null);
  entities = signal<SchemaEntityTable[]>([]);
  properties = signal<SchemaEntityProperty[]>([]);
  junctionTables = signal<Set<string>>(new Set());
  selectedEntity = signal<SchemaEntityTable | null>(null);
  showInstructions = signal(true);
  editMode = signal(false); // Future: enable entity dragging when true

  // Metadata system tables that may be referenced via FK
  private readonly METADATA_SYSTEM_TABLES = [
    'files',
    'civic_os_users'
  ];

  // Hardcoded metadata entities for diagram display (not in metadata.entities table)
  private readonly METADATA_ENTITIES: SchemaEntityTable[] = [
    {
      table_name: 'files',
      display_name: 'Files',
      description: 'File storage system table',
      sort_order: 900,
      search_fields: null,
      show_map: false,
      map_property_name: null,
      insert: false,
      select: true,
      update: false,
      delete: false
    },
    {
      table_name: 'civic_os_users',
      display_name: 'Users',
      description: 'User accounts',
      sort_order: 901,
      search_fields: null,
      show_map: false,
      map_property_name: null,
      insert: false,
      select: true,
      update: false,
      delete: false
    }
  ];

  // Computed signals
  allEntities = computed(() => {
    return [...this.entities(), ...this.METADATA_ENTITIES];
  });
  entityCount = computed(() => this.allEntities().length);
  visibleEntities = computed(() => {
    const all = this.allEntities();
    const junctions = this.junctionTables();
    return all.filter(e => !junctions.has(e.table_name));
  });

  // JointJS instances (will be initialized in effect)
  private graph: any;
  private paper: any;

  // Panning state
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private hasPanned = false; // Track if actual panning occurred

  // Track previous selection state for panning
  private previouslySelected: SchemaEntityTable | null = null;

  constructor() {
    // Fetch schema data on initialization
    this.loadSchemaData();

    // Effect: Initialize JointJS canvas when container is available and data is loaded
    effect(async () => {
      const container = this.canvasContainer()?.nativeElement;
      const isLoading = this.loading();
      const hasEntities = this.entities().length > 0;

      if (container && !isLoading && hasEntities && isPlatformBrowser(this.platformId)) {
        await this.initializeCanvas(container);
      }
    });

    // Effect: Pan canvas when inspector opens/closes
    effect(() => {
      const selected = this.selectedEntity();

      // Only pan if paper is initialized
      if (!this.paper) {
        this.previouslySelected = selected;
        return;
      }

      // Detect state transitions
      const wasOpen = this.previouslySelected !== null;
      const isOpen = selected !== null;

      // Only pan on state transitions (not on initial load)
      if (wasOpen !== isOpen) {
        const panAmount = 200; // Half the inspector width (400px / 2)
        const currentTranslate = this.paper.translate();

        if (isOpen) {
          // Inspector opening - pan left
          this.paper.translate(currentTranslate.tx - panAmount, currentTranslate.ty);
          console.log('[SchemaEditorPocPage] Panned canvas left by 200px (inspector opened)');
        } else {
          // Inspector closing - pan right
          this.paper.translate(currentTranslate.tx + panAmount, currentTranslate.ty);
          console.log('[SchemaEditorPocPage] Panned canvas right by 200px (inspector closed)');
        }
      }

      // Update previous state
      this.previouslySelected = selected;
    });
  }

  ngOnDestroy(): void {
    // Clean up JointJS paper to prevent memory leaks
    if (this.paper) {
      this.paper.remove();
    }
    // Clean up theme observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

  /**
   * Fetches schema entities, properties, and junction tables
   */
  private loadSchemaData(): void {
    console.log('[SchemaEditorPocPage] Loading schema data...');

    forkJoin({
      entities: this.schemaService.getEntities().pipe(take(1)),
      properties: this.schemaService.getProperties().pipe(take(1)),
      junctionTables: this.schemaService.getDetectedJunctionTables().pipe(take(1))
    }).subscribe({
      next: ({ entities, properties, junctionTables }) => {
        console.log('[SchemaEditorPocPage] Schema data loaded successfully');
        console.log('[SchemaEditorPocPage] Entities:', entities.length);
        console.log('[SchemaEditorPocPage] Properties:', properties.length);
        console.log('[SchemaEditorPocPage] Junction tables:', junctionTables.size);

        this.entities.set(entities);
        this.properties.set(properties);
        this.junctionTables.set(junctionTables);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[SchemaEditorPocPage] Failed to load schema data:', err);
        this.error.set('Failed to load schema data. Check console for details.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Initializes the JointJS canvas with entity boxes and relationships
   */
  private async initializeCanvas(container: HTMLElement): Promise<void> {
    try {
      // Dynamically import JointJS to enable lazy loading
      const { dia, shapes } = await import('@joint/core');

      console.log('[SchemaEditorPocPage] Initializing JointJS canvas...');
      console.log('[SchemaEditorPocPage] Entities:', this.visibleEntities().length);
      console.log('[SchemaEditorPocPage] Properties:', this.properties().length);

      // Initialize graph and paper
      this.graph = new dia.Graph({}, { cellNamespace: shapes });

      this.paper = new dia.Paper({
        el: container,
        model: this.graph,
        width: '100%',
        height: '100%',
        gridSize: 10,
        drawGrid: {
          name: 'dot',
          args: {
            color: 'rgba(128, 128, 128, 0.2)'
          }
        },
        background: {
          color: 'var(--base-200)'
        },
        // Disable element dragging when not in edit mode
        interactive: (cellView: any) => {
          // Only allow interaction with elements if editMode is true
          if (cellView.model.isElement()) {
            return this.editMode();
          }
          // Always allow interaction with links
          return true;
        },
        cellViewNamespace: shapes
      });

      // Render entities
      this.renderEntities(shapes);

      // Render relationships
      this.renderRelationships(shapes);

      // Set up event listeners
      this.setupEventListeners();

      // Set up theme watcher for dynamic color updates
      this.setupThemeWatcher();

      // Auto-arrange on initial load (includes zoom to fit)
      await this.autoArrange();

      console.log('[SchemaEditorPocPage] Canvas initialized successfully');
    } catch (err) {
      console.error('[SchemaEditorPocPage] Failed to initialize canvas:', err);
      this.error.set('Failed to initialize JointJS. Check console for details.');
    }
  }

  /**
   * Gets actual computed color values from CSS variables
   * DaisyUI 5 uses OKLCH format with --color-* variable names
   */
  private getThemeColors(): { base100: string; baseContent: string; primary: string; base200: string } {
    if (typeof window === 'undefined') {
      // SSR fallback colors in OKLCH format
      return {
        base100: 'oklch(100% 0 0)',
        baseContent: 'oklch(0% 0 0)',
        primary: 'oklch(49.12% 0.3096 275.75)',
        base200: 'oklch(95% 0 0)'
      };
    }

    const style = getComputedStyle(document.documentElement);

    // DaisyUI 5 variable names (changed from --b1, --bc, --p, --b2 in v4)
    const base100 = style.getPropertyValue('--color-base-100').trim();
    const baseContent = style.getPropertyValue('--color-base-content').trim();
    const primary = style.getPropertyValue('--color-primary').trim();
    const base200 = style.getPropertyValue('--color-base-200').trim();

    // DaisyUI 5 uses OKLCH format, values are already complete (e.g., "oklch(100% 0 0)")
    // No conversion needed - return as-is with fallbacks
    return {
      base100: base100 || 'oklch(100% 0 0)',
      baseContent: baseContent || 'oklch(0% 0 0)',
      primary: primary || 'oklch(49.12% 0.3096 275.75)',
      base200: base200 || 'oklch(95% 0 0)'
    };
  }

  /**
   * Renders entity boxes on the canvas
   */
  private renderEntities(shapes: any): void {
    const entities = this.visibleEntities();
    const gridColumns = Math.ceil(Math.sqrt(entities.length));
    const cellWidth = 250;
    const cellHeight = 100; // Reduced height since we're showing less info
    const padding = 50;

    // Get actual theme colors
    const colors = this.getThemeColors();

    entities.forEach((entity, index) => {
      const row = Math.floor(index / gridColumns);
      const col = index % gridColumns;
      const x = col * (cellWidth + padding) + padding;
      const y = row * (cellHeight + padding) + padding;

      // Check if this is a metadata system table
      const isMetadataTable = this.METADATA_SYSTEM_TABLES.includes(entity.table_name);

      // Truncate description if too long
      const description = entity.description || 'No description';
      const maxDescLength = 40;
      const truncatedDesc = description.length > maxDescLength
        ? description.substring(0, maxDescLength) + '...'
        : description;

      const entityElement = new shapes.standard.Rectangle({
        position: { x, y },
        size: { width: cellWidth, height: cellHeight },
        attrs: {
          body: {
            fill: colors.base100,
            stroke: colors.baseContent,
            strokeWidth: 2,
            rx: 8,
            ry: 8,
            // Add title attribute for tooltip with full description
            title: entity.description || 'No description'
          },
          label: {
            text: entity.display_name + '\n' + truncatedDesc,
            fill: colors.baseContent,
            fontSize: 14,
            fontWeight: 'bold',
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            // Line height to space out the two lines
            lineHeight: 1.4
          }
        },
        markup: [
          {
            tagName: 'rect',
            selector: 'body'
          },
          {
            tagName: 'text',
            selector: 'nameLabel'
          },
          {
            tagName: 'text',
            selector: 'descLabel'
          }
        ]
      });

      // Apply styling based on whether it's a metadata table
      entityElement.attr({
        body: {
          fill: isMetadataTable ? colors.base200 : colors.base100,
          stroke: colors.baseContent,
          strokeWidth: 2,
          strokeDasharray: isMetadataTable ? '5, 5' : 'none',
          opacity: isMetadataTable ? 0.8 : 1,
          rx: 8,
          ry: 8
        },
        nameLabel: {
          text: entity.display_name,
          fill: colors.baseContent,
          fontSize: 16,
          fontWeight: 'bold',
          textAnchor: 'middle',
          refX: '50%',
          refY: 25
        },
        descLabel: {
          text: truncatedDesc,
          fill: colors.baseContent,
          fontSize: 12,
          fontWeight: 'normal',
          fontStyle: entity.description ? 'normal' : 'italic',
          opacity: 0.7,
          textAnchor: 'middle',
          refX: '50%',
          refY: 55
        }
      });

      // Store entity metadata for later retrieval
      entityElement.set('entityName', entity.table_name);
      entityElement.set('entityData', entity);

      entityElement.addTo(this.graph);
    });

    console.log(`[SchemaEditorPocPage] Rendered ${entities.length} entities with name + description`);
  }

  /**
   * Renders relationship lines between entities
   */
  private renderRelationships(shapes: any): void {
    const properties = this.properties();
    const junctionTables = this.junctionTables();
    const colors = this.getThemeColors();
    let foreignKeyCount = 0;
    let manyToManyCount = 0;

    // Render foreign key relationships
    properties.forEach(prop => {
      if (prop.join_table && !junctionTables.has(prop.table_name)) {
        const sourceElement = this.findElementByTableName(prop.table_name);
        const targetElement = this.findElementByTableName(prop.join_table);

        if (sourceElement && targetElement) {
          const link = new shapes.standard.Link({
            source: {
              id: sourceElement.id,
              anchor: { name: 'perpendicular' }
            },
            target: {
              id: targetElement.id,
              anchor: { name: 'perpendicular' }
            },
            router: { name: 'metro' },
            connector: { name: 'rounded', args: { radius: 10 } },
            attrs: {
              line: {
                stroke: colors.baseContent,
                strokeWidth: 2,
                targetMarker: {
                  type: 'path',
                  d: 'M 10 -5 0 0 10 5 z',
                  fill: colors.baseContent
                }
              }
            }
          });

          link.set('relationshipType', 'foreignKey');
          link.set('columnName', prop.column_name);
          link.addTo(this.graph);
          foreignKeyCount++;
        }
      }
    });

    // Render many-to-many relationships (via junction tables)
    junctionTables.forEach(junctionTableName => {
      // Find all foreign keys from this junction table
      const junctionFKs = properties.filter(prop =>
        prop.table_name === junctionTableName && prop.join_table
      );

      // A valid junction table should have exactly 2 foreign keys
      if (junctionFKs.length === 2) {
        const sourceTable = junctionFKs[0].join_table;
        const targetTable = junctionFKs[1].join_table;

        if (sourceTable && targetTable) {
          const sourceElement = this.findElementByTableName(sourceTable);
          const targetElement = this.findElementByTableName(targetTable);

          if (sourceElement && targetElement) {
            // Create M:M link with double-ended arrows (solid line)
            const link = new shapes.standard.Link({
              source: {
                id: sourceElement.id,
                anchor: { name: 'perpendicular' }
              },
              target: {
                id: targetElement.id,
                anchor: { name: 'perpendicular' }
              },
              router: { name: 'metro' },
              connector: { name: 'rounded', args: { radius: 10 } },
              attrs: {
                line: {
                  stroke: colors.baseContent,
                  strokeWidth: 2,
                  sourceMarker: {
                    type: 'path',
                    d: 'M 10 -5 0 0 10 5 z', // Arrow pointing toward source
                    fill: colors.baseContent
                  },
                  targetMarker: {
                    type: 'path',
                    d: 'M 10 -5 0 0 10 5 z', // Arrow pointing toward target
                    fill: colors.baseContent
                  }
                }
              }
            });

            link.set('relationshipType', 'manyToMany');
            link.set('junctionTable', junctionTableName);
            link.addTo(this.graph);
            manyToManyCount++;
          }
        }
      }
    });

    console.log(`[SchemaEditorPocPage] Rendered ${foreignKeyCount} FK relationships`);
    console.log(`[SchemaEditorPocPage] Rendered ${manyToManyCount} M:M relationships`);
  }

  /**
   * Finds a JointJS element by table name
   */
  private findElementByTableName(tableName: string): any {
    return this.graph.getElements().find((el: any) => el.get('entityName') === tableName);
  }

  /**
   * Sets up MutationObserver to watch for theme changes
   */
  private setupThemeWatcher(): void {
    if (typeof window === 'undefined') return;

    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          // Theme changed, re-render with new colors
          console.log('[SchemaEditorPocPage] Theme changed, updating colors...');
          requestAnimationFrame(() => {
            this.updateCanvasColors();
          });
        }
      });
    });

    // Observe the html element for data-theme attribute changes
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Updates canvas colors when theme changes
   */
  private updateCanvasColors(): void {
    if (!this.graph) return;

    const colors = this.getThemeColors();
    console.log('[SchemaEditorPocPage] Applying new colors:', colors);

    // Update all entity boxes
    this.graph.getElements().forEach((element: any) => {
      const entityData = element.get('entityData');
      const isMetadataTable = entityData && this.METADATA_SYSTEM_TABLES.includes(entityData.table_name);

      // Apply different styling for metadata tables
      element.attr('body/fill', isMetadataTable ? colors.base200 : colors.base100);
      element.attr('body/stroke', colors.baseContent);
      element.attr('body/strokeDasharray', isMetadataTable ? '5, 5' : 'none');
      element.attr('body/opacity', isMetadataTable ? 0.8 : 1);

      // Update both name and description labels
      element.attr('nameLabel/fill', colors.baseContent);
      element.attr('descLabel/fill', colors.baseContent);
    });

    // Update all relationship links
    this.graph.getLinks().forEach((link: any) => {
      link.attr('line/stroke', colors.baseContent);
      link.attr('line/targetMarker/fill', colors.baseContent);
    });

    // Update paper background
    if (this.paper) {
      this.paper.drawBackground({ color: colors.base200 });
    }
  }

  /**
   * Sets up event listeners for click and drag interactions
   */
  private setupEventListeners(): void {
    // Click to select entity (only if not panning)
    this.paper.on('cell:pointerclick', (cellView: any) => {
      // Don't select if we just finished panning
      if (this.hasPanned) {
        return;
      }

      const cell = cellView.model;
      if (cell.isElement()) {
        const entityData = cell.get('entityData');
        this.selectedEntity.set(entityData);
        console.log('[SchemaEditorPocPage] Selected entity:', entityData.table_name);

        // Highlight selected entity
        this.highlightSelectedEntity(cell);
      }
    });

    // Drag end to log new position (only used when editMode is true)
    this.paper.on('cell:pointerup', (cellView: any) => {
      if (this.editMode()) {
        const cell = cellView.model;
        if (cell.isElement()) {
          const position = cell.position();
          const entityName = cell.get('entityName');
          console.log(`[SchemaEditorPocPage] Entity "${entityName}" moved to:`, position);
        }
      }
    });

    // Click on blank paper to deselect
    this.paper.on('blank:pointerclick', () => {
      this.selectedEntity.set(null);
      this.clearHighlights();
      console.log('[SchemaEditorPocPage] Deselected entity');
    });

    // Panning support: drag anywhere on the canvas
    // Blank area panning
    this.paper.on('blank:pointerdown', (evt: MouseEvent) => {
      this.startPanning(evt);
    });

    this.paper.on('blank:pointermove', (evt: MouseEvent) => {
      if (this.isPanning) {
        this.updatePanning(evt);
      }
    });

    this.paper.on('blank:pointerup', () => {
      if (this.isPanning) {
        this.stopPanning();
      }
    });

    // Entity area panning (when edit mode is off)
    this.paper.on('cell:pointerdown', (cellView: any, evt: MouseEvent) => {
      if (!this.editMode()) {
        this.startPanning(evt);
      }
    });

    this.paper.on('cell:pointermove', (cellView: any, evt: MouseEvent) => {
      if (this.isPanning) {
        this.updatePanning(evt);
        // Prevent default to stop entity selection during panning
        evt.stopPropagation();
      }
    });

    this.paper.on('cell:pointerup', () => {
      if (this.isPanning) {
        this.stopPanning();
      }
    });
  }

  /**
   * Starts panning mode on drag anywhere
   */
  private startPanning(evt: MouseEvent): void {
    this.isPanning = true;
    this.hasPanned = false; // Reset at start
    this.panStart = { x: evt.clientX, y: evt.clientY };
    console.log('[SchemaEditorPocPage] Started panning');
  }

  /**
   * Updates paper position during panning
   */
  private updatePanning(evt: MouseEvent): void {
    const dx = evt.clientX - this.panStart.x;
    const dy = evt.clientY - this.panStart.y;

    // Track if we actually moved (threshold to distinguish from click)
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      this.hasPanned = true;
    }

    // Get current translate
    const currentTranslate = this.paper.translate();

    // Apply new translate
    this.paper.translate(currentTranslate.tx + dx, currentTranslate.ty + dy);

    // Update pan start for next move
    this.panStart = { x: evt.clientX, y: evt.clientY };
  }

  /**
   * Stops panning mode
   */
  private stopPanning(): void {
    this.isPanning = false;
    console.log('[SchemaEditorPocPage] Stopped panning');

    // Reset hasPanned after a short delay to allow click event to check it
    setTimeout(() => {
      this.hasPanned = false;
    }, 10);
  }

  /**
   * Applies automatic layout using Dagre algorithm, then zooms to fit
   * Uses LR (left-to-right) for landscape screens, TB (top-to-bottom) for portrait
   * Public method called from template button or on initial load
   */
  public async autoArrange(): Promise<void> {
    if (!this.graph) {
      console.warn('[SchemaEditorPocPage] Cannot auto-arrange: graph not initialized');
      return;
    }

    try {
      // Import dagre library
      const dagre = await import('dagre');

      // Detect screen orientation: LR for landscape (wider), TB for portrait (taller)
      const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
      const rankdir = isLandscape ? 'LR' : 'TB';

      console.log(`[SchemaEditorPocPage] Applying auto-layout with direction: ${rankdir}`);

      // Create a new directed graph for dagre
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setGraph({
        rankdir,           // LR (left-to-right) or TB (top-to-bottom) based on screen
        nodesep: 80,       // Horizontal spacing between nodes
        ranksep: 100,      // Vertical spacing between ranks
        edgesep: 50        // Spacing between edges
      });
      dagreGraph.setDefaultEdgeLabel(() => ({}));

      // Add nodes to dagre graph
      const elements = this.graph.getElements();
      elements.forEach((element: any) => {
        const size = element.size();
        dagreGraph.setNode(element.id, {
          width: size.width,
          height: size.height
        });
      });

      // Add edges to dagre graph
      const links = this.graph.getLinks();
      links.forEach((link: any) => {
        const source = link.get('source').id;
        const target = link.get('target').id;
        if (source && target) {
          dagreGraph.setEdge(source, target);
        }
      });

      // Run dagre layout
      dagre.layout(dagreGraph);

      // Apply calculated positions back to JointJS elements
      elements.forEach((element: any) => {
        const node = dagreGraph.node(element.id);
        if (node) {
          // Dagre returns center coordinates, JointJS uses top-left
          element.position(
            node.x - node.width / 2,
            node.y - node.height / 2
          );
        }
      });

      // Note: Edge routing is handled by JointJS metro router on each link

      console.log('[SchemaEditorPocPage] Auto-layout applied successfully');

      // Zoom to fit after arranging
      this.zoomToFit();
    } catch (err) {
      console.error('[SchemaEditorPocPage] Failed to apply auto-layout:', err);
    }
  }

  /**
   * Zooms the diagram to fit the viewport with padding and centers it
   * Public method called from template or after auto-arrange
   */
  public zoomToFit(): void {
    if (!this.paper || !this.graph) {
      console.warn('[SchemaEditorPocPage] Cannot zoom to fit: paper or graph not initialized');
      return;
    }

    try {
      // Get the bounding box of all content
      const contentBBox = this.graph.getBBox();

      if (!contentBBox || contentBBox.width === 0 || contentBBox.height === 0) {
        console.warn('[SchemaEditorPocPage] Cannot zoom to fit: empty content');
        return;
      }

      // Get paper dimensions
      const paperWidth = this.paper.options.width === '100%'
        ? this.paper.el.clientWidth
        : this.paper.options.width;
      const paperHeight = this.paper.options.height === '100%'
        ? this.paper.el.clientHeight
        : this.paper.options.height;

      // Calculate scale to fit with padding (20px on each side = 40px total)
      const padding = 40;
      const scaleX = (paperWidth - padding) / contentBBox.width;
      const scaleY = (paperHeight - padding) / contentBBox.height;
      const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

      // Calculate center position
      const scaledWidth = contentBBox.width * scale;
      const scaledHeight = contentBBox.height * scale;
      const tx = (paperWidth - scaledWidth) / 2 - contentBBox.x * scale;
      const ty = (paperHeight - scaledHeight) / 2 - contentBBox.y * scale;

      // Apply scale and translation
      this.paper.scale(scale, scale);
      this.paper.translate(tx, ty);

      console.log(`[SchemaEditorPocPage] Zoomed to fit: scale=${scale.toFixed(2)}, translate=(${tx.toFixed(0)}, ${ty.toFixed(0)})`);
    } catch (err) {
      console.error('[SchemaEditorPocPage] Failed to zoom to fit:', err);
    }
  }

  /**
   * Zooms in by 20%
   * Public method called from template zoom controls
   */
  public zoomIn(): void {
    if (!this.paper) {
      console.warn('[SchemaEditorPocPage] Cannot zoom in: paper not initialized');
      return;
    }

    const currentScale = this.paper.scale();
    const newScale = Math.min(currentScale.sx * 1.2, 3); // Max 300% zoom

    // Get paper center
    const paperWidth = this.paper.el.clientWidth;
    const paperHeight = this.paper.el.clientHeight;
    const centerX = paperWidth / 2;
    const centerY = paperHeight / 2;

    // Get current translation
    const currentTranslate = this.paper.translate();

    // Calculate new translation to keep center point stable
    const scaleDiff = newScale / currentScale.sx;
    const newTx = centerX - (centerX - currentTranslate.tx) * scaleDiff;
    const newTy = centerY - (centerY - currentTranslate.ty) * scaleDiff;

    // Apply new scale and translation
    this.paper.scale(newScale, newScale);
    this.paper.translate(newTx, newTy);

    console.log(`[SchemaEditorPocPage] Zoomed in: scale=${newScale.toFixed(2)}`);
  }

  /**
   * Zooms out by 20%
   * Public method called from template zoom controls
   */
  public zoomOut(): void {
    if (!this.paper) {
      console.warn('[SchemaEditorPocPage] Cannot zoom out: paper not initialized');
      return;
    }

    const currentScale = this.paper.scale();
    const newScale = Math.max(currentScale.sx / 1.2, 0.1); // Min 10% zoom

    // Get paper center
    const paperWidth = this.paper.el.clientWidth;
    const paperHeight = this.paper.el.clientHeight;
    const centerX = paperWidth / 2;
    const centerY = paperHeight / 2;

    // Get current translation
    const currentTranslate = this.paper.translate();

    // Calculate new translation to keep center point stable
    const scaleDiff = newScale / currentScale.sx;
    const newTx = centerX - (centerX - currentTranslate.tx) * scaleDiff;
    const newTy = centerY - (centerY - currentTranslate.ty) * scaleDiff;

    // Apply new scale and translation
    this.paper.scale(newScale, newScale);
    this.paper.translate(newTx, newTy);

    console.log(`[SchemaEditorPocPage] Zoomed out: scale=${newScale.toFixed(2)}`);
  }

  /**
   * Highlights the selected entity and its connected relationships
   */
  private highlightSelectedEntity(selectedCell: any): void {
    // Remove highlights from all elements
    this.clearHighlights();

    const colors = this.getThemeColors();

    // Highlight selected element
    selectedCell.attr('body/stroke', colors.primary);
    selectedCell.attr('body/strokeWidth', 3);

    // Highlight connected relationships (links)
    const connectedLinks = this.graph.getConnectedLinks(selectedCell);
    connectedLinks.forEach((link: any) => {
      link.attr('line/strokeWidth', 3);
      link.attr('line/stroke', colors.primary);
      // Also update marker colors to match
      const attrs = link.attr('line');
      if (attrs.targetMarker) {
        link.attr('line/targetMarker/fill', colors.primary);
      }
      if (attrs.sourceMarker) {
        link.attr('line/sourceMarker/fill', colors.primary);
      }
    });

    console.log(`[SchemaEditorPocPage] Highlighted ${connectedLinks.length} connected relationships`);
  }

  /**
   * Clears all entity and relationship highlights
   */
  private clearHighlights(): void {
    const colors = this.getThemeColors();

    // Reset all entity highlights
    this.graph.getElements().forEach((el: any) => {
      el.attr('body/stroke', colors.baseContent);
      el.attr('body/strokeWidth', 2);
    });

    // Reset all link highlights
    this.graph.getLinks().forEach((link: any) => {
      link.attr('line/strokeWidth', 2);
      link.attr('line/stroke', colors.baseContent);
      // Reset marker colors
      const attrs = link.attr('line');
      if (attrs.targetMarker) {
        link.attr('line/targetMarker/fill', colors.baseContent);
      }
      if (attrs.sourceMarker) {
        link.attr('line/sourceMarker/fill', colors.baseContent);
      }
    });
  }

  /**
   * Handle inspector panel close event
   */
  onInspectorClose(): void {
    this.selectedEntity.set(null);
    this.clearHighlights();
  }

  /**
   * Navigate to a related entity on the diagram
   */
  onNavigateToEntity(tableName: string): void {
    // Find the entity in our data (includes both regular and metadata entities)
    const targetEntity = this.allEntities().find(e => e.table_name === tableName);

    if (!targetEntity) {
      console.warn(`[SchemaEditorPocPage] Entity "${tableName}" not found`);
      return;
    }

    // Find the corresponding element on the graph
    const targetElement = this.graph.getElements().find((el: any) =>
      el.get('entityName') === tableName
    );

    if (!targetElement) {
      console.warn(`[SchemaEditorPocPage] Element for "${tableName}" not found on graph`);
      return;
    }

    // Update selection
    this.selectedEntity.set(targetEntity);
    this.highlightSelectedEntity(targetElement);

    // Center the target entity in view
    const position = targetElement.position();
    const size = targetElement.size();
    const centerX = position.x + size.width / 2;
    const centerY = position.y + size.height / 2;

    // Get paper dimensions
    const paperWidth = this.paper.el.clientWidth;
    const paperHeight = this.paper.el.clientHeight;

    // Calculate translation to center the entity
    const currentScale = this.paper.scale();
    const targetTx = (paperWidth / 2) - (centerX * currentScale.sx);
    const targetTy = (paperHeight / 2) - (centerY * currentScale.sy);

    // Smoothly pan to the target
    this.paper.translate(targetTx, targetTy);

    console.log(`[SchemaEditorPocPage] Navigated to entity: ${tableName}`);
  }
}
