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
      const prop = createMockProperty({ udt_name: 'int4', join_column: null as any });
      expect(service['getPropertyType'](prop)).toBe(EntityPropertyType.IntegerNumber);
    });

    it('should detect IntegerNumber for int8', () => {
      const prop = createMockProperty({ udt_name: 'int8', join_column: null as any });
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
      const intProp = createMockProperty({ udt_name: 'int4', join_column: null as any });
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
        createMockProperty({ table_name: 'Issue', column_name: 'id', udt_name: 'int4' }),
        createMockProperty({ table_name: 'Issue', column_name: 'name', udt_name: 'varchar' }),
        createMockProperty({ table_name: 'Issue', column_name: 'created_at', udt_name: 'timestamp' }),
        createMockProperty({ table_name: 'Issue', column_name: 'updated_at', udt_name: 'timestamp' })
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
        createMockProperty({ table_name: 'Issue', column_name: 'id', is_identity: true }),
        createMockProperty({ table_name: 'Issue', column_name: 'name', is_updatable: true }),
        createMockProperty({ table_name: 'Issue', column_name: 'computed', is_generated: true })
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
        createMockProperty({ table_name: 'Issue', column_name: 'name', is_updatable: true }),
        createMockProperty({ table_name: 'Issue', column_name: 'readonly', is_updatable: false })
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
        createMockProperty({ table_name: 'Issue', column_name: 'name', is_updatable: true }),
        createMockProperty({ table_name: 'Issue', column_name: 'created_at', is_updatable: false }),
        createMockProperty({ table_name: 'Issue', column_name: 'updated_at', is_updatable: false })
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
        createMockProperty({ table_name: 'Issue', column_name: 'name', is_updatable: true }),
        createMockProperty({ table_name: 'Issue', column_name: 'id', is_identity: true })
      ];

      service.getPropsForEdit(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].column_name).toBe('name');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });
  });

  describe('Property Sorting', () => {
    describe('getPropsForList()', () => {
      it('should return properties sorted by sort_order', (done) => {
        const mockProps: SchemaEntityProperty[] = [
          createMockProperty({ table_name: 'Issue', column_name: 'name', sort_order: 2 }),
          createMockProperty({ table_name: 'Issue', column_name: 'status', sort_order: 0 }),
          createMockProperty({ table_name: 'Issue', column_name: 'count', sort_order: 1 })
        ];

        service.getPropsForList(MOCK_ENTITIES.issue).subscribe(props => {
          expect(props.length).toBe(3);
          expect(props[0].column_name).toBe('status');  // sort_order: 0
          expect(props[1].column_name).toBe('count');   // sort_order: 1
          expect(props[2].column_name).toBe('name');    // sort_order: 2
          done();
        });

        expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
      });
    });

    describe('getPropsForDetail()', () => {
      it('should return properties sorted by sort_order', (done) => {
        const mockProps: SchemaEntityProperty[] = [
          createMockProperty({ table_name: 'Issue', column_name: 'description', sort_order: 5 }),
          createMockProperty({ table_name: 'Issue', column_name: 'title', sort_order: 3 })
        ];

        service.getPropsForDetail(MOCK_ENTITIES.issue).subscribe(props => {
          expect(props[0].column_name).toBe('title');       // sort_order: 3
          expect(props[1].column_name).toBe('description'); // sort_order: 5
          done();
        });

        expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
      });
    });

    describe('getPropsForCreate()', () => {
      it('should return properties sorted by sort_order', (done) => {
        const mockProps: SchemaEntityProperty[] = [
          createMockProperty({ table_name: 'Issue', column_name: 'field_a', sort_order: 10, is_updatable: true }),
          createMockProperty({ table_name: 'Issue', column_name: 'field_b', sort_order: 5, is_updatable: true }),
          createMockProperty({ table_name: 'Issue', column_name: 'field_c', sort_order: 7, is_updatable: true })
        ];

        service.getPropsForCreate(MOCK_ENTITIES.issue).subscribe(props => {
          expect(props[0].column_name).toBe('field_b');  // sort_order: 5
          expect(props[1].column_name).toBe('field_c');  // sort_order: 7
          expect(props[2].column_name).toBe('field_a');  // sort_order: 10
          done();
        });

        expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
      });
    });

    describe('getPropsForEdit()', () => {
      it('should return properties sorted by sort_order (inherits from getPropsForCreate)', (done) => {
        const mockProps: SchemaEntityProperty[] = [
          createMockProperty({ table_name: 'Issue', column_name: 'last', sort_order: 99, is_updatable: true }),
          createMockProperty({ table_name: 'Issue', column_name: 'first', sort_order: 1, is_updatable: true })
        ];

        service.getPropsForEdit(MOCK_ENTITIES.issue).subscribe(props => {
          expect(props[0].column_name).toBe('first');  // sort_order: 1
          expect(props[1].column_name).toBe('last');   // sort_order: 99
          done();
        });

        expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
      });
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

  describe('getColumnSpan()', () => {
    it('should return custom column_width when set', () => {
      const property = createMockProperty({ column_width: 4 });
      expect(SchemaService.getColumnSpan(property)).toBe(4);
    });

    it('should return 2 for TextLong type', () => {
      const property = createMockProperty({
        type: EntityPropertyType.TextLong,
        column_width: undefined
      });
      expect(SchemaService.getColumnSpan(property)).toBe(2);
    });

    it('should return 2 for GeoPoint type', () => {
      const property = createMockProperty({
        type: EntityPropertyType.GeoPoint,
        column_width: undefined
      });
      expect(SchemaService.getColumnSpan(property)).toBe(2);
    });

    it('should return 1 for other types by default', () => {
      const property = createMockProperty({
        type: EntityPropertyType.TextShort,
        column_width: undefined
      });
      expect(SchemaService.getColumnSpan(property)).toBe(1);
    });

    it('should prefer custom column_width over type defaults', () => {
      const property = createMockProperty({
        type: EntityPropertyType.TextLong,
        column_width: 3
      });
      expect(SchemaService.getColumnSpan(property)).toBe(3);
    });
  });

  describe('getPropertiesForEntityFresh()', () => {
    it('should fetch fresh properties from PostgREST, bypassing cache', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'title', udt_name: 'varchar' }),
        createMockProperty({ table_name: 'Issue', column_name: 'description', udt_name: 'text' })
      ];

      service.getPropertiesForEntityFresh(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(2);
        expect(props[0].column_name).toBe('title');
        expect(props[0].type).toBe(EntityPropertyType.TextShort);
        expect(props[1].type).toBe(EntityPropertyType.TextLong);
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should filter properties by table name', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'title', udt_name: 'varchar' }),
        createMockProperty({ table_name: 'Status', column_name: 'name', udt_name: 'varchar' })
      ];

      service.getPropertiesForEntityFresh(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);
        expect(props[0].table_name).toBe('Issue');
        expect(props[0].column_name).toBe('title');
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should make HTTP request every time (not use cache)', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'title', udt_name: 'varchar' })
      ];

      // First call
      service.getPropertiesForEntityFresh(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(1);

        // Second call - should make another HTTP request
        service.getPropertiesForEntityFresh(MOCK_ENTITIES.issue).subscribe(props2 => {
          expect(props2.length).toBe(1);
          done();
        });

        // Expect second HTTP request
        expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
      });

      // Expect first HTTP request
      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should return empty array for entity with no properties', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'OtherTable', column_name: 'name', udt_name: 'varchar' })
      ];

      service.getPropertiesForEntityFresh(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props.length).toBe(0);
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
    });

    it('should calculate property types for all properties', (done) => {
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'name', udt_name: 'varchar' }),
        createMockProperty({ table_name: 'Issue', column_name: 'count', udt_name: 'int4', join_column: null as any }),
        createMockProperty({ table_name: 'Issue', column_name: 'active', udt_name: 'bool' })
      ];

      service.getPropertiesForEntityFresh(MOCK_ENTITIES.issue).subscribe(props => {
        expect(props[0].type).toBe(EntityPropertyType.TextShort);
        expect(props[1].type).toBe(EntityPropertyType.IntegerNumber);
        expect(props[2].type).toBe(EntityPropertyType.Boolean);
        done();
      });

      expectPostgrestRequest(httpMock, 'schema_properties', mockProps);
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
