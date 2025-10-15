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

import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { createAuthGuard, AuthGuardData } from 'keycloak-angular';

/**
 * Authentication guard for routes that require a logged-in user.
 *
 * Prevents unauthenticated users from accessing Create/Edit pages,
 * triggering Keycloak login redirect instead. After successful login,
 * user is returned to the originally requested page.
 *
 * Uses keycloak-angular v20's createAuthGuard factory which properly
 * handles dependency injection context for guards.
 *
 * Usage:
 * { path: 'create/:entityKey', component: CreatePage, canActivate: [authGuard] }
 */
const isAccessAllowed = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  authData: AuthGuardData
): Promise<boolean> => {
  // Check if user is authenticated
  if (authData.authenticated) {
    return true;
  }

  // Not authenticated - redirect to Keycloak login
  // After successful login, user will be returned to the original URL
  await authData.keycloak.login({
    redirectUri: window.location.origin + state.url
  });

  return false;
};

export const authGuard: CanActivateFn = createAuthGuard<CanActivateFn>(isAccessAllowed);
