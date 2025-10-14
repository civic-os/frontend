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
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SchemaService } from './schema.service';
import { ApiResponse } from '../interfaces/api';
import { catchError, map, of } from 'rxjs';

export interface Role {
  id: number;
  display_name: string;
  description?: string;
}

export interface RolePermission {
  role_id: number;
  role_name: string;
  table_name: string;
  permission_type: string;
  has_permission: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private http = inject(HttpClient);
  private schema = inject(SchemaService);

  getRoles(): Observable<Role[]> {
    return this.http.post<Role[]>(
      environment.postgrestUrl + 'rpc/get_roles',
      {}
    ).pipe(
      catchError((error) => {
        console.error('Error fetching roles:', error);
        return of([]);
      })
    );
  }

  getTables(): Observable<string[]> {
    return this.schema.getEntities().pipe(
      map(entities => entities ? entities.map(e => e.table_name) : [])
    );
  }

  getRolePermissions(roleId?: number): Observable<RolePermission[]> {
    const body = roleId !== undefined ? { p_role_id: roleId } : {};
    return this.http.post<any[]>(
      environment.postgrestUrl + 'rpc/get_role_permissions',
      body
    ).pipe(
      map(permissions => permissions.map(p => ({
        ...p,
        // Convert PostgreSQL boolean (t/f string) to JavaScript boolean
        has_permission: p.has_permission === true || p.has_permission === 't' || p.has_permission === 'true'
      }))),
      catchError((error) => {
        console.error('Error fetching role permissions:', error);
        return of([]);
      })
    );
  }

  setRolePermission(roleId: number, tableName: string, permission: string, enabled: boolean): Observable<ApiResponse> {
    return this.http.post(
      environment.postgrestUrl + 'rpc/set_role_permission',
      {
        p_role_id: roleId,
        p_table_name: tableName,
        p_permission: permission,
        p_enabled: enabled
      }
    ).pipe(
      map((response: any) => {
        if (response?.success === false) {
          return <ApiResponse>{
            success: false,
            error: { message: response.error, humanMessage: response.error }
          };
        }
        return <ApiResponse>{ success: true };
      }),
      catchError((error) => {
        return of(<ApiResponse>{
          success: false,
          error: { message: error.message, humanMessage: 'Failed to update permission' }
        });
      })
    );
  }

  isAdmin(): Observable<boolean> {
    return this.http.post<boolean>(
      environment.postgrestUrl + 'rpc/is_admin',
      {}
    ).pipe(
      catchError(() => of(false))
    );
  }

  createRole(displayName: string, description?: string): Observable<ApiResponse & { roleId?: number }> {
    return this.http.post<any>(
      environment.postgrestUrl + 'rpc/create_role',
      {
        p_display_name: displayName,
        p_description: description || null
      }
    ).pipe(
      map((response) => {
        if (response?.success === false) {
          return {
            success: false,
            error: { message: response.error, humanMessage: response.error }
          };
        }
        return {
          success: true,
          roleId: response.role_id
        };
      }),
      catchError((error) => {
        return of({
          success: false,
          error: { message: error.message, humanMessage: 'Failed to create role' }
        });
      })
    );
  }
}
