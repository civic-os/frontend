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

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { Location } from '@angular/common';

describe('AppComponent', () => {
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['isAdmin', 'hasRole', 'authenticated'], {
      userRoles: []
    });
    mockAuthService.authenticated.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    // Clean up data-theme attribute to prevent test pollution
    document.documentElement.removeAttribute('data-theme');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Handle HTTP requests made during component initialization (may be multiple)
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));

    // Handle version check request (VersionService.init())
    const versionReqs = httpMock.match(req => req.url.includes('schema_cache_versions'));
    versionReqs.forEach(req => req.flush([
      { cache_name: 'entities', version: '2025-01-01T00:00:00Z' },
      { cache_name: 'properties', version: '2025-01-01T00:00:00Z' }
    ]));

    // Handle dashboard requests from DashboardSelectorComponent
    const dashboardReqs = httpMock.match(req => req.url.includes('rpc/get_dashboards'));
    dashboardReqs.forEach(req => req.flush([]));

    expect(app).toBeTruthy();
  });

  it(`should have the 'frontend' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Handle HTTP requests made during component initialization (may be multiple)
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));

    // Handle version check request (VersionService.init())
    const versionReqs = httpMock.match(req => req.url.includes('schema_cache_versions'));
    versionReqs.forEach(req => req.flush([
      { cache_name: 'entities', version: '2025-01-01T00:00:00Z' },
      { cache_name: 'properties', version: '2025-01-01T00:00:00Z' }
    ]));

    // Handle dashboard requests from DashboardSelectorComponent
    const dashboardReqs = httpMock.match(req => req.url.includes('rpc/get_dashboards'));
    dashboardReqs.forEach(req => req.flush([]));

    expect(app.title).toEqual('frontend');
  });

  it('should update data-theme attribute when theme-controller input changes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Create mock theme-controller inputs in the DOM
    const themeInput = document.createElement('input');
    themeInput.type = 'radio';
    themeInput.className = 'theme-controller';
    themeInput.value = 'dark';
    document.body.appendChild(themeInput);

    // Trigger change detection to run ngAfterViewInit
    fixture.detectChanges();

    // Handle HTTP requests made during component initialization
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));
    const schemaPropsReqs = httpMock.match(req => req.url.includes('schema_properties'));
    schemaPropsReqs.forEach(req => req.flush([]));

    // Handle version check request (VersionService.init())
    const versionReqs = httpMock.match(req => req.url.includes('schema_cache_versions'));
    versionReqs.forEach(req => req.flush([
      { cache_name: 'entities', version: '2025-01-01T00:00:00Z' },
      { cache_name: 'properties', version: '2025-01-01T00:00:00Z' }
    ]));

    // Handle dashboard requests from DashboardSelectorComponent
    const dashboardReqs = httpMock.match(req => req.url.includes('rpc/get_dashboards'));
    dashboardReqs.forEach(req => req.flush([]));

    // Simulate theme change
    themeInput.checked = true;
    themeInput.dispatchEvent(new Event('change'));

    // Verify data-theme attribute was updated
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Cleanup
    document.body.removeChild(themeInput);
  });

  /**
   * Helper to create component with specific initial router URL
   */
  function createComponentWithUrl(url: string) {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue(url);

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Handle HTTP requests
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));
    const versionReqs = httpMock.match(req => req.url.includes('schema_cache_versions'));
    versionReqs.forEach(req => req.flush([
      { cache_name: 'entities', version: '2025-01-01T00:00:00Z' },
      { cache_name: 'properties', version: '2025-01-01T00:00:00Z' }
    ]));
    const dashboardReqs = httpMock.match(req => req.url.includes('rpc/get_dashboards'));
    dashboardReqs.forEach(req => req.flush([]));

    return { fixture, app };
  }

  describe('isDashboardRoute detection', () => {

    it('should set isDashboardRoute to true when on home page', () => {
      const { app } = createComponentWithUrl('/');
      expect(app.isDashboardRoute()).toBe(true);
    });

    it('should set isDashboardRoute to true when on dashboard page', () => {
      const { app } = createComponentWithUrl('/dashboard/42');
      expect(app.isDashboardRoute()).toBe(true);
    });

    it('should set isDashboardRoute to false when on entity list page', () => {
      const { app } = createComponentWithUrl('/view/issues');
      expect(app.isDashboardRoute()).toBe(false);
    });

    it('should set isDashboardRoute to false when on management page', () => {
      const { app } = createComponentWithUrl('/entity-management');
      expect(app.isDashboardRoute()).toBe(false);
    });

    it('should set isDashboardRoute to false when on detail page', () => {
      const { app } = createComponentWithUrl('/view/issues/123');
      expect(app.isDashboardRoute()).toBe(false);
    });

    it('should set isDashboardRoute to false when on edit page', () => {
      const { app } = createComponentWithUrl('/edit/issues/123');
      expect(app.isDashboardRoute()).toBe(false);
    });
  });

  describe('isRouteActive', () => {
    describe('Home route', () => {
      it('should match home page', () => {
        const { app } = createComponentWithUrl('/');
        expect(app.isRouteActive('/')).toBe(true);
      });

      it('should match dashboard pages', () => {
        const { app } = createComponentWithUrl('/dashboard/42');
        expect(app.isRouteActive('/')).toBe(true);
      });

      it('should not match other routes', () => {
        const { app } = createComponentWithUrl('/view/issues');
        expect(app.isRouteActive('/')).toBe(false);
      });
    });

    describe('Entity routes', () => {
      it('should match list page (exact)', () => {
        const { app } = createComponentWithUrl('/view/issues');
        expect(app.isRouteActive('/view/issues')).toBe(true);
      });

      it('should match detail page (with ID)', () => {
        const { app } = createComponentWithUrl('/view/issues/123');
        expect(app.isRouteActive('/view/issues')).toBe(true);
      });

      it('should match create page for same entity', () => {
        const { app } = createComponentWithUrl('/create/issues');
        expect(app.isRouteActive('/view/issues')).toBe(true);
      });

      it('should match edit page for same entity', () => {
        const { app } = createComponentWithUrl('/edit/issues/123');
        expect(app.isRouteActive('/view/issues')).toBe(true);
      });

      it('should not match different entity', () => {
        const { app } = createComponentWithUrl('/view/users');
        expect(app.isRouteActive('/view/issues')).toBe(false);
      });

      it('should not match different entity create page', () => {
        const { app } = createComponentWithUrl('/create/users');
        expect(app.isRouteActive('/view/issues')).toBe(false);
      });

      it('should not match different entity edit page', () => {
        const { app } = createComponentWithUrl('/edit/users/456');
        expect(app.isRouteActive('/view/issues')).toBe(false);
      });
    });

    describe('Admin routes', () => {
      it('should match schema-erd page', () => {
        const { app } = createComponentWithUrl('/schema-erd');
        expect(app.isRouteActive('/schema-erd')).toBe(true);
      });

      it('should match entity-management page', () => {
        const { app } = createComponentWithUrl('/entity-management');
        expect(app.isRouteActive('/entity-management')).toBe(true);
      });

      it('should match property-management page', () => {
        const { app } = createComponentWithUrl('/property-management');
        expect(app.isRouteActive('/property-management')).toBe(true);
      });

      it('should match permissions page', () => {
        const { app } = createComponentWithUrl('/permissions');
        expect(app.isRouteActive('/permissions')).toBe(true);
      });

      it('should not match partial admin route names', () => {
        const { app } = createComponentWithUrl('/permissions');
        expect(app.isRouteActive('/entity-management')).toBe(false);
      });
    });
  });
});
