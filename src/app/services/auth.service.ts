import { effect, inject, Injectable } from '@angular/core';
import { KEYCLOAK_EVENT_SIGNAL, KeycloakEventType, KeycloakService, ReadyArgs, typeEventArgs } from 'keycloak-angular';
import Keycloak from 'keycloak-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  authenticated = false;

  constructor(
    // private readonly keycloak: KeycloakService
  ) {
    const keycloakSignal = inject(KEYCLOAK_EVENT_SIGNAL);

    effect(() => {
      const keycloakEvent = keycloakSignal();

      if (keycloakEvent.type === KeycloakEventType.Ready) {
        this.authenticated = typeEventArgs<ReadyArgs>(keycloakEvent.args);
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
