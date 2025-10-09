import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';

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
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Handle HTTP requests made during component initialization (may be multiple)
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));

    expect(app).toBeTruthy();
  });

  it(`should have the 'frontend' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    // Handle HTTP requests made during component initialization (may be multiple)
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));

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

    // Handle HTTP requests
    const schemaEntitiesReqs = httpMock.match(req => req.url.includes('schema_entities'));
    schemaEntitiesReqs.forEach(req => req.flush([]));

    // Trigger change detection to run ngAfterViewInit
    fixture.detectChanges();

    // Simulate theme change
    themeInput.checked = true;
    themeInput.dispatchEvent(new Event('change'));

    // Verify data-theme attribute was updated
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Cleanup
    document.body.removeChild(themeInput);
  });
});
