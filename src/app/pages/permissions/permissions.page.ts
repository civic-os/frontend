import { Component, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule],
  templateUrl: './permissions.page.html',
  styleUrl: './permissions.page.css'
})
export class PermissionsPage {
  private permissionsService = inject(PermissionsService);
  public auth = inject(AuthService);

  roles: Role[] = [];
  selectedRoleId?: number;
  permissionMatrix: PermissionMatrix[] = [];
  loading = true;
  error?: string;
  isAdmin = false;
  permissionTypes = ['create', 'read', 'update', 'delete'];

  constructor() {
    this.checkAdminAndLoadData();
  }

  private checkAdminAndLoadData() {
    this.permissionsService.isAdmin().subscribe({
      next: (isAdmin) => {
        this.isAdmin = isAdmin;
        if (isAdmin) {
          this.loadRoles();
        } else {
          this.error = 'Admin access required';
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = 'Failed to verify admin access';
        this.loading = false;
      }
    });
  }

  private loadRoles() {
    this.permissionsService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        if (roles.length > 0) {
          this.selectedRoleId = roles[0].id;
          this.loadPermissions();
        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = 'Failed to load roles';
        this.loading = false;
      }
    });
  }

  onRoleChange() {
    this.loadPermissions();
  }

  private loadPermissions() {
    if (this.selectedRoleId === undefined) return;

    this.loading = true;
    forkJoin({
      tables: this.permissionsService.getTables(),
      permissions: this.permissionsService.getRolePermissions(this.selectedRoleId)
    }).subscribe({
      next: ({ tables, permissions }) => {
        this.buildPermissionMatrix(tables, permissions);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load permissions';
        this.loading = false;
      }
    });
  }

  private buildPermissionMatrix(tables: string[], permissions: RolePermission[]) {
    this.permissionMatrix = tables.map(tableName => {
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
    if (this.selectedRoleId === undefined) return;

    const newValue = !currentValue;

    this.permissionsService.setRolePermission(
      this.selectedRoleId,
      tableName,
      permission,
      newValue
    ).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local matrix
          const row = this.permissionMatrix.find(r => r.tableName === tableName);
          if (row) {
            (row as any)[permission] = newValue;
          }
        } else {
          this.error = response.error?.humanMessage || 'Failed to update permission';
        }
      },
      error: (err) => {
        this.error = 'Failed to update permission';
      }
    });
  }
}
