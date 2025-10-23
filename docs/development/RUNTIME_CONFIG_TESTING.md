# Unit Testing Runtime Configuration

This document describes how to write unit tests for services and components that use runtime configuration helpers (`getPostgrestUrl()`, `getKeycloakConfig()`, `getMapConfig()`).

## Overview

The runtime configuration system reads from `window.civicOsConfig` (production) or falls back to `environment.ts` (development). In unit tests, we need to mock `window.civicOsConfig` to control configuration values during test execution.

## Basic Test Setup

### Mocking window.civicOsConfig

Before each test, set `window.civicOsConfig` to provide controlled configuration values:

```typescript
import { TestBed } from '@angular/core/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  beforeEach(() => {
    // Mock runtime configuration
    (window as any).civicOsConfig = {
      postgrestUrl: 'http://test-api.example.com/',
      keycloak: {
        url: 'http://test-keycloak.example.com',
        realm: 'test-realm',
        clientId: 'test-client'
      },
      map: {
        tileUrl: 'http://test-tiles.example.com/{z}/{x}/{y}.png',
        attribution: 'Test Attribution',
        defaultCenter: [42.0, -83.0],
        defaultZoom: 10
      }
    };

    TestBed.configureTestingModule({
      providers: [MyService]
    });
  });

  afterEach(() => {
    // Clean up mock to avoid test pollution
    delete (window as any).civicOsConfig;
  });

  it('should use mocked PostgREST URL', () => {
    const service = TestBed.inject(MyService);
    // Test service behavior with mocked config
  });
});
```

### Testing Services That Use getPostgrestUrl()

Example: Testing `DataService` which uses `getPostgrestUrl()` to build API URLs.

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Mock runtime config
    (window as any).civicOsConfig = {
      postgrestUrl: 'http://localhost:3000/'
    };

    TestBed.configureTestingModule({
      providers: [
        DataService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    delete (window as any).civicOsConfig;
  });

  it('should fetch data from correct PostgREST URL', () => {
    const query = {
      key: 'issues',
      fields: ['id', 'title']
    };

    service.getData(query).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/issues?select=id,title');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, title: 'Test' }]);
  });
});
```

### Testing Components That Use getMapConfig()

Example: Testing `GeoPointMapComponent` which uses `getMapConfig()` for Leaflet initialization.

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeoPointMapComponent } from './geo-point-map.component';

describe('GeoPointMapComponent', () => {
  let component: GeoPointMapComponent;
  let fixture: ComponentFixture<GeoPointMapComponent>;

  beforeEach(async () => {
    // Mock runtime config with custom map settings
    (window as any).civicOsConfig = {
      map: {
        tileUrl: 'http://tiles.example.com/{z}/{x}/{y}.png',
        attribution: 'Test Maps',
        defaultCenter: [42.2808, -83.7430], // Ann Arbor
        defaultZoom: 12
      }
    };

    await TestBed.configureTestingModule({
      imports: [GeoPointMapComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(GeoPointMapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    delete (window as any).civicOsConfig;
  });

  it('should initialize with configured map defaults', () => {
    fixture.detectChanges();
    // Test that map uses mocked configuration
    // (Note: Full map testing requires Leaflet DOM mocking)
  });
});
```

## Testing Scenarios

### Scenario 1: Missing Configuration (Fallback to environment.ts)

Test that services gracefully fall back to `environment.ts` when `window.civicOsConfig` is undefined:

```typescript
it('should fall back to environment.ts when window.civicOsConfig is missing', () => {
  // Ensure window.civicOsConfig is NOT set
  delete (window as any).civicOsConfig;

  // Service should use environment.ts values
  service.getData({ key: 'issues' }).subscribe();

  // Verify request uses environment.ts postgrestUrl
  const req = httpMock.expectOne(
    (request) => request.url.startsWith('http://localhost:3000/')
  );
  req.flush([]);
});
```

