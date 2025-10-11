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

import { Component, input, Output, EventEmitter, signal, computed, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EntityPropertyType, SchemaEntityProperty } from '../../interfaces/entity';
import { FilterCriteria } from '../../interfaces/query';
import { DataService } from '../../services/data.service';

interface FilterState {
  [column: string]: any;
}

interface FilterOption {
  id: any;
  display_name: string;
}

@Component({
  selector: 'app-filter-bar',
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent {
  private dataService = inject(DataService);

  properties = input<SchemaEntityProperty[]>([]);
  entityKey = input<string | undefined>(undefined);
  currentFilters = input<FilterCriteria[]>([]);
  @Output() filtersChange = new EventEmitter<FilterCriteria[]>();

  public isExpanded = signal(false);
  public filterState = signal<FilterState>({});
  public filterOptions = signal<Map<string, FilterOption[]>>(new Map());

  private previousEntityKey?: string;

  // Property type enum exposed to template
  public EntityPropertyType = EntityPropertyType;

  // Count active filters that match filterable columns
  public activeFilterCount = computed(() => {
    const filters = this.currentFilters();
    const filterableColumns = new Set(this.properties().map(p => p.column_name));

    // Count filters that match filterable columns
    return filters.filter(f => filterableColumns.has(f.column)).length;
  });

  // Calculate max width based on number of filterable properties
  // Each column is 250px, gap is 16px, padding is 32px total
  public dropdownMaxWidth = computed(() => {
    const propCount = this.properties().length;
    const columns = Math.min(propCount, 4); // Cap at 4 columns
    const columnWidth = 250;
    const gapWidth = 16;
    const paddingWidth = 32;

    const width = (columnWidth * columns) + (gapWidth * (columns - 1)) + paddingWidth;
    return `${width}px`;
  });

  // Calculate grid columns string
  public gridColumns = computed(() => {
    const propCount = this.properties().length;
    const columns = Math.min(propCount, 4); // Cap at 4 columns
    return `repeat(${columns}, 250px)`;
  });

  // Load FK and User filter options when properties change
  private _loadOptionsEffect = effect(() => {
    const props = this.properties(); // Read signal value
    if (props && props.length > 0) {
      props.forEach(prop => {
        if (prop.type === EntityPropertyType.ForeignKeyName && prop.join_table) {
          this.loadFilterOptions(prop.column_name, prop.join_table);
        } else if (prop.type === EntityPropertyType.User) {
          this.loadFilterOptions(prop.column_name, 'civic_os_users');
        }
      });
    }
  });

  // Clear filter state when entity changes
  private _clearOnEntityChange = effect(() => {
    const key = this.entityKey(); // Read signal value

    // Only clear if entityKey actually changed (not on first init)
    if (this.previousEntityKey !== undefined && key !== this.previousEntityKey) {
      this.filterState.set({});
      this.filterOptions.set(new Map());
      this.isExpanded.set(false);
    }

    // Track the current key for next comparison
    this.previousEntityKey = key;
  });

  private loadFilterOptions(columnName: string, tableName: string) {
    this.dataService.getData({
      key: tableName,
      fields: ['id', 'display_name'],
      orderField: 'display_name',
      orderDirection: 'asc'
    }).subscribe(data => {
      const options = this.filterOptions();
      options.set(columnName, data as FilterOption[]);
      this.filterOptions.set(new Map(options));
    });
  }

  public toggleExpanded() {
    this.isExpanded.set(!this.isExpanded());
  }

  public onFilterChange() {
    // Build filter criteria from current state
    const criteria: FilterCriteria[] = [];
    const state = this.filterState();

    this.properties().forEach(prop => {
      switch (prop.type) {
        case EntityPropertyType.ForeignKeyName:
        case EntityPropertyType.User:
          // Checkbox multi-select: use 'in' operator
          const value = state[prop.column_name];
          if (Array.isArray(value) && value.length > 0) {
            criteria.push({
              column: prop.column_name,
              operator: 'in',
              value: `(${value.join(',')})`
            });
          }
          break;

        case EntityPropertyType.Boolean:
          // Boolean: use 'is' operator
          const boolValue = state[prop.column_name];
          if (boolValue !== null && boolValue !== undefined && boolValue !== 'all' && boolValue !== '') {
            criteria.push({
              column: prop.column_name,
              operator: 'is',
              value: boolValue
            });
          }
          break;

        case EntityPropertyType.DateTime:
        case EntityPropertyType.DateTimeLocal:
        case EntityPropertyType.Date:
          // Date range: split into start/end
          const startKey = `${prop.column_name}_start`;
          const endKey = `${prop.column_name}_end`;
          if (state[startKey]) {
            criteria.push({
              column: prop.column_name,
              operator: 'gte',
              value: state[startKey]
            });
          }
          if (state[endKey]) {
            criteria.push({
              column: prop.column_name,
              operator: 'lte',
              value: state[endKey]
            });
          }
          break;

        case EntityPropertyType.IntegerNumber:
        case EntityPropertyType.Money:
          // Numeric range: split into min/max
          const minKey = `${prop.column_name}_min`;
          const maxKey = `${prop.column_name}_max`;
          if (state[minKey] !== null && state[minKey] !== undefined && state[minKey] !== '') {
            criteria.push({
              column: prop.column_name,
              operator: 'gte',
              value: state[minKey]
            });
          }
          if (state[maxKey] !== null && state[maxKey] !== undefined && state[maxKey] !== '') {
            criteria.push({
              column: prop.column_name,
              operator: 'lte',
              value: state[maxKey]
            });
          }
          break;
      }
    });

    this.filtersChange.emit(criteria);
  }

  public toggleOption(columnName: string, optionId: any) {
    const state = this.filterState();
    const currentValues = state[columnName] || [];

    let newValues: any[];
    if (currentValues.includes(optionId)) {
      // Remove if already selected
      newValues = currentValues.filter((id: any) => id !== optionId);
    } else {
      // Add if not selected
      newValues = [...currentValues, optionId];
    }

    // Update state
    const newState = { ...state };
    if (newValues.length === 0) {
      // Remove the property entirely if array is empty
      delete newState[columnName];
    } else {
      newState[columnName] = newValues;
    }
    this.filterState.set(newState);

    this.onFilterChange();
  }

  public isOptionSelected(columnName: string, optionId: any): boolean {
    const state = this.filterState();
    const currentValues = state[columnName] || [];
    return currentValues.includes(optionId);
  }

  public onDateChange(event: Event, key: string) {
    const input = event.target as HTMLInputElement;
    const newState = { ...this.filterState() };
    newState[key] = input.value;
    this.filterState.set(newState);
    this.onFilterChange();
  }

  public onNumberChange(event: Event, key: string) {
    const input = event.target as HTMLInputElement;
    const newState = { ...this.filterState() };
    newState[key] = input.value ? Number(input.value) : '';
    this.filterState.set(newState);
    this.onFilterChange();
  }

  public clearAllFilters() {
    this.filterState.set({});
    this.filtersChange.emit([]);
  }

  public getFilterOptions(columnName: string): FilterOption[] {
    return this.filterOptions().get(columnName) || [];
  }
}
