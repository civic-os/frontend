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
    mockAuthService = jasmine.createSpyObj('AuthService', ['isAdmin', 'hasRole'], {
      userRoles: []
    });

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
});
