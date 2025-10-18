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

import { Component, inject, ViewChild, AfterViewInit, signal } from '@angular/core';

import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { SchemaService } from './services/schema.service';
import { VersionService } from './services/version.service';
import { Observable } from 'rxjs';
import { OpenAPIV2 } from 'openapi-types';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchemaEntityTable } from './interfaces/entity';
import { AuthService } from './services/auth.service';
import { DashboardSelectorComponent } from './components/dashboard-selector/dashboard-selector.component';

@Component({
    selector: 'app-root',
    imports: [
    RouterOutlet,
    CommonModule,
    FormsModule,
    DashboardSelectorComponent
],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit {
  private schema = inject(SchemaService);
  private version = inject(VersionService);
  private router = inject(Router);
  public auth = inject(AuthService);

  public drawerOpen: boolean = false;
  title = 'frontend';

  // Track if current route is a dashboard page (home or /dashboard/:id)
  isDashboardRoute = signal(false);

  // Initialize schema and version tracking on app startup
  private _schemaInit = this.schema.init();
  private _versionInit = this.version.init().subscribe();

  // Menu items exclude detected junction tables (accessible via direct URL)
  public menuItems$: Observable<SchemaEntityTable[] | undefined> = this.schema.getEntitiesForMenu();

  constructor() {
    // Check initial route
    this.checkIfDashboardRoute(this.router.url);

    // Listen for navigation events to update dashboard route status
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.checkIfDashboardRoute(event.urlAfterRedirects);
    });
  }

  /**
   * Check if the given URL is a dashboard route (home or /dashboard/:id)
   */
  private checkIfDashboardRoute(url: string): void {
    this.isDashboardRoute.set(
      url === '/' || url.startsWith('/dashboard')
    );
  }

  public navigateToHome() {
    this.router.navigate(['/']);
    this.drawerOpen = false;
  }

  public navigate(key: string) {
    this.router.navigate(['view', key]);
    this.drawerOpen = false;
  }

  public navigateToPermissions() {
    this.router.navigate(['permissions']);
    this.drawerOpen = false;
  }

  public navigateToEntityManagement() {
    this.router.navigate(['entity-management']);
    this.drawerOpen = false;
  }

  public navigateToPropertyManagement() {
    this.router.navigate(['property-management']);
    this.drawerOpen = false;
  }

  public navigateToSchemaErd() {
    this.router.navigate(['schema-erd']);
    this.drawerOpen = false;
  }

  /**
   * Check if a route is currently active
   * For entity routes, also matches create/edit pages for the same table
   */
  public isRouteActive(route: string): boolean {
    // Special case for home route - exact match only
    if (route === '/') {
      return this.router.url === '/' || this.router.url.startsWith('/dashboard');
    }

    // For entity view routes, also match create/edit for same table
    if (route.startsWith('/view/')) {
      const tableName = route.replace('/view/', '');
      return this.router.url === route ||
             this.router.url.startsWith(route + '/') ||
             this.router.url.startsWith('/create/' + tableName) ||
             this.router.url.startsWith('/edit/' + tableName + '/');
    }

    // For other routes, match exact or with trailing path
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }

  public getMenuKeys(menuItems: OpenAPIV2.DefinitionsObject | undefined) : string[] {
    if(menuItems) {
      return Object.keys(menuItems).sort();
    } else {
      return [];
    }
  }

  ngAfterViewInit(): void {
    // Listen for theme changes from DaisyUI theme-controller inputs
    // DaisyUI's theme-controller is CSS-only and doesn't update data-theme attribute
    // We need to manually update it so other components can react to theme changes
    const themeInputs = document.querySelectorAll<HTMLInputElement>('input.theme-controller');

    themeInputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          document.documentElement.setAttribute('data-theme', target.value);
        }
      });
    });
  }
}
