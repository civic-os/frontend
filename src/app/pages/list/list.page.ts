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
import { SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
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
    toObservable(this.searchQuery)
  ]).pipe(
    tap(() => this.isLoading.set(true)),
    mergeMap(([props, search]) => {
      if(props && props.length > 0 && this.entityKey) {
        let columns = props
          .map(x => SchemaService.propertyToSelectString(x));
        return this.data.getData({
          key: this.entityKey,
          fields: columns,
          searchQuery: search || undefined
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
    // Initialize search from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params['q']) {
        this.searchControl.setValue(params['q'], { emitEvent: false });
        this.searchQuery.set(params['q']);
      }
    });

    // Debounce search input (300ms) and update URL
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.searchQuery.set(value || '');
        this.updateQueryParams(value || '');
      });
  }

  private updateQueryParams(search: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: search || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public clearSearch() {
    this.searchControl.setValue('');
  }
}
