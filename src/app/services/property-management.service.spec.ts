import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PropertyManagementService } from './property-management.service';
import { environment } from '../../environments/environment';

describe('PropertyManagementService', () => {
  let service: PropertyManagementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        PropertyManagementService
      ]
    });
    service = TestBed.inject(PropertyManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Basic Service Setup', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('upsertPropertyMetadata()', () => {
    it('should call RPC function with correct parameters', (done) => {
      service.upsertPropertyMetadata(
        'Issue',
        'title',
        'Issue Title',
        'The title of the issue',
        1,
        200,
        true,
        true,
        true,
        true
      ).subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'rpc/upsert_property_metadata');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        p_table_name: 'Issue',
        p_column_name: 'title',
        p_display_name: 'Issue Title',
        p_description: 'The title of the issue',
        p_sort_order: 1,
        p_column_width: 200,
        p_show_on_list: true,
        p_show_on_create: true,
        p_show_on_edit: true,
        p_show_on_detail: true
      });
      req.flush({});
    });

    it('should handle null values', (done) => {
      service.upsertPropertyMetadata(
        'Issue',
        'title',
        null,
        null,
        null,
        null,
        false,
        false,
        false,
        false
      ).subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'rpc/upsert_property_metadata');
      expect(req.request.body).toEqual({
        p_table_name: 'Issue',
        p_column_name: 'title',
        p_display_name: null,
        p_description: null,
        p_sort_order: null,
        p_column_width: null,
        p_show_on_list: false,
        p_show_on_create: false,
        p_show_on_edit: false,
        p_show_on_detail: false
      });
      req.flush({});
    });

    it('should handle errors', (done) => {
      service.upsertPropertyMetadata(
        'Issue',
        'title',
        'Issue Title',
        null,
        1,
        null,
        true,
        true,
        true,
        true
      ).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error?.humanMessage).toBe('Failed to save property metadata');
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'rpc/upsert_property_metadata');
      req.flush({ message: 'Admin access required' }, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('updatePropertiesOrder()', () => {
    it('should call RPC function for each property', (done) => {
      const properties = [
        { table_name: 'Issue', column_name: 'title', sort_order: 0 },
        { table_name: 'Issue', column_name: 'description', sort_order: 1 },
        { table_name: 'Issue', column_name: 'status', sort_order: 2 }
      ];

      service.updatePropertiesOrder(properties).subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      // Expect 3 separate RPC calls - use match to get all requests
      const requests = httpMock.match(environment.postgrestUrl + 'rpc/update_property_sort_order');
      expect(requests.length).toBe(3);

      expect(requests[0].request.body).toEqual({ p_table_name: 'Issue', p_column_name: 'title', p_sort_order: 0 });
      expect(requests[1].request.body).toEqual({ p_table_name: 'Issue', p_column_name: 'description', p_sort_order: 1 });
      expect(requests[2].request.body).toEqual({ p_table_name: 'Issue', p_column_name: 'status', p_sort_order: 2 });

      requests.forEach(req => req.flush({}));
    });

    it('should handle empty array', (done) => {
      service.updatePropertiesOrder([]).subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      httpMock.expectNone(environment.postgrestUrl + 'rpc/update_property_sort_order');
    });

    it('should handle errors', (done) => {
      const properties = [{ table_name: 'Issue', column_name: 'title', sort_order: 0 }];

      service.updatePropertiesOrder(properties).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error?.humanMessage).toBe('Failed to update properties order');
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'rpc/update_property_sort_order');
      req.flush({ message: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('isAdmin()', () => {
    it('should call RPC function', (done) => {
      service.isAdmin().subscribe(result => {
        expect(result).toBe(true);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'rpc/is_admin');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(true);
    });

    it('should return false on error', (done) => {
      service.isAdmin().subscribe(result => {
        expect(result).toBe(false);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'rpc/is_admin');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
    });
  });
});
