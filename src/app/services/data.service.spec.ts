import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DataService } from './data.service';
import { environment } from '../../environments/environment';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        DataService
      ]
    });
    service = TestBed.inject(DataService);
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

  describe('getData() - Query Building', () => {
    it('should construct basic GET request', (done) => {
      const mockData = [{ id: 1, name: 'Test', created_at: '', updated_at: '', display_name: 'Test' }];

      service.getData({ key: 'Issue', fields: [] }).subscribe(data => {
        expect(data).toEqual(mockData);
        done();
      });

      const req = httpMock.expectOne(req => req.url.includes('Issue'));
      expect(req.request.method).toBe('GET');
      req.flush(mockData);
    });

    it('should auto-add id field to select if not present', (done) => {
      service.getData({
        key: 'Issue',
        fields: ['name', 'description']
      }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('select=name,description,id')
      );
      expect(req.request.url).toContain('id');
      req.flush([]);
      done();
    });

    it('should not duplicate id field if already present', (done) => {
      service.getData({
        key: 'Issue',
        fields: ['id', 'name']
      }).subscribe();

      const req = httpMock.expectOne(req => req.url.includes('Issue'));
      const url = req.request.url;
      const selectParam = url.split('select=')[1];

      // Count occurrences of 'id'
      const idCount = (selectParam?.match(/\bid\b/g) || []).length;
      expect(idCount).toBe(1);

      req.flush([]);
      done();
    });

    it('should build select parameter with multiple fields', (done) => {
      service.getData({
        key: 'Issue',
        fields: ['name', 'status_id', 'created_at']
      }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('select=name,status_id,created_at,id')
      );
      expect(req.request.url).toContain('select=');
      req.flush([]);
      done();
    });

    it('should build order parameter with default ascending direction', (done) => {
      service.getData({
        key: 'Issue',
        fields: [],
        orderField: 'created_at'
      }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('order=created_at.asc')
      );
      expect(req.request.url).toContain('order=created_at.asc');
      req.flush([]);
      done();
    });

    it('should build order parameter with descending direction', (done) => {
      service.getData({
        key: 'Issue',
        fields: [],
        orderField: 'created_at',
        orderDirection: 'desc'
      }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('order=created_at.desc')
      );
      expect(req.request.url).toContain('order=created_at.desc');
      req.flush([]);
      done();
    });

    it('should build entityId filter', (done) => {
      service.getData({
        key: 'Issue',
        fields: [],
        entityId: '42'
      }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('id=eq.42')
      );
      expect(req.request.url).toContain('id=eq.42');
      req.flush([]);
      done();
    });

    it('should combine multiple query parameters', (done) => {
      service.getData({
        key: 'Issue',
        fields: ['name', 'status_id'],
        orderField: 'name',
        orderDirection: 'asc',
        entityId: '10'
      }).subscribe();

      const req = httpMock.expectOne(req => {
        const url = req.url;
        return url.includes('Issue') &&
               url.includes('select=name,status_id,id') &&
               url.includes('order=name.asc') &&
               url.includes('id=eq.10');
      });

      expect(req.request.url).toContain('&');
      req.flush([]);
      done();
    });

    it('should construct correct PostgREST URL', (done) => {
      service.getData({
        key: 'Issue',
        fields: ['name']
      }).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.startsWith(environment.postgrestUrl)
      );
      expect(req.request.url).toContain(environment.postgrestUrl);
      req.flush([]);
      done();
    });
  });

  describe('createData()', () => {
    it('should POST data to correct endpoint', (done) => {
      const newData = { name: 'New Issue', status_id: 1 };
      const createdData = { id: 1, ...newData };

      service.createData('Issue', newData).subscribe(response => {
        expect(response.success).toBe(true);
        expect(response.body).toEqual(createdData);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'Issue');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newData);
      expect(req.request.headers.get('Prefer')).toBe('return=representation');
      req.flush(createdData);
    });

    it('should handle successful creation', (done) => {
      const newData = { name: 'Test' };

      service.createData('Issue', newData).subscribe(response => {
        expect(response.success).toBe(true);
        expect(response.error).toBeUndefined();
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'Issue');
      req.flush({ id: 1, name: 'Test' });
    });

    it('should handle API errors', (done) => {
      const newData = { name: 'Test' };
      const errorResponse = {
        message: 'Duplicate key violation',
        details: 'Key (name)=(Test) already exists',
        hint: null,
        code: '23505'
      };

      service.createData('Issue', newData).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.error?.message).toBe('Duplicate key violation');
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'Issue');
      req.flush(errorResponse, { status: 409, statusText: 'Conflict' });
    });
  });

  describe('editData()', () => {
    it('should PATCH data to correct endpoint with id filter', (done) => {
      const updatedData = { name: 'Updated Issue' };
      const returnedData = { id: 1, name: 'Updated Issue', status_id: 2 };

      service.editData('Issue', 1, updatedData).subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      const req = httpMock.expectOne(req =>
        req.url.includes('Issue?id=eq.1')
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updatedData);
      expect(req.request.headers.get('Prefer')).toBe('return=representation');
      req.flush([returnedData]);
    });

    it('should handle string IDs', (done) => {
      const updatedData = { name: 'Updated' };

      service.editData('Issue', 'abc-123', updatedData).subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      const req = httpMock.expectOne(req =>
        req.url.includes('Issue?id=eq.abc-123')
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.url).toContain('id=eq.abc-123');
      req.flush([{ id: 'abc-123', name: 'Updated' }]);
    });

    it('should validate update success by comparing returned data', (done) => {
      const updatedData = { name: 'Updated Name', status_id: 3 };
      const returnedData = { id: 1, name: 'Updated Name', status_id: 3 };

      service.editData('Issue', 1, updatedData).subscribe(response => {
        expect(response.success).toBe(true);
        expect(response.error).toBeUndefined();
        done();
      });

      const req = httpMock.expectOne(req => req.url.includes('Issue?id=eq.1'));
      req.flush([returnedData]);
    });

    it('should detect failed update when returned data does not match', (done) => {
      const updatedData = { name: 'New Name' };
      const returnedData = { id: 1, name: 'Old Name' }; // Different from input

      service.editData('Issue', 1, updatedData).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.error?.humanMessage).toBe('Could not update');
        done();
      });

      const req = httpMock.expectOne(req => req.url.includes('Issue?id=eq.1'));
      req.flush([returnedData]);
    });

    it('should handle empty response as failure', (done) => {
      const updatedData = { name: 'Test' };

      service.editData('Issue', 1, updatedData).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error?.humanMessage).toBe('Could not update');
        done();
      });

      const req = httpMock.expectOne(req => req.url.includes('Issue?id=eq.1'));
      req.flush([]); // Empty array indicates no rows updated
    });

    it('should handle HTTP errors', (done) => {
      const updatedData = { name: 'Test' };
      const errorResponse = {
        message: 'permission denied for table Issue',
        code: '42501'
      };

      service.editData('Issue', 1, updatedData).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(req => req.url.includes('Issue?id=eq.1'));
      req.flush(errorResponse, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('refreshCurrentUser()', () => {
    it('should call RPC function', (done) => {
      service.refreshCurrentUser().subscribe(response => {
        expect(response.success).toBe(true);
        done();
      });

      const req = httpMock.expectOne(req =>
        req.url.includes('rpc/refresh_current_user')
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ success: true });
    });

    it('should handle RPC errors', (done) => {
      service.refreshCurrentUser().subscribe(response => {
        expect(response.success).toBe(false);
        done();
      });

      const req = httpMock.expectOne(req =>
        req.url.includes('rpc/refresh_current_user')
      );
      req.flush({ message: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', (done) => {
      const newData = { name: 'Test' };

      service.createData('Issue', newData).subscribe(response => {
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
        expect(response.error?.httpCode).toBe(0);
        done();
      });

      const req = httpMock.expectOne(environment.postgrestUrl + 'Issue');
      req.error(new ProgressEvent('Network error'), { status: 0 });
    });
  });
});
