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

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiResponse } from '../interfaces/api';
import { getPostgrestUrl } from '../config/runtime';

export interface PropertyMetadata {
  table_name: string;
  column_name: string;
  display_name: string | null;
  description: string | null;
  sort_order: number | null;
  column_width: number | null;
  sortable: boolean;
  filterable: boolean;
  show_on_list: boolean;
  show_on_create: boolean;
  show_on_edit: boolean;
  show_on_detail: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PropertyManagementService {
  private http = inject(HttpClient);

  /**
   * Upsert property metadata (insert or update)
   * Uses RPC function in public schema
   */
  upsertPropertyMetadata(
    tableName: string,
    columnName: string,
    displayName: string | null,
    description: string | null,
    sortOrder: number | null,
    columnWidth: number | null,
    sortable: boolean,
    filterable: boolean,
    showOnList: boolean,
    showOnCreate: boolean,
    showOnEdit: boolean,
    showOnDetail: boolean
  ): Observable<ApiResponse> {
    return this.http.post(
      getPostgrestUrl() + 'rpc/upsert_property_metadata',
      {
        p_table_name: tableName,
        p_column_name: columnName,
        p_display_name: displayName,
        p_description: description,
        p_sort_order: sortOrder,
        p_column_width: columnWidth,
        p_sortable: sortable,
        p_filterable: filterable,
        p_show_on_list: showOnList,
        p_show_on_create: showOnCreate,
        p_show_on_edit: showOnEdit,
        p_show_on_detail: showOnDetail
      }
    ).pipe(
      map((response: any) => <ApiResponse>{ success: true, body: response }),
      catchError((error) => {
        console.error('Error upserting property metadata:', error);
        return of(<ApiResponse>{
          success: false,
          error: { message: error.message, humanMessage: 'Failed to save property metadata' }
        });
      })
    );
  }

  /**
   * Batch update properties order after drag-drop
   * Updates sort_order for multiple properties using RPC
   */
  updatePropertiesOrder(properties: { table_name: string, column_name: string, sort_order: number }[]): Observable<ApiResponse> {
    // Call RPC function for each property and use forkJoin to wait for all
    const updates = properties.map(property =>
      this.http.post(
        getPostgrestUrl() + 'rpc/update_property_sort_order',
        {
          p_table_name: property.table_name,
          p_column_name: property.column_name,
          p_sort_order: property.sort_order
        }
      )
    );

    if (updates.length === 0) {
      return of(<ApiResponse>{ success: true });
    }

    return forkJoin(updates).pipe(
      map(() => <ApiResponse>{ success: true }),
      catchError((error) => {
        console.error('Error updating properties order:', error);
        return of(<ApiResponse>{
          success: false,
          error: { message: error.message, humanMessage: 'Failed to update properties order' }
        });
      })
    );
  }

  /**
   * Check if current user is admin (reuse from EntityManagementService pattern)
   */
  isAdmin(): Observable<boolean> {
    return this.http.post<boolean>(
      getPostgrestUrl() + 'rpc/is_admin',
      {}
    ).pipe(
      catchError(() => of(false))
    );
  }
}
