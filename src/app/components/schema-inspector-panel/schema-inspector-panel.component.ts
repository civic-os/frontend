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

import { Component, ChangeDetectionStrategy, input, output, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaEntityTable, SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { SchemaService } from '../../services/schema.service';

type TabType = 'properties' | 'relations' | 'validations' | 'permissions';

/**
 * Inspector panel component for the Schema Editor.
 *
 * Displays detailed metadata about a selected entity including:
 * - Properties (columns with types, constraints, descriptions)
 * - Relations (FK, inverse FK, M:M relationships)
 * - Validations (validation rules and error messages)
 * - Permissions (role-based access control matrix)
 *
 * This is a read-only panel. Future phases will add editing capabilities.
 */
@Component({
  selector: 'app-schema-inspector-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './schema-inspector-panel.component.html',
  styleUrl: './schema-inspector-panel.component.css'
})
export class SchemaInspectorPanelComponent {
  private schemaService = inject(SchemaService);

  // Input: currently selected entity (null when panel is closed)
  entity = input<SchemaEntityTable | null>(null);

  // Output: close button clicked
  close = output<void>();

  // Output: navigate to related entity
  navigateToEntity = output<string>(); // Emits table_name

  // Current active tab
  activeTab = signal<TabType>('properties');

  // Properties data for selected entity
  properties = signal<SchemaEntityProperty[]>([]);
  loadingProperties = signal(false);
  propertiesError = signal<string | undefined>(undefined);

  // Track which properties are expanded (by column_name)
  expandedProperties = signal<Set<string>>(new Set());

  // All properties (for detecting inverse relationships)
  allProperties = signal<SchemaEntityProperty[]>([]);

  // Metadata system tables
  private readonly METADATA_SYSTEM_TABLES = [
    'files',
    'civic_os_users'
  ];

  // Computed: Is panel open?
  isOpen = computed(() => this.entity() !== null);

  // Computed: Is current entity a metadata system table?
  isMetadataTable = computed(() => {
    const currentEntity = this.entity();
    return currentEntity ? this.METADATA_SYSTEM_TABLES.includes(currentEntity.table_name) : false;
  });

  // Computed: Relationship categories
  belongsToRelationships = computed(() => {
    return this.properties().filter(p =>
      p.join_table && p.type !== EntityPropertyType.ManyToMany
    );
  });

  hasManyRelationships = computed(() => {
    const currentEntity = this.entity();
    if (!currentEntity) return [];

    // Find all properties that reference this entity
    return this.allProperties().filter(p =>
      p.join_table === currentEntity.table_name &&
      p.type !== EntityPropertyType.ManyToMany
    );
  });

  manyToManyRelationships = computed(() => {
    return this.properties().filter(p =>
      p.type === EntityPropertyType.ManyToMany
    );
  });

  constructor() {
    // Load all properties once for inverse relationship detection
    this.schemaService.getProperties().subscribe({
      next: (allProps) => {
        this.allProperties.set(allProps);
      },
      error: (err) => {
        console.error('[SchemaInspectorPanel] Failed to load all properties:', err);
      }
    });

    // Effect: Load properties when entity changes
    effect(() => {
      const currentEntity = this.entity();
      if (currentEntity) {
        const isMetadata = this.METADATA_SYSTEM_TABLES.includes(currentEntity.table_name);

        if (isMetadata) {
          // For metadata tables, skip property loading and switch to Relations tab
          this.properties.set([]);
          this.propertiesError.set(undefined);
          this.activeTab.set('relations');
        } else {
          // For regular tables, load properties and default to Properties tab
          this.loadProperties(currentEntity);
          this.activeTab.set('properties');
        }

        // Reset expanded properties when switching entities
        this.expandedProperties.set(new Set());
      } else {
        // Reset when panel closes
        this.properties.set([]);
        this.propertiesError.set(undefined);
        this.activeTab.set('properties'); // Reset to first tab
        this.expandedProperties.set(new Set());
      }
    });
  }

  /**
   * Load properties for the given entity
   */
  private loadProperties(entity: SchemaEntityTable): void {
    this.loadingProperties.set(true);
    this.propertiesError.set(undefined);

    this.schemaService.getPropertiesForEntity(entity).subscribe({
      next: (props) => {
        // Sort by sort_order to match the order in other views
        const sortedProps = [...props].sort((a, b) => a.sort_order - b.sort_order);
        this.properties.set(sortedProps);
        this.loadingProperties.set(false);
      },
      error: (err) => {
        this.propertiesError.set(err.message || 'Failed to load properties');
        this.loadingProperties.set(false);
      }
    });
  }

  /**
   * Change active tab
   */
  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  /**
   * Close button clicked
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * Get badge class for property constraints
   */
  getConstraintBadges(property: SchemaEntityProperty): string[] {
    const badges: string[] = [];

    // Convention: 'id' column is the primary key
    if (property.column_name === 'id') {
      badges.push('pk');
    }

    // Check for many-to-many relationship first (more specific)
    if (property.type === EntityPropertyType.ManyToMany) {
      badges.push('m2m');
    } else if (property.join_table) {
      // Regular foreign key
      badges.push('fk');
    }

    if (property.is_nullable === false) {
      badges.push('required');
    }

    return badges;
  }

  /**
   * Get badge display text and CSS class
   */
  getBadgeInfo(badge: string): { text: string; cssClass: string } {
    switch (badge) {
      case 'pk':
        return { text: '🔑 PK', cssClass: 'badge-primary' };
      case 'fk':
        return { text: '🔗 FK', cssClass: 'badge-secondary' };
      case 'm2m':
        return { text: '↔️ M:M', cssClass: 'badge-accent' };
      case 'required':
        return { text: '⚠️ Required', cssClass: 'badge-error' };
      default:
        return { text: badge, cssClass: 'badge-neutral' };
    }
  }

  /**
   * Format PostgreSQL data type for display
   */
  formatDataType(property: SchemaEntityProperty): string {
    let type = property.udt_name;

    if (property.character_maximum_length) {
      type += `(${property.character_maximum_length})`;
    }

    return type;
  }

  /**
   * Toggle property expansion
   */
  togglePropertyExpansion(columnName: string): void {
    const expanded = this.expandedProperties();
    const newExpanded = new Set(expanded);

    if (newExpanded.has(columnName)) {
      newExpanded.delete(columnName);
    } else {
      newExpanded.add(columnName);
    }

    this.expandedProperties.set(newExpanded);
  }

  /**
   * Check if property is expanded
   */
  isPropertyExpanded(columnName: string): boolean {
    return this.expandedProperties().has(columnName);
  }

  /**
   * Navigate to a related entity
   */
  onNavigateToEntity(tableName: string): void {
    this.navigateToEntity.emit(tableName);
  }
}
