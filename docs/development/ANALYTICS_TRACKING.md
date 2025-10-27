# Analytics Tracking Implementation Guide

This document provides patterns for adding Matomo analytics tracking to Civic OS components and services.

## Completed

- ✅ Configuration infrastructure (runtime.ts, environment.ts, docker-entrypoint.sh)
- ✅ AnalyticsService with comprehensive API
- ✅ Matomo tracker provider in app.config.ts
- ✅ SettingsModalComponent for user opt-out preference
- ✅ Settings menu integration in app.component
- ✅ AuthService tracking (login/logout)

## Tracking Patterns

### 1. List Page (src/app/pages/list-page/list-page.component.ts)

```typescript
import { AnalyticsService } from '../../services/analytics.service';

export class ListPageComponent {
  private analytics = inject(AnalyticsService);

  constructor() {
    effect(() => {
      const tableName = this.table();
      if (tableName) {
        // Track entity list view
        this.analytics.trackEvent('Entity', 'List', tableName);
      }
    });
  }
}
```

### 2. Detail Page (src/app/pages/detail-page/detail-page.component.ts)

```typescript
import { AnalyticsService } from '../../services/analytics.service';

export class DetailPageComponent {
  private analytics = inject(AnalyticsService);

  constructor() {
    effect(() => {
      const table = this.table();
      const id = this.id();
      if (table && id) {
        // Track entity detail view
        this.analytics.trackEvent('Entity', 'Detail', table);
      }
    });
  }
}
```

### 3. Create Page (src/app/pages/create-page/create-page.component.ts)

```typescript
import { AnalyticsService } from '../../services/analytics.service';

export class CreatePageComponent {
  private analytics = inject(AnalyticsService);

  save() {
    // ... existing save logic ...
    this.dataService.create(this.table(), transformedValues).subscribe({
      next: (result) => {
        // Track successful creation
        this.analytics.trackEvent('Entity', 'Create', this.table());

        // ... existing navigation logic ...
      },
      error: (err) => {
        // Error tracking handled by ErrorService
      }
    });
  }
}
```

### 4. Edit Page (src/app/pages/edit-page/edit-page.component.ts)

```typescript
import { AnalyticsService } from '../../services/analytics.service';

export class EditPageComponent {
  private analytics = inject(AnalyticsService);

  save() {
    // ... existing save logic ...
    this.dataService.update(this.table(), this.id(), transformedValues).subscribe({
      next: (result) => {
        // Track successful edit
        this.analytics.trackEvent('Entity', 'Edit', this.table());

        // ... existing navigation logic ...
      },
      error: (err) => {
        // Error tracking handled by ErrorService
      }
    });
  }
}
```

### 5. Data Service (src/app/services/data.service.ts)

```typescript
import { AnalyticsService } from './analytics.service';

export class DataService {
  private analytics = inject(AnalyticsService);

  delete(table: string, id: string): Observable<void> {
    return this.http.delete<void>(`${getPostgrestUrl()}${table}?id=eq.${id}`).pipe(
      tap(() => {
        // Track successful deletion
        this.analytics.trackEvent('Entity', 'Delete', table);
      }),
      catchError(error => {
        // Error tracking handled by ErrorService
        return throwError(() => error);
      })
    );
  }
}
```

### 6. Filter Bar Component (src/app/components/filter-bar/filter-bar.component.ts)

```typescript
import { AnalyticsService } from '../../services/analytics.service';

export class FilterBarComponent {
  private analytics = inject(AnalyticsService);

  onSearchSubmit() {
    const query = this.searchQuery();
    if (query) {
      // Track search usage (query length only, not content for privacy)
      this.analytics.trackEvent('Search', 'Query', this.tableName(), query.length);
    }

    // ... existing search logic ...
  }
}
```

### 7. Error Service (src/app/services/error.service.ts)

```typescript
import { AnalyticsService } from './analytics.service';

export class ErrorService {
  private analytics = inject(AnalyticsService);

  parseToHuman(error: any): string {
    // ... existing error parsing logic ...

    // Track HTTP errors
    if (error.status) {
      this.analytics.trackError(`HTTP ${error.status}`, error.status);
    } else if (error.error?.code) {
      this.analytics.trackError(`PostgreSQL ${error.error.code}`, parseInt(error.error.code));
    }

    return errorMessage;
  }
}
```

## Event Naming Conventions

### Categories
- `Entity` - CRUD operations on database entities
- `Search` - Search and filter operations
- `Error` - Application errors and failures
- `Auth` - Authentication events (login/logout)
- `Dashboard` - Dashboard interactions

### Actions
- `List` - Viewing entity list page
- `Detail` - Viewing entity detail page
- `Create` - Creating new record
- `Edit` - Editing existing record
- `Delete` - Deleting record
- `Query` - Performing search
- `HTTP` - HTTP error occurred
- `Application` - Application error occurred
- `Login` - User logged in
- `Logout` - User logged out

### Name
- Entity table name (e.g., `issues`, `users`)
- Error message or code
- Dashboard ID

### Value (optional numeric)
- Search query length
- HTTP status code
- Error code

## Privacy Guidelines

1. **DO NOT** track:
   - User input text (search queries, form data)
   - Sensitive data (passwords, tokens)
   - Personal information (emails, phone numbers)

2. **DO** track:
   - Page views
   - Feature usage (which entities are most viewed/edited)
   - Search frequency (length, not content)
   - Error rates and types
   - User flows and navigation patterns

## Testing

### Manual Testing
1. Enable analytics in development: Set `MATOMO_URL` and `MATOMO_SITE_ID` in `.env`
2. Open browser dev tools → Network tab
3. Filter by "matomo" to see tracking requests
4. Verify events appear in Matomo Real-time view

### Unit Testing
Mock AnalyticsService in component tests:

```typescript
beforeEach(async () => {
  await TestBed.configureTestingModule({
    imports: [MyComponent],
    providers: [
      {
        provide: AnalyticsService,
        useValue: {
          trackEvent: jest.fn(),
          trackPageView: jest.fn(),
          trackError: jest.fn(),
          isEnabled: jest.fn().mockReturnValue(true)
        }
      }
    ]
  }).compileComponents();
});

it('should track entity creation', () => {
  const analytics = TestBed.inject(AnalyticsService);

  component.save();

  expect(analytics.trackEvent).toHaveBeenCalledWith('Entity', 'Create', 'issues');
});
```

## Remaining Implementation Tasks

- [ ] Add tracking to ListPage (Entity/List events)
- [ ] Add tracking to DetailPage (Entity/Detail events)
- [ ] Add tracking to CreatePage (Entity/Create events)
- [ ] Add tracking to EditPage (Entity/Edit events)
- [ ] Add tracking to DataService delete method (Entity/Delete events)
- [ ] Add tracking to FilterBarComponent (Search/Query events)
- [ ] Add tracking to ErrorService (Error/* events)
- [ ] Update nginx CSP headers to allow Matomo domain
- [ ] Update CLAUDE.md with analytics section
- [ ] Update ROADMAP.md to check off "Application Analytics"
- [ ] Test with real Matomo instance

## See Also

- [AnalyticsService API](../../src/app/services/analytics.service.ts)
- [Matomo JavaScript Tracking Client](https://developer.matomo.org/api-reference/tracking-javascript)
- [@ngx-matomo/tracker Documentation](https://www.npmjs.com/package/@ngx-matomo/tracker)
