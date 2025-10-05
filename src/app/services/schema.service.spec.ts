import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SchemaService } from './schema.service';
import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../interfaces/entity';
import { createMockEntity, createMockProperty, MOCK_PROPERTIES, MOCK_ENTITIES, expectPostgrestRequest } from '../testing';
import { environment } from '../../environments/environment';
import { Validators } from '@angular/forms';

describe('SchemaService', () => {
  let service: SchemaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        SchemaService
      ]
    });
    service = TestBed.inject(SchemaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no outstanding HTTP requests
  });

  describe('Basic Service Setup', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have hideFields defined', () => {
      expect(SchemaService.hideFields).toEqual(['id', 'created_at', 'updated_at']);
    });
  });

  describe('getEntities()', () => {
    it('should fetch entities from PostgREST on first call', (done) => {
      const mockEntities: SchemaEntityTable[] = [
        MOCK_ENTITIES.issue,
        MOCK_ENTITIES.status
      ];

      service.getEntities().subscribe(entities => {
        expect(entities).toEqual(mockEntities);
        expect(entities.length).toBe(2);
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_entities', mockEntities);
    });

    it('should cache entities and return from memory on subsequent calls', (done) => {
      const mockEntities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];

      // First call - fetches from HTTP
      service.getEntities().subscribe(() => {
        // Second call - should return from cache without HTTP request
        service.getEntities().subscribe(cachedEntities => {
          expect(cachedEntities).toEqual(mockEntities);
          done();
        });
        // No HTTP request should be made for the second call
      });

      expectPostgrestRequest(httpMock, 'schema_entities', mockEntities);
    });
  });

  describe('getEntity()', () => {
    it('should return entity matching the key', (done) => {
      const mockEntities: SchemaEntityTable[] = [
        MOCK_ENTITIES.issue,
        MOCK_ENTITIES.status
      ];

      service.getEntity('Issue').subscribe(entity => {
        expect(entity).toBeDefined();
        expect(entity?.table_name).toBe('Issue');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_entities', mockEntities);
    });

    it('should return undefined for non-existent entity', (done) => {
      service.getEntity('NonExistent').subscribe(entity => {
        expect(entity).toBeUndefined();
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_entities', []);
    });
  });

  describe('getProperties()', () => {
    it('should fetch properties from PostgREST', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ column_name: 'name', udt_name: 'varchar' }),
        createMockProperty({ column_name: 'count', udt_name: 'int4' })
      ];

      service.getProperties().subscribe(props => {
        expect(props.length).toBe(2);
        expect(props[0].column_name).toBe('name');
        // Should have type calculated
        expect(props[0].type).toBe(EntityPropertyType.TextShort);
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should cache properties on first call', (done) => {
      const mockProps = [MOCK_PROPERTIES.textShort];

      service.getProperties().subscribe(() => {
        service.getProperties().subscribe(cachedProps => {
          expect(cachedProps).toEqual(jasmine.arrayContaining([
            jasmine.objectContaining({ column_name: 'name' })
          ]));
          done();
        });
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });
  });

  describe('getPropertyType() - Type Detection Logic', () => {
    it('should detect TextShort for varchar', () => {
      const prop = createMockProperty({ udt_name: 'varchar' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.TextShort);
    });

    it('should detect TextLong for text', () => {
      const prop = createMockProperty({ udt_name: 'text' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.TextLong);
    });

    it('should detect Boolean for bool', () => {
      const prop = createMockProperty({ udt_name: 'bool' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.Boolean);
    });

    it('should detect IntegerNumber for int4', () => {
      const prop = createMockProperty({ udt_name: 'int4', join_column: '' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.IntegerNumber);
    });

    it('should detect IntegerNumber for int8', () => {
      const prop = createMockProperty({ udt_name: 'int8', join_column: '' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.IntegerNumber);
    });

    it('should detect Money for money', () => {
      const prop = createMockProperty({ udt_name: 'money' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.Money);
    });

    it('should detect Date for date', () => {
      const prop = createMockProperty({ udt_name: 'date' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.Date);
    });

    it('should detect DateTime for timestamp', () => {
      const prop = createMockProperty({ udt_name: 'timestamp' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.DateTime);
    });

    it('should detect DateTimeLocal for timestamptz', () => {
      const prop = createMockProperty({ udt_name: 'timestamptz' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.DateTimeLocal);
    });

    it('should detect ForeignKeyName for int4 with join_column', () => {
      const prop = createMockProperty({
        udt_name: 'int4',
        join_column: 'id'
      });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.ForeignKeyName);
    });

    it('should detect ForeignKeyName for int8 with join_column', () => {
      const prop = createMockProperty({
        udt_name: 'int8',
        join_column: 'id'
      });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.ForeignKeyName);
    });

    it('should detect User for uuid with civic_os_users join_table', () => {
      const prop = createMockProperty({
        udt_name: 'uuid',
        join_table: 'civic_os_users'
      });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.User);
    });

    it('should detect GeoPoint for geography Point', () => {
      const prop = createMockProperty({
        udt_name: 'geography',
        geography_type: 'Point'
      });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.GeoPoint);
    });

    it('should return Unknown for unrecognized types', () => {
      const prop = createMockProperty({ udt_name: 'unknown_type' });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.Unknown);
    });

    it('should prioritize ForeignKeyName over IntegerNumber', () => {
      // int4 alone should be IntegerNumber
      const intProp = createMockProperty({ udt_name: 'int4', join_column: '' });
      expect(service['getPropertyType'](intProp)).toBe(EntityPropertyType.IntegerNumber);

      // int4 with join_column should be ForeignKeyName
      const fkProp = createMockProperty({ udt_name: 'int4', join_column: 'id' });
      expect(service['getPropertyType'](fkProp)).toBe(EntityPropertyType.ForeignKeyName);
    });
  });

  describe('propertyToSelectString() - PostgREST Query Building', () => {
    it('should return column_name for simple types', () => {
      expect(SchemaService.propertyToSelectString(MOCK_PROPERTIES.textShort))
        .toBe('name');
      expect(SchemaService.propertyToSelectString(MOCK_PROPERTIES.integer))
        .toBe('count');
      expect(SchemaService.propertyToSelectString(MOCK_PROPERTIES.boolean))
        .toBe('is_active');
    });

    it('should build embedded select for ForeignKeyName', () => {
      const result = SchemaService.propertyToSelectString(MOCK_PROPERTIES.foreignKey);
      expect(result).toBe('status_id:Status(id,display_name)');
    });

    it('should build special select for User type', () => {
      const result = SchemaService.propertyToSelectString(MOCK_PROPERTIES.user);
      expect(result).toBe('assigned_to:civic_os_users!assigned_to(display_name,private:civic_os_users_private(display_name,phone,email))');
    });

    it('should build computed field select for GeoPoint', () => {
      const result = SchemaService.propertyToSelectString(MOCK_PROPERTIES.geoPoint);
      expect(result).toBe('location:location_text');
    });

    it('should handle properties without join_schema gracefully', () => {
      const prop = createMockProperty({
        type: EntityPropertyType.ForeignKeyName,
        column_name: 'status_id',
        join_schema: '',
        join_table: 'Status',
        join_column: 'id'
      });
      const result = SchemaService.propertyToSelectString(prop);
      // Should not build embedded select if join_schema is not 'public'
      expect(result).toBe('status_id');
    });
  });

  describe('getPropsForList()', () => {
    it('should filter out hidden fields', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ column_name: 'id', udt_name: 'int4' }),
        createMockProperty({ column_name: 'name', udt_name: 'varchar' }),
        createMockProperty({ column_name: 'created_at', udt_name: 'timestamp' }),
        createMockProperty({ column_name: 'updated_at', udt_name: 'timestamp' })
      ];

      service.getPropsForList(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('name');
        expect(props.find(p => p.column_name === 'id')).toBeUndefined();
        expect(props.find(p => p.column_name === 'created_at')).toBeUndefined();
        expect(props.find(p => p.column_name === 'updated_at')).toBeUndefined();
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should only return properties for the specified table', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'issue_name', udt_name: 'varchar' }),
        createMockProperty({ table_name: 'Status', column_name: 'status_name', udt_name: 'varchar' })
      ];

      service.getPropsForList(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('issue_name');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });
  });

  describe('getPropsForCreate()', () => {
    it('should filter out generated and identity columns', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ column_name: 'id', is_identity: true }),
        createMockProperty({ column_name: 'name', is_updatable: true }),
        createMockProperty({ column_name: 'computed', is_generated: true })
      ];

      service.getPropsForCreate(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('name');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should filter out non-updatable columns', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ column_name: 'name', is_updatable: true }),
        createMockProperty({ column_name: 'readonly', is_updatable: false })
      ];

      service.getPropsForCreate(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('name');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should filter out hidden fields (id, created_at, updated_at)', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ column_name: 'name', is_updatable: true }),
        createMockProperty({ column_name: 'created_at', is_updatable: false }),
        createMockProperty({ column_name: 'updated_at', is_updatable: false })
      ];

      service.getPropsForCreate(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('name');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });
  });

  describe('getPropsForEdit()', () => {
    it('should use same logic as getPropsForCreate', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ column_name: 'name', is_updatable: true }),
        createMockProperty({ column_name: 'id', is_identity: true })
      ];

      service.getPropsForEdit(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('name');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });
  });

  describe('getFormValidatorsForProperty()', () => {
    it('should add required validator for non-nullable columns', () => {
      const prop = createMockProperty({ is_nullable: false });
      const validators = SchemaService.getFormValidatorsForProperty(prop);

      expect(validators.length).toBe(1);
      expect(validators).toContain(Validators.required);
    });

    it('should not add validators for nullable columns', () => {
      const prop = createMockProperty({ is_nullable: true });
      const validators = SchemaService.getFormValidatorsForProperty(prop);

      expect(validators.length).toBe(0);
    });
  });

  describe('getDefaultValueForProperty()', () => {
    it('should return false for Boolean type', () => {
      const result = SchemaService.getDefaultValueForProperty(MOCK_PROPERTIES.boolean);
      expect(result).toBe(false);
    });

    it('should return null for all other types', () => {
      expect(SchemaService.getDefaultValueForProperty(MOCK_PROPERTIES.textShort)).toBeNull();
      expect(SchemaService.getDefaultValueForProperty(MOCK_PROPERTIES.integer)).toBeNull();
      expect(SchemaService.getDefaultValueForProperty(MOCK_PROPERTIES.foreignKey)).toBeNull();
      expect(SchemaService.getDefaultValueForProperty(MOCK_PROPERTIES.geoPoint)).toBeNull();
    });
  });

  describe('refreshCache()', () => {
    it('should trigger background refresh of schema and properties', () => {
      service.refreshCache();

      // Should make HTTP requests for both endpoints
      const entitiesReq = httpMock.expectOne(req => req.url.includes('schema_entities'));
      const propsReq = httpMock.expectOne(req => req.url.includes('schema_properties'));

      entitiesReq.flush([]);
      propsReq.flush([]);
    });
  });
});
