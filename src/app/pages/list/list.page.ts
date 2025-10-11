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

import { Component, inject, ChangeDetectionStrategy, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, map, mergeMap, of, combineLatest, debounceTime, distinctUntilChanged, take, tap, shareReplay, switchMap, from, forkJoin } from 'rxjs';
import { SchemaService } from '../../services/schema.service';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { DataService } from '../../services/data.service';
import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';
import { FilterBarComponent } from '../../components/filter-bar/filter-bar.component';
import { FilterCriteria } from '../../interfaces/query';

interface FilterChip {
  column: string;
  columnLabel: string;
  operator: string;
  value: any;
  displayValue: string;
}

@Component({
    selector: 'app-view',
    templateUrl: './list.page.html',
    styleUrl: './list.page.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    DisplayPropertyComponent,
    FilterBarComponent
]
})
export class ListPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private schema = inject(SchemaService);
  private data = inject(DataService);

  public entityKey?: string;
  public searchControl = new FormControl('');
  public isLoading = signal<boolean>(false);

  public entity$: Observable<SchemaEntityTable | undefined> = this.route.params.pipe(
    mergeMap(p => {
      if(p['entityKey']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of(undefined);
      }
    })
  );

  public properties$: Observable<SchemaEntityProperty[]> = this.entity$.pipe(mergeMap(e => {
    if(e) {
      let props = this.schema.getPropsForList(e);
      return props;
    } else {
      return of([]);
    }
  }));

  public filterProperties$: Observable<SchemaEntityProperty[]> = this.entity$.pipe(mergeMap(e => {
    if(e) {
      return this.schema.getPropsForFilter(e);
    } else {
      return of([]);
    }
  }));

  // Derive filters from URL query params
  public filters$: Observable<FilterCriteria[]> = this.route.queryParams.pipe(
    map(params => {
      const filters: FilterCriteria[] = [];
      let index = 0;
      while (params[`f${index}_col`]) {
        filters.push({
          column: params[`f${index}_col`],
          operator: params[`f${index}_op`],
          value: params[`f${index}_val`]
        });
        index++;
      }
      return filters;
    })
  );

  // Derive sort state from URL query params
  public sortState$: Observable<{ column: string | null, direction: 'asc' | 'desc' | null }> =
    this.route.queryParams.pipe(
      map(params => ({
        column: params['sort'] || null,
        direction: (params['dir'] as 'asc' | 'desc') || null
      }))
    );

  // Derive search query from URL query params
  public searchQuery$: Observable<string> = this.route.queryParams.pipe(
    map(params => params['q'] || '')
  );

  public data$: Observable<any> = this.route.params.pipe(
    // switchMap cancels previous subscription when params change
    switchMap(p => {
      // Wait for query param clearing to complete before proceeding
      if (this.entityKey && this.entityKey !== p['entityKey']) {
        this.entityKey = p['entityKey'];
        // Convert Promise to Observable and wait for navigation to complete
        return from(
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          })
        ).pipe(
          // After navigation completes, return the params
          map(() => p)
        );
      } else {
        this.entityKey = p['entityKey'];
        // No navigation needed, just continue
        return of(p);
      }
    }),
    mergeMap(p => {
      if (!p['entityKey']) return of([]);

      // Now derive everything from the current route state
      return combineLatest([
        this.schema.getEntity(p['entityKey']),
        this.schema.getEntity(p['entityKey']).pipe(
          mergeMap(e => e ? this.schema.getPropsForList(e) : of([]))
        ),
        this.searchQuery$,
        this.sortState$,
        this.filters$
      ]).pipe(
        tap(() => this.isLoading.set(true)),
        switchMap(([entity, props, search, sortState, filters]) => {
          if (props && props.length > 0 && p['entityKey']) {
            let columns = props
              .map(x => SchemaService.propertyToSelectString(x));

            // Build order field for PostgREST
            let orderField: string | undefined = undefined;
            if (sortState.column && sortState.direction) {
              const sortProperty = props.find(p => p.column_name === sortState.column);
              if (sortProperty) {
                orderField = this.buildOrderField(sortProperty);
              }
            }

            // Filter out any filters that don't match current entity's columns
            const validColumnNames = props.map(p => p.column_name);
            const validFilters = filters.filter(f => validColumnNames.includes(f.column));

            // Only apply search if entity has search_fields defined
            const validSearch = (entity && entity.search_fields && entity.search_fields.length > 0)
              ? search
              : undefined;

            return this.data.getData({
              key: p['entityKey'],
              fields: columns,
              searchQuery: validSearch || undefined,
              orderField: orderField,
              orderDirection: sortState.direction || undefined,
              filters: validFilters && validFilters.length > 0 ? validFilters : undefined
            });
          } else {
            return of([]);
          }
        }),
        tap(() => this.isLoading.set(false))
      );
    }),
    shareReplay(1)
  );

  // Convert data$ observable to signal for use in computed
  public dataSignal = toSignal(this.data$, { initialValue: [] });

  // Convert observables to signals for template use
  public sortStateSignal = toSignal(this.sortState$, {
    initialValue: { column: null, direction: null }
  });

  public filtersSignal = toSignal(this.filters$, { initialValue: [] });

  // Signal for filterable properties (used in filter preservation logic)
  private filterablePropertiesSignal = toSignal(this.filterProperties$, { initialValue: [] });

  // Extract search terms for highlighting
  private searchTerms$: Observable<string[]> = this.searchQuery$.pipe(
    map(query => {
      if (!query || !query.trim()) return [];
      return query.trim().split(/\s+/).filter(term => term.length > 0);
    })
  );
  public searchTerms = toSignal(this.searchTerms$, { initialValue: [] });

  // Check if any filtering is active (filters or search)
  private isFiltered$ = combineLatest([this.filters$, this.searchQuery$]).pipe(
    map(([filters, search]) => filters.length > 0 || (search && search.trim().length > 0))
  );
  public isFiltered = toSignal(this.isFiltered$, { initialValue: false });

  // Count of search results
  public resultCount = computed(() => this.dataSignal().length);

  // Build filter chips with human-readable labels
  public filterChips$: Observable<FilterChip[]> = combineLatest([
    this.filters$,
    this.properties$
  ]).pipe(
    switchMap(([filters, props]) => {
      if (filters.length === 0) return of([]);

      // Build chips for each filter
      const chipObservables = filters.map(filter => {
        const prop = props.find(p => p.column_name === filter.column);
        const columnLabel = prop?.display_name || filter.column;

        // For FK and User filters, fetch display name
        if (prop?.type === EntityPropertyType.ForeignKeyName && prop.join_table) {
          // Extract ID from filter value (handles both single values and 'in' operator lists)
          let filterIds: string[] = [];
          if (filter.operator === 'in') {
            // Parse "(1,2,3)" format
            const match = filter.value.match(/\(([^)]+)\)/);
            if (match) {
              filterIds = match[1].split(',');
            }
          } else {
            filterIds = [filter.value];
          }

          // Fetch display names for all IDs
          return this.data.getData({
            key: prop.join_table,
            fields: ['id', 'display_name'],
            filters: [{ column: 'id', operator: 'in', value: `(${filterIds.join(',')})` }]
          }).pipe(
            map(data => {
              const displayNames = data.map((d: any) => d.display_name).join(', ');
              return {
                column: filter.column,
                columnLabel,
                operator: filter.operator,
                value: filter.value,
                displayValue: displayNames || filter.value
              };
            })
          );
        } else if (prop?.type === EntityPropertyType.User) {
          // Similar handling for User type
          let filterIds: string[] = [];
          if (filter.operator === 'in') {
            const match = filter.value.match(/\(([^)]+)\)/);
            if (match) {
              filterIds = match[1].split(',');
            }
          } else {
            filterIds = [filter.value];
          }

          return this.data.getData({
            key: 'civic_os_users',
            fields: ['id', 'display_name'],
            filters: [{ column: 'id', operator: 'in', value: `(${filterIds.join(',')})` }]
          }).pipe(
            map(data => {
              const displayNames = data.map((d: any) => d.display_name).join(', ');
              return {
                column: filter.column,
                columnLabel,
                operator: filter.operator,
                value: filter.value,
                displayValue: displayNames || filter.value
              };
            })
          );
        } else {
          // For other types, use the raw value
          let displayValue = filter.value;

          // Format boolean values
          if (prop?.type === EntityPropertyType.Boolean) {
            displayValue = filter.value === 'true' ? 'Yes' : 'No';
          }

          return of({
            column: filter.column,
            columnLabel,
            operator: filter.operator,
            value: filter.value,
            displayValue: String(displayValue)
          });
        }
      });

      // Combine all chip observables
      return chipObservables.length > 0 ? forkJoin(chipObservables) : of([]);
    })
  );

  ngOnInit() {
    // Sync searchControl with URL query params (bidirectional)
    // URL → searchControl
    this.searchQuery$.subscribe(query => {
      if (this.searchControl.value !== query) {
        this.searchControl.setValue(query, { emitEvent: false });
      }
    });

    // searchControl → URL (debounced)
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        // Navigate to update URL with new search value
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: value || null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      });
  }

  public onFiltersChange(filters: FilterCriteria[]) {
    // Get current filters from URL
    const currentFilters = this.filtersSignal();

    let allFilters: FilterCriteria[];

    if (filters.length === 0) {
      // FilterBar is clearing all filterable columns
      // Preserve only non-filterable column filters (e.g., from Related Records)
      const filterableProps = this.filterablePropertiesSignal();
      const filterableColumns = new Set(filterableProps.map(p => p.column_name));
      allFilters = currentFilters.filter(f => !filterableColumns.has(f.column));
    } else {
      // FilterBar is updating specific columns
      // Get columns that FilterBar is explicitly updating
      const updatedColumns = new Set(filters.map(f => f.column));

      // Preserve filters for columns NOT being updated by FilterBar
      // This handles filters from Related Records or other sources that FilterBar doesn't know about
      const preservedFilters = currentFilters.filter(f => !updatedColumns.has(f.column));

      // Combine preserved filters with new filters from FilterBar
      allFilters = [...preservedFilters, ...filters];
    }

    // Build filter query params
    const filterParams: any = {};

    // First, clear all existing filter params by setting them to null
    const currentParams = this.route.snapshot.queryParams;
    Object.keys(currentParams).forEach(key => {
      if (key.match(/^f\d+_(col|op|val)$/)) {
        filterParams[key] = null;
      }
    });

    // Then set all filter params (preserved + new)
    allFilters.forEach((filter, index) => {
      filterParams[`f${index}_col`] = filter.column;
      filterParams[`f${index}_op`] = filter.operator;
      filterParams[`f${index}_val`] = filter.value;
    });

    // Navigate with new filter params (preserves search and sort)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filterParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public isColumnFiltered(columnName: string): boolean {
    const filters = this.filtersSignal();
    return filters.some(f => f.column === columnName);
  }

  public clearSearch() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public removeFilter(columnToRemove: string) {
    const currentFilters = this.filtersSignal();
    const newFilters = currentFilters.filter(f => f.column !== columnToRemove);

    // Build filter query params directly (bypass onFiltersChange preservation logic)
    const filterParams: any = {};

    // First, clear all existing filter params by setting them to null
    const currentParams = this.route.snapshot.queryParams;
    Object.keys(currentParams).forEach(key => {
      if (key.match(/^f\d+_(col|op|val)$/)) {
        filterParams[key] = null;
      }
    });

    // Then set the new filter params
    newFilters.forEach((filter, index) => {
      filterParams[`f${index}_col`] = filter.column;
      filterParams[`f${index}_op`] = filter.operator;
      filterParams[`f${index}_val`] = filter.value;
    });

    // Navigate with new filter params (preserves search and sort)
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filterParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Builds the PostgREST order field string.
   * For FK and User columns, orders by the related entity's display_name.
   * For regular columns, uses the column name directly.
   */
  private buildOrderField(property: SchemaEntityProperty): string {
    // For foreign key columns, order by the embedded resource's display_name
    // The embedded resource name is the column name (without _id suffix for FKs)
    if (property.type === EntityPropertyType.ForeignKeyName) {
      return `${property.column_name}(display_name)`;
    }

    // For user columns, order by the embedded user's display_name
    // User columns are embedded as: column_name:civic_os_users!column_name(...)
    if (property.type === EntityPropertyType.User) {
      return `${property.column_name}(display_name)`;
    }

    // For regular columns, use the column name
    return property.column_name;
  }

  /**
   * Handles table header clicks to cycle through sort states.
   * Triple-state toggle: unsorted → asc → desc → unsorted
   */
  public onHeaderClick(property: SchemaEntityProperty) {
    // Only sortable columns can be clicked
    if (property.sortable === false) {
      return;
    }

    const currentState = this.sortStateSignal();

    let newSort: string | null = null;
    let newDir: 'asc' | 'desc' | null = null;

    // Clicking a different column - start with asc
    if (currentState.column !== property.column_name) {
      newSort = property.column_name;
      newDir = 'asc';
    } else {
      // Clicking the same column - cycle through states
      if (currentState.direction === 'asc') {
        newSort = property.column_name;
        newDir = 'desc';
      } else if (currentState.direction === 'desc') {
        // Reset to unsorted
        newSort = null;
        newDir = null;
      }
    }

    // Navigate with new sort params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort: newSort,
        dir: newDir
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
