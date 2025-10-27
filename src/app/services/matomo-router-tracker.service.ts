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
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AnalyticsService } from './analytics.service';

/**
 * Service to automatically track page views on router navigation.
 *
 * This service subscribes to Angular Router navigation events and
 * calls AnalyticsService.trackPageView() on each successful navigation.
 */
@Injectable({
  providedIn: 'root'
})
export class MatomoRouterTrackerService {
  private router = inject(Router);
  private analytics = inject(AnalyticsService);

  constructor() {
    // Subscribe to router navigation events
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        // Track page view with the new URL
        this.analytics.trackPageView(event.urlAfterRedirects);
      });
  }
}
