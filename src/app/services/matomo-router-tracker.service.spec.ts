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
import { Router, NavigationEnd, NavigationStart, NavigationCancel, NavigationError } from '@angular/router';
import { Subject } from 'rxjs';
import { MatomoRouterTrackerService } from './matomo-router-tracker.service';
import { AnalyticsService } from './analytics.service';

describe('MatomoRouterTrackerService', () => {
  let service: MatomoRouterTrackerService;
  let mockAnalytics: jasmine.SpyObj<AnalyticsService>;
  let routerEventsSubject: Subject<any>;

  beforeEach(() => {
    // Create mock AnalyticsService
    mockAnalytics = jasmine.createSpyObj('AnalyticsService', ['trackPageView']);

    // Create a Subject to simulate router events
    routerEventsSubject = new Subject();

    // Mock Router with events observable
    const mockRouter = {
      events: routerEventsSubject.asObservable()
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MatomoRouterTrackerService,
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: Router, useValue: mockRouter }
      ]
    });

    service = TestBed.inject(MatomoRouterTrackerService);
  });

  afterEach(() => {
    routerEventsSubject.complete();
  });

  describe('Service Setup', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('Navigation Tracking', () => {
    it('should call trackPageView() on NavigationEnd event', () => {
      const navigationEnd = new NavigationEnd(1, '/issues', '/issues');
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/issues');
    });

    it('should use urlAfterRedirects from NavigationEnd', () => {
      const navigationEnd = new NavigationEnd(
        2,
        '/old-url',
        '/new-url-after-redirect'
      );
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/new-url-after-redirect');
    });

    it('should track multiple navigation events', () => {
      const navigationEnd1 = new NavigationEnd(1, '/issues', '/issues');
      const navigationEnd2 = new NavigationEnd(2, '/view/issues', '/view/issues');
      const navigationEnd3 = new NavigationEnd(3, '/view/issues/5', '/view/issues/5');

      routerEventsSubject.next(navigationEnd1);
      routerEventsSubject.next(navigationEnd2);
      routerEventsSubject.next(navigationEnd3);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledTimes(3);
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/issues');
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/view/issues');
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/view/issues/5');
    });

    it('should NOT call trackPageView() on NavigationStart event', () => {
      const navigationStart = new NavigationStart(1, '/issues');
      routerEventsSubject.next(navigationStart);

      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should NOT call trackPageView() on NavigationCancel event', () => {
      const navigationCancel = new NavigationCancel(1, '/issues', 'Guard rejected');
      routerEventsSubject.next(navigationCancel);

      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should NOT call trackPageView() on NavigationError event', () => {
      const navigationError = new NavigationError(1, '/issues', 'Error loading module');
      routerEventsSubject.next(navigationError);

      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should handle root route navigation', () => {
      const navigationEnd = new NavigationEnd(1, '/', '/');
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/');
    });

    it('should handle nested route navigation', () => {
      const navigationEnd = new NavigationEnd(
        1,
        '/view/issues/5/edit',
        '/view/issues/5/edit'
      );
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/view/issues/5/edit');
    });

    it('should handle routes with query parameters', () => {
      const navigationEnd = new NavigationEnd(
        1,
        '/view/issues?status=open',
        '/view/issues?status=open'
      );
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/view/issues?status=open');
    });

    it('should handle routes with fragments', () => {
      const navigationEnd = new NavigationEnd(
        1,
        '/view/issues#section',
        '/view/issues#section'
      );
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/view/issues#section');
    });
  });

  describe('Redirect Handling', () => {
    it('should track final URL after redirects', () => {
      const navigationEnd = new NavigationEnd(
        1,
        '/old-route',
        '/redirected-route'
      );
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/redirected-route');
      expect(mockAnalytics.trackPageView).not.toHaveBeenCalledWith('/old-route');
    });

    it('should track URL even when no redirect occurred', () => {
      const navigationEnd = new NavigationEnd(
        1,
        '/issues',
        '/issues'
      );
      routerEventsSubject.next(navigationEnd);

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/issues');
    });
  });

  describe('Mixed Event Sequences', () => {
    it('should only track NavigationEnd events in a typical navigation sequence', () => {
      // Typical navigation: Start → End
      routerEventsSubject.next(new NavigationStart(1, '/issues'));
      routerEventsSubject.next(new NavigationEnd(1, '/issues', '/issues'));

      expect(mockAnalytics.trackPageView).toHaveBeenCalledTimes(1);
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/issues');
    });

    it('should not track when navigation is cancelled', () => {
      // Failed navigation: Start → Cancel
      routerEventsSubject.next(new NavigationStart(1, '/issues'));
      routerEventsSubject.next(new NavigationCancel(1, '/issues', 'Guard rejected'));

      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should not track when navigation fails', () => {
      // Failed navigation: Start → Error
      routerEventsSubject.next(new NavigationStart(1, '/issues'));
      routerEventsSubject.next(new NavigationError(1, '/issues', 'Route not found'));

      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should handle interleaved navigation events', () => {
      // Multiple navigations overlapping
      routerEventsSubject.next(new NavigationStart(1, '/issues'));
      routerEventsSubject.next(new NavigationStart(2, '/view/tags'));
      routerEventsSubject.next(new NavigationEnd(1, '/issues', '/issues'));
      routerEventsSubject.next(new NavigationEnd(2, '/view/tags', '/view/tags'));

      expect(mockAnalytics.trackPageView).toHaveBeenCalledTimes(2);
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/issues');
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('/view/tags');
    });
  });
});
