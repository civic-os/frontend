import { effect, inject, Injectable } from '@angular/core';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType, KeycloakService, ReadyArgs, typeEventArgs } from 'keycloak-angular';
import Keycloak from 'keycloak-js';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  authenticated = false;

  constructor(
    private data: DataService,
  ) {
    const keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);

    effect(() => {
      const keycloakEvent = keycloakSignal();

      if (keycloakEvent.type === KeycloakEventType.Ready) {
        this.authenticated = typeEventArgs<ReadyArgs>(keycloakEvent.args);

        if (this.authenticated) {
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
      }
    });
  }
  private readonly keycloak = inject(Keycloak);

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout();
  }
}
