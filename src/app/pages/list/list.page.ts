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
import { Observable, map, mergeMap, of, combineLatest, debounceTime, distinctUntilChanged, take, tap, shareReplay } from 'rxjs';
import { SchemaService } from '../../services/schema.service';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { DataService } from '../../services/data.service';
import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';

@Component({
    selector: 'app-view',
    templateUrl: './list.page.html',
    styleUrl: './list.page.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    DisplayPropertyComponent
]
})
export class ListPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private schema = inject(SchemaService);
  private data = inject(DataService);

  public entityKey?: string;
  public searchControl = new FormControl('');
  public searchQuery = signal<string>('');
  public isLoading = signal<boolean>(false);
  public sortState = signal<{ column: string | null, direction: 'asc' | 'desc' | null }>({
    column: null,
    direction: null
  });

  public entity$: Observable<SchemaEntityTable | undefined> = this.route.params.pipe(mergeMap(p => {
    this.entityKey = p['entityKey'];
    if(p['entityKey']) {
      return this.schema.getEntity(p['entityKey']);
    } else {
      return of(undefined);
    }
  }));

  public properties$: Observable<SchemaEntityProperty[]> = this.entity$.pipe(mergeMap(e => {
    if(e) {
      let props = this.schema.getPropsForList(e);
      return props;
    } else {
      return of([]);
    }
  }));

  public data$: Observable<any> = combineLatest([
    this.properties$,
    toObservable(this.searchQuery),
    toObservable(this.sortState)
  ]).pipe(
    tap(() => this.isLoading.set(true)),
    mergeMap(([props, search, sortState]) => {
      if(props && props.length > 0 && this.entityKey) {
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

        return this.data.getData({
          key: this.entityKey,
          fields: columns,
          searchQuery: search || undefined,
          orderField: orderField,
          orderDirection: sortState.direction || undefined
        });
      } else {
        return of([]);
      }
    }),
    tap(() => this.isLoading.set(false)),
    shareReplay(1)
  );

  // Convert data$ observable to signal for use in computed
  public dataSignal = toSignal(this.data$, { initialValue: [] });

  // Extract search terms for highlighting
  public searchTerms = computed(() => {
    const query = this.searchQuery();
    if (!query || !query.trim()) {
      return [];
    }
    // Split on whitespace and remove empty strings
    return query.trim().split(/\s+/).filter(term => term.length > 0);
  });

  // Count of search results
  public resultCount = computed(() => this.dataSignal().length);

  ngOnInit() {
    // Initialize search and sort from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params['q']) {
        this.searchControl.setValue(params['q'], { emitEvent: false });
        this.searchQuery.set(params['q']);
      }
      if (params['sort']) {
        this.sortState.set({
          column: params['sort'],
          direction: params['dir'] || 'asc'
        });
      }
    });

    // Debounce search input (300ms) and update URL
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.searchQuery.set(value || '');
        this.updateQueryParams();
      });
  }

  private updateQueryParams() {
    const sortState = this.sortState();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery() || null,
        sort: sortState.column || null,
        dir: sortState.direction || null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public clearSearch() {
    this.searchControl.setValue('');
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

    const currentState = this.sortState();

    // Clicking a different column - start with asc
    if (currentState.column !== property.column_name) {
      this.sortState.set({
        column: property.column_name,
        direction: 'asc'
      });
    } else {
      // Clicking the same column - cycle through states
      if (currentState.direction === 'asc') {
        this.sortState.set({
          column: property.column_name,
          direction: 'desc'
        });
      } else if (currentState.direction === 'desc') {
        // Reset to unsorted
        this.sortState.set({
          column: null,
          direction: null
        });
      }
    }

    this.updateQueryParams();
  }
}
