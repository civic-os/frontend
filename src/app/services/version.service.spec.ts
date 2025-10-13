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
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VersionService, CacheVersion } from './version.service';
import { environment } from '../../environments/environment';

describe('VersionService', () => {
  let service: VersionService;
  let httpMock: HttpTestingController;

  const mockVersions: CacheVersion[] = [
    { cache_name: 'entities', version: '2025-01-01T00:00:00Z' },
    { cache_name: 'properties', version: '2025-01-01T00:00:00Z' }
  ];

  const updatedEntitiesVersion: CacheVersion[] = [
    { cache_name: 'entities', version: '2025-01-02T00:00:00Z' },
    { cache_name: 'properties', version: '2025-01-01T00:00:00Z' }
  ];

  const updatedPropertiesVersion: CacheVersion[] = [
    { cache_name: 'entities', version: '2025-01-01T00:00:00Z' },
    { cache_name: 'properties', version: '2025-01-02T00:00:00Z' }
  ];

  const updatedBothVersions: CacheVersion[] = [
    { cache_name: 'entities', version: '2025-01-02T00:00:00Z' },
    { cache_name: 'properties', version: '2025-01-02T00:00:00Z' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        VersionService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(VersionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('init()', () => {
    it('should fetch and store versions from database', (done) => {
      service.init().subscribe(() => {
        const currentVersions = service.getCurrentVersions();
        expect(currentVersions.entities).toBe('2025-01-01T00:00:00Z');
        expect(currentVersions.properties).toBe('2025-01-01T00:00:00Z');
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      expect(req.request.method).toBe('GET');
      req.flush(mockVersions);
    });

    it('should initialize with null versions before init', () => {
      const currentVersions = service.getCurrentVersions();
      expect(currentVersions.entities).toBeNull();
      expect(currentVersions.properties).toBeNull();
    });
  });

  describe('checkForUpdates()', () => {
    beforeEach((done) => {
      // Initialize service with baseline versions
      service.init().subscribe(() => done());
      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(mockVersions);
    });

    it('should detect when entities cache changed', (done) => {
      service.checkForUpdates().subscribe(result => {
        expect(result.entitiesNeedsRefresh).toBe(true);
        expect(result.propertiesNeedsRefresh).toBe(false);
        expect(result.hasChanges).toBe(true);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(updatedEntitiesVersion);
    });

    it('should detect when properties cache changed', (done) => {
      service.checkForUpdates().subscribe(result => {
        expect(result.entitiesNeedsRefresh).toBe(false);
        expect(result.propertiesNeedsRefresh).toBe(true);
        expect(result.hasChanges).toBe(true);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(updatedPropertiesVersion);
    });

    it('should detect when both caches changed', (done) => {
      service.checkForUpdates().subscribe(result => {
        expect(result.entitiesNeedsRefresh).toBe(true);
        expect(result.propertiesNeedsRefresh).toBe(true);
        expect(result.hasChanges).toBe(true);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(updatedBothVersions);
    });

    it('should return no changes when versions are identical', (done) => {
      service.checkForUpdates().subscribe(result => {
        expect(result.entitiesNeedsRefresh).toBe(false);
        expect(result.propertiesNeedsRefresh).toBe(false);
        expect(result.hasChanges).toBe(false);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(mockVersions);
    });

    it('should update local versions after check', (done) => {
      service.checkForUpdates().subscribe(() => {
        const currentVersions = service.getCurrentVersions();
        expect(currentVersions.entities).toBe('2025-01-02T00:00:00Z');
        expect(currentVersions.properties).toBe('2025-01-02T00:00:00Z');
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(updatedBothVersions);
    });
  });

  describe('reset()', () => {
    it('should clear cached versions', (done) => {
      // Initialize first
      service.init().subscribe(() => {
        // Verify versions are set
        let currentVersions = service.getCurrentVersions();
        expect(currentVersions.entities).toBe('2025-01-01T00:00:00Z');
        expect(currentVersions.properties).toBe('2025-01-01T00:00:00Z');

        // Reset
        service.reset();

        // Verify versions are cleared
        currentVersions = service.getCurrentVersions();
        expect(currentVersions.entities).toBeNull();
        expect(currentVersions.properties).toBeNull();
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(mockVersions);
    });
  });

  describe('getCurrentVersions()', () => {
    it('should return null versions before initialization', () => {
      const versions = service.getCurrentVersions();
      expect(versions.entities).toBeNull();
      expect(versions.properties).toBeNull();
    });

    it('should return stored versions after initialization', (done) => {
      service.init().subscribe(() => {
        const versions = service.getCurrentVersions();
        expect(versions.entities).toBe('2025-01-01T00:00:00Z');
        expect(versions.properties).toBe('2025-01-01T00:00:00Z');
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'schema_cache_versions');
      req.flush(mockVersions);
    });
  });
});