### Scenario 2: Invalid Configuration Values

Test handling of malformed or missing config properties:

```typescript
it('should handle missing postgrestUrl gracefully', () => {
  (window as any).civicOsConfig = {
    // postgrestUrl intentionally missing
    keycloak: { url: '...', realm: '...', clientId: '...' }
  };

  // Should fall back to environment.ts
  // Test service behavior
});
```

### Scenario 3: Testing Different Environments

Test service behavior with different base URLs (local, staging, production):

```typescript
const testCases = [
  { name: 'local', url: 'http://localhost:3000/' },
  { name: 'staging', url: 'https://api.staging.civic-os.org/' },
  { name: 'production', url: 'https://api.civic-os.org/' }
];

testCases.forEach(({ name, url }) => {
  it(`should work with ${name} PostgREST URL`, () => {
    (window as any).civicOsConfig = { postgrestUrl: url };

    service.getData({ key: 'issues' }).subscribe();

    const req = httpMock.expectOne(`${url}issues?select=id`);
    req.flush([]);
  });
});
```

## Best Practices

1. **Always clean up mocks in `afterEach()`** to prevent test pollution
2. **Use descriptive config values** (e.g., `http://test-api.example.com/`) to make failures obvious
3. **Test both with and without `window.civicOsConfig`** to verify fallback behavior
4. **Avoid testing implementation details** - test service behavior, not config internals
5. **Mock HTTP responses**, don't make real API calls in unit tests

## Common Pitfalls

### ❌ Forgetting to Clean Up Mocks

```typescript
// BAD: No afterEach cleanup
beforeEach(() => {
  (window as any).civicOsConfig = { ... };
});
// Tests will interfere with each other!
```

```typescript
// GOOD: Always clean up
afterEach(() => {
  delete (window as any).civicOsConfig;
});
```

### ❌ Testing Helper Functions Directly

```typescript
// BAD: Testing runtime.ts helpers directly
import { getPostgrestUrl } from '../config/runtime';

it('should return correct URL', () => {
  expect(getPostgrestUrl()).toBe('http://localhost:3000/');
});
```

**Why bad?** Helper functions are implementation details. Test service behavior instead.

```typescript
// GOOD: Test service that uses the helper
it('should fetch data from PostgREST API', () => {
  service.getData({ key: 'issues' }).subscribe();
  const req = httpMock.expectOne('http://localhost:3000/issues?select=id');
  req.flush([]);
});
```

### ❌ Hardcoding URLs in Tests

```typescript
// BAD: Hardcoded URL makes test brittle
const req = httpMock.expectOne('http://localhost:3000/issues');
```

```typescript
// GOOD: Use pattern matching for flexibility
const req = httpMock.expectOne(
  (request) => request.url.endsWith('/issues')
);
```

## Integration Testing

For integration tests that span multiple services, mock `window.civicOsConfig` at the test suite level:

```typescript
describe('Issue Workflow Integration', () => {
  beforeAll(() => {
    (window as any).civicOsConfig = {
      postgrestUrl: 'http://localhost:3000/',
      keycloak: { /* ... */ }
    };
  });

  afterAll(() => {
    delete (window as any).civicOsConfig;
  });

  // Integration tests here
});
```

## Files to Update When Adding New Config

When adding new runtime configuration:

1. **`src/app/config/runtime.ts`** - Add helper function (e.g., `getNewConfigValue()`)
2. **`src/environments/environment.ts`** - Add fallback value for development
3. **`docker/frontend/docker-entrypoint.sh`** - Add to `window.civicOsConfig` inline script
4. **Test setup** - Update mock objects to include new config property

## Further Reading

- **Angular Testing Guide**: https://angular.dev/guide/testing
- **HttpTestingController**: https://angular.dev/guide/http-testing
- **TestBed API**: https://angular.dev/api/core/testing/TestBed
- **Main Testing Guide**: [docs/development/TESTING.md](./TESTING.md)
