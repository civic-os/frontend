import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { SchemaService } from '../../services/schema.service';
import { EntityManagementService } from '../../services/entity-management.service';
import { SchemaEntityTable } from '../../interfaces/entity';
import { debounceTime, Subject } from 'rxjs';

interface EntityRow extends SchemaEntityTable {
  customDisplayName: string | null;
  customDescription: string | null;
}

@Component({
  selector: 'app-entity-management',
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './entity-management.page.html',
  styleUrl: './entity-management.page.css'
})
export class EntityManagementPage {
  private schemaService = inject(SchemaService);
  private entityManagementService = inject(EntityManagementService);

  entities = signal<EntityRow[]>([]);
  loading = signal(true);
  error = signal<string | undefined>(undefined);
  isAdmin = signal(false);
  savingStates = signal<Map<string, boolean>>(new Map());
  savedStates = signal<Map<string, boolean>>(new Map()); // Track successful saves
  fadingStates = signal<Map<string, boolean>>(new Map()); // Track fading checkmarks

  private saveSubjects = new Map<string, Subject<void>>();

  constructor() {
    this.checkAdminAndLoadData();
  }

  private checkAdminAndLoadData() {
    this.entityManagementService.isAdmin().subscribe({
      next: (isAdmin) => {
        this.isAdmin.set(isAdmin);
        if (isAdmin) {
          this.loadEntities();
        } else {
          this.error.set('Admin access required');
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set('Failed to verify admin access');
        this.loading.set(false);
      }
    });
  }

  private loadEntities() {
    this.schemaService.getEntities().subscribe({
      next: (entities) => {
        if (entities) {
          // Map entities to include editable custom fields
          const entityRows: EntityRow[] = entities.map(e => ({
            ...e,
            customDisplayName: e.display_name !== e.table_name ? e.display_name : null,
            customDescription: e.description
          }));
          this.entities.set(entityRows);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load entities');
        this.loading.set(false);
      }
    });
  }

  onDrop(event: CdkDragDrop<EntityRow[]>) {
    const entities = [...this.entities()];
    moveItemInArray(entities, event.previousIndex, event.currentIndex);
    this.entities.set(entities);

    // Update sort_order for all entities based on new positions
    const updates = entities.map((entity, index) => ({
      table_name: entity.table_name,
      sort_order: index
    }));

    this.entityManagementService.updateEntitiesOrder(updates).subscribe({
      next: (response) => {
        if (response.success) {
          // Refresh schema cache to update menu
          this.schemaService.refreshCache();
        } else {
          this.error.set(response.error?.humanMessage || 'Failed to update order');
        }
      },
      error: () => {
        this.error.set('Failed to update order');
      }
    });
  }

  onDisplayNameChange(entity: EntityRow) {
    this.saveEntityMetadata(entity);
  }

  onDescriptionChange(entity: EntityRow) {
    this.saveEntityMetadata(entity);
  }

  onFieldBlur(entity: EntityRow) {
    // Save immediately when field loses focus
    this.performSave(entity);
  }

  private saveEntityMetadata(entity: EntityRow) {
    // Get or create debounce subject for this entity
    if (!this.saveSubjects.has(entity.table_name)) {
      const subject = new Subject<void>();
      this.saveSubjects.set(entity.table_name, subject);

      subject.pipe(debounceTime(1000)).subscribe(() => {
        this.performSave(entity);
      });
    }

    // Trigger debounced save
    this.saveSubjects.get(entity.table_name)!.next();
  }

  private performSave(entity: EntityRow) {
    // Set saving state
    const savingStates = new Map(this.savingStates());
    savingStates.set(entity.table_name, true);
    this.savingStates.set(savingStates);

    // Clear any existing saved and fading states
    const savedStates = new Map(this.savedStates());
    savedStates.delete(entity.table_name);
    this.savedStates.set(savedStates);

    const fadingStates = new Map(this.fadingStates());
    fadingStates.delete(entity.table_name);
    this.fadingStates.set(fadingStates);

    this.entityManagementService.upsertEntityMetadata(
      entity.table_name,
      entity.customDisplayName || null,
      entity.customDescription || null,
      entity.sort_order
    ).subscribe({
      next: (response) => {
        // Clear saving state
        const savingStates = new Map(this.savingStates());
        savingStates.delete(entity.table_name);
        this.savingStates.set(savingStates);

        if (response.success) {
          // Show checkmark
          const savedStates = new Map(this.savedStates());
          savedStates.set(entity.table_name, true);
          this.savedStates.set(savedStates);

          // Start fading after 4 seconds
          setTimeout(() => {
            const fadingStates = new Map(this.fadingStates());
            fadingStates.set(entity.table_name, true);
            this.fadingStates.set(fadingStates);
          }, 4000);

          // Remove checkmark completely after 5 seconds (4s visible + 1s fade)
          setTimeout(() => {
            const savedStates = new Map(this.savedStates());
            savedStates.delete(entity.table_name);
            this.savedStates.set(savedStates);

            const fadingStates = new Map(this.fadingStates());
            fadingStates.delete(entity.table_name);
            this.fadingStates.set(fadingStates);
          }, 5000);

          // Refresh schema cache to update menu
          this.schemaService.refreshCache();
        } else {
          this.error.set(response.error?.humanMessage || 'Failed to save');
        }
      },
      error: () => {
        const savingStates = new Map(this.savingStates());
        savingStates.delete(entity.table_name);
        this.savingStates.set(savingStates);
        this.error.set('Failed to save entity metadata');
      }
    });
  }

  isSaving(tableName: string): boolean {
    return this.savingStates().get(tableName) || false;
  }

  isSaved(tableName: string): boolean {
    return this.savedStates().get(tableName) || false;
  }

  isFading(tableName: string): boolean {
    return this.fadingStates().get(tableName) || false;
  }

  getDisplayNamePlaceholder(entity: EntityRow): string {
    return entity.display_name;
  }
}
