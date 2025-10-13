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

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CacheVersion {
  cache_name: 'entities' | 'properties';
  version: string; // ISO timestamp
}

export interface CacheUpdateCheck {
  entitiesNeedsRefresh: boolean;
  propertiesNeedsRefresh: boolean;
  hasChanges: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private http = inject(HttpClient);

  // In-memory cache versions
  private entitiesVersion: string | null = null;
  private propertiesVersion: string | null = null;

  /**
   * Initialize version tracking by fetching current versions from database.
   * Should be called once on app initialization.
   */
  public init(): Observable<void> {
    return this.fetchVersions().pipe(
      map(versions => {
        this.updateLocalVersions(versions);
      })
    );
  }

  /**
   * Check if any caches need to be refreshed.
   * Compares current database versions with locally stored versions.
   *
   * @returns Observable with flags indicating which caches need refresh
   */
  public checkForUpdates(): Observable<CacheUpdateCheck> {
    return this.fetchVersions().pipe(
      map(versions => {
        const result: CacheUpdateCheck = {
          entitiesNeedsRefresh: false,
          propertiesNeedsRefresh: false,
          hasChanges: false
        };

        const dbEntitiesVersion = versions.find(v => v.cache_name === 'entities')?.version;
        const dbPropertiesVersion = versions.find(v => v.cache_name === 'properties')?.version;

        // Check entities cache
        if (dbEntitiesVersion && this.entitiesVersion && dbEntitiesVersion !== this.entitiesVersion) {
          result.entitiesNeedsRefresh = true;
          result.hasChanges = true;
        }

        // Check properties cache
        if (dbPropertiesVersion && this.propertiesVersion && dbPropertiesVersion !== this.propertiesVersion) {
          result.propertiesNeedsRefresh = true;
          result.hasChanges = true;
        }

        // Update local versions after check
        this.updateLocalVersions(versions);

        return result;
      })
    );
  }

  /**
   * Get current versions from database.
   * @returns Observable of cache versions array
   */
  private fetchVersions(): Observable<CacheVersion[]> {
    return this.http.get<CacheVersion[]>(
      environment.postgrestUrl + 'schema_cache_versions'
    );
  }

  /**
   * Update locally stored versions from database response.
   */
  private updateLocalVersions(versions: CacheVersion[]): void {
    const entitiesVersion = versions.find(v => v.cache_name === 'entities');
    const propertiesVersion = versions.find(v => v.cache_name === 'properties');

    if (entitiesVersion) {
      this.entitiesVersion = entitiesVersion.version;
    }

    if (propertiesVersion) {
      this.propertiesVersion = propertiesVersion.version;
    }
  }

  /**
   * Reset version tracking (useful for testing or forced refresh).
   */
  public reset(): void {
    this.entitiesVersion = null;
    this.propertiesVersion = null;
  }

  /**
   * Get current stored versions (for debugging).
   */
  public getCurrentVersions(): { entities: string | null; properties: string | null } {
    return {
      entities: this.entitiesVersion,
      properties: this.propertiesVersion
    };
  }
}
