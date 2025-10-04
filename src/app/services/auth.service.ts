import { effect, inject, Injectable } from '@angular/core';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType, KeycloakService, ReadyArgs, typeEventArgs } from 'keycloak-angular';
import Keycloak from 'keycloak-js';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  authenticated = false;
  userRoles: string[] = [];

  constructor(
    private data: DataService,
  ) {
    const keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);

    effect(() => {
      const keycloakEvent = keycloakSignal();

      if (keycloakEvent.type === KeycloakEventType.Ready) {
        this.authenticated = typeEventArgs<ReadyArgs>(keycloakEvent.args);

        if (this.authenticated) {
          this.loadUserRoles();
          this.data.refreshCurrentUser().subscribe({
            next: (result) => {
              if (result.success) {
                console.log('User data refreshed from JWT');
              } else {
                console.error('Failed to refresh user data:', result.error);
              }
            },
            error: (err) => console.error('Error refreshing user data:', err)
          });
        }
      }

      if (keycloakEvent.type === KeycloakEventType.AuthLogout) {
        this.authenticated = false;
        this.userRoles = [];
      }
    });
  }
  private readonly keycloak = inject(Keycloak);

  private loadUserRoles() {
    try {
      const tokenParsed = this.keycloak.tokenParsed;
      if (tokenParsed) {
        // Keycloak stores roles in different places depending on configuration
        // Try realm_access.roles first, then resource_access, then a custom 'roles' claim
        this.userRoles = tokenParsed['realm_access']?.['roles'] ||
                        tokenParsed['resource_access']?.['myclient']?.['roles'] ||
                        tokenParsed['roles'] ||
                        [];
      }
    } catch (error) {
      console.error('Error loading user roles:', error);
      this.userRoles = [];
    }
  }

  hasRole(roleName: string): boolean {
    return this.userRoles.includes(roleName);
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout();
  }
}
