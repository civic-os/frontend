import { Component, inject, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PermissionsService, Role, RolePermission } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin, of, switchMap, map, catchError, BehaviorSubject, take } from 'rxjs';

interface PermissionMatrix {
  tableName: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

interface PermissionsData {
  roles: Role[];
  permissionMatrix: PermissionMatrix[];
  loading: boolean;
  error?: string;
}

@Component({
  selector: 'app-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions.page.html',
  styleUrl: './permissions.page.css'
})
export class PermissionsPage {
  private permissionsService = inject(PermissionsService);
  public auth = inject(AuthService);

  permissionTypes = ['create', 'read', 'update', 'delete'];

  // Check if user is admin
  isAdmin = toSignal(
    this.permissionsService.isAdmin().pipe(
      catchError(() => of(false))
    ),
    { initialValue: false }
  );

  // Track selected role ID (user input)
  selectedRoleId = signal<number | undefined>(undefined);

  // Create a subject to trigger permission reloads
  private selectedRoleIdSubject = new BehaviorSubject<number | undefined>(undefined);

  // Load all data reactively
  private data = toSignal(
    this.permissionsService.isAdmin().pipe(
      switchMap(isAdmin => {
        if (!isAdmin) {
          return of({
            roles: [],
            permissionMatrix: [],
            loading: false,
            error: 'Admin access required'
          } as PermissionsData);
        }

        // Load roles first
        return this.permissionsService.getRoles().pipe(
          switchMap(roles => {
            if (roles.length === 0) {
              return of({
                roles: [],
                permissionMatrix: [],
                loading: false
              } as PermissionsData);
            }

            // Auto-select first role
            const firstRoleId = roles[0].id;
            this.selectedRoleId.set(firstRoleId);
            this.selectedRoleIdSubject.next(firstRoleId);

            // Load permissions for selected role
            return this.selectedRoleIdSubject.pipe(
              switchMap(roleId => {
                if (roleId === undefined) {
                  return of({ roles, permissionMatrix: [], loading: false } as PermissionsData);
                }

                return forkJoin({
                  tables: this.permissionsService.getTables().pipe(take(1)),
                  permissions: this.permissionsService.getRolePermissions(roleId).pipe(take(1))
                }).pipe(
                  map(({ tables, permissions }) => {
                    const matrix = this.buildPermissionMatrix(tables, permissions);
                    return {
                      roles,
                      permissionMatrix: matrix,
                      loading: false
                    } as PermissionsData;
                  }),
                  catchError(() => of({
                    roles,
                    permissionMatrix: [],
                    loading: false,
                    error: 'Failed to load permissions'
                  } as PermissionsData))
                );
              })
            );
          }),
          catchError(() => of({
            roles: [],
            permissionMatrix: [],
            loading: false,
            error: 'Failed to load roles'
          } as PermissionsData))
        );
      }),
      catchError(() => of({
        roles: [],
        permissionMatrix: [],
        loading: false,
        error: 'Failed to verify admin access'
      } as PermissionsData))
    ),
    { initialValue: { roles: [], permissionMatrix: [], loading: true } as PermissionsData }
  );

  // Expose computed signals for template
  roles = computed(() => this.data()?.roles || []);
  permissionMatrix = computed(() => this.data()?.permissionMatrix || []);
  loading = computed(() => this.data()?.loading ?? true);
  error = computed(() => this.data()?.error);

  onRoleChange(newRoleId: number) {
    this.selectedRoleId.set(newRoleId);
    this.selectedRoleIdSubject.next(newRoleId);
  }

  private buildPermissionMatrix(tables: string[], permissions: RolePermission[]): PermissionMatrix[] {
    return tables.map(tableName => {
      const tablePerms = permissions.filter(p => p.table_name === tableName);
      return {
        tableName,
        create: tablePerms.find(p => p.permission_type === 'create')?.has_permission || false,
        read: tablePerms.find(p => p.permission_type === 'read')?.has_permission || false,
        update: tablePerms.find(p => p.permission_type === 'update')?.has_permission || false,
        delete: tablePerms.find(p => p.permission_type === 'delete')?.has_permission || false
      };
    });
  }

  togglePermission(tableName: string, permission: string, currentValue: boolean) {
    const roleId = this.selectedRoleId();
    if (roleId === undefined) return;

    const newValue = !currentValue;

    this.permissionsService.setRolePermission(
      roleId,
      tableName,
      permission,
      newValue
    ).subscribe({
      next: (response) => {
        if (response.success) {
          // Reload permissions to get fresh data
          this.selectedRoleIdSubject.next(roleId);
        } else {
          // Could use a separate error signal here
          console.error('Failed to update permission:', response.error);
        }
      },
      error: (err) => {
        console.error('Failed to update permission:', err);
      }
    });
  }
}
