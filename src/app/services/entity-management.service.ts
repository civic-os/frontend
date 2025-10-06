import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api';

export interface EntityMetadata {
  table_name: string;
  display_name: string | null;
  description: string | null;
  sort_order: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class EntityManagementService {
  private http = inject(HttpClient);

  /**
   * Upsert entity metadata (insert or update)
   * Uses RPC function in public schema
   */
  upsertEntityMetadata(
    tableName: string,
    displayName: string | null,
    description: string | null,
    sortOrder: number | null
  ): Observable<ApiResponse> {
    return this.http.post(
      environment.postgrestUrl + 'rpc/upsert_entity_metadata',
      {
        p_table_name: tableName,
        p_display_name: displayName,
        p_description: description,
        p_sort_order: sortOrder
      }
    ).pipe(
      map((response: any) => <ApiResponse>{ success: true, body: response }),
      catchError((error) => {
        console.error('Error upserting entity metadata:', error);
        return of(<ApiResponse>{
          success: false,
          error: { message: error.message, humanMessage: 'Failed to save entity metadata' }
        });
      })
    );
  }

  /**
   * Batch update entities order after drag-drop
   * Updates sort_order for multiple entities using RPC
   */
  updateEntitiesOrder(entities: { table_name: string, sort_order: number }[]): Observable<ApiResponse> {
    // Call RPC function for each entity and use forkJoin to wait for all
    const updates = entities.map(entity =>
      this.http.post(
        environment.postgrestUrl + 'rpc/update_entity_sort_order',
        {
          p_table_name: entity.table_name,
          p_sort_order: entity.sort_order
        }
      )
    );

    if (updates.length === 0) {
      return of(<ApiResponse>{ success: true });
    }

    return forkJoin(updates).pipe(
      map(() => <ApiResponse>{ success: true }),
      catchError((error) => {
        console.error('Error updating entities order:', error);
        return of(<ApiResponse>{
          success: false,
          error: { message: error.message, humanMessage: 'Failed to update entities order' }
        });
      })
    );
  }

  /**
   * Check if current user is admin (reuse from PermissionsService pattern)
   */
  isAdmin(): Observable<boolean> {
    return this.http.post<boolean>(
      environment.postgrestUrl + 'rpc/is_admin',
      {}
    ).pipe(
      catchError(() => of(false))
    );
  }
}
