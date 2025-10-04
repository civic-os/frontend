import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PermissionsService, Role, RolePermission } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';

interface PermissionMatrix {
  tableName: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

@Component({
  selector: 'app-permissions',
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions.page.html',
  styleUrl: './permissions.page.css'
})
export class PermissionsPage {
  private permissionsService = inject(PermissionsService);
  public auth = inject(AuthService);

  // Use signals for reactive state in zoneless mode
  roles = signal<Role[]>([]);
  selectedRoleId = signal<number | undefined>(undefined);
  permissionMatrix = signal<PermissionMatrix[]>([]);
  loading = signal(true);
  error = signal<string | undefined>(undefined);
  isAdmin = signal(false);
  permissionTypes = ['create', 'read', 'update', 'delete'];

  constructor() {
    this.checkAdminAndLoadData();
  }

  private checkAdminAndLoadData() {
    this.permissionsService.isAdmin().subscribe({
      next: (isAdmin) => {
        this.isAdmin.set(isAdmin);
        if (isAdmin) {
          this.loadRoles();
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

  private loadRoles() {
    this.permissionsService.getRoles().subscribe({
      next: (rolesData) => {
        this.roles.set(rolesData);
        if (rolesData.length > 0) {
          this.selectedRoleId.set(rolesData[0].id);
          this.loadPermissions();
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set('Failed to load roles');
        this.loading.set(false);
      }
    });
  }

  onRoleChange() {
    this.loadPermissions();
  }

  private loadPermissions() {
    const roleId = this.selectedRoleId();
    if (roleId === undefined) return;

    this.loading.set(true);
    forkJoin({
      tables: this.permissionsService.getTables(),
      permissions: this.permissionsService.getRolePermissions(roleId)
    }).subscribe({
      next: ({ tables, permissions }) => {
        this.buildPermissionMatrix(tables, permissions);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load permissions');
        this.loading.set(false);
      }
    });
  }

  private buildPermissionMatrix(tables: string[], permissions: RolePermission[]) {
    const matrix = tables.map(tableName => {
      const tablePerms = permissions.filter(p => p.table_name === tableName);
      return {
        tableName,
        create: tablePerms.find(p => p.permission_type === 'create')?.has_permission || false,
        read: tablePerms.find(p => p.permission_type === 'read')?.has_permission || false,
        update: tablePerms.find(p => p.permission_type === 'update')?.has_permission || false,
        delete: tablePerms.find(p => p.permission_type === 'delete')?.has_permission || false
      };
    });
    this.permissionMatrix.set(matrix);
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
          // Update local matrix using signal update
          this.permissionMatrix.update(matrix => {
            const updated = [...matrix];
            const row = updated.find(r => r.tableName === tableName);
            if (row) {
              (row as any)[permission] = newValue;
            }
            return updated;
          });
        } else {
          this.error.set(response.error?.humanMessage || 'Failed to update permission');
        }
      },
      error: (err) => {
        this.error.set('Failed to update permission');
      }
    });
  }
}
