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
import { SchemaErdService } from './schema-erd.service';
import { SchemaService } from './schema.service';
import { of } from 'rxjs';
import { createMockEntity, createMockProperty, MOCK_ENTITIES, MOCK_PROPERTIES } from '../testing';
import { EntityPropertyType, SchemaEntityTable, SchemaEntityProperty } from '../interfaces/entity';

describe('SchemaErdService', () => {
  let service: SchemaErdService;
  let mockSchemaService: jasmine.SpyObj<SchemaService>;

  beforeEach(() => {
    mockSchemaService = jasmine.createSpyObj('SchemaService', ['getEntities', 'getProperties', 'getDetectedJunctionTables']);
    mockSchemaService.getDetectedJunctionTables.and.returnValue(of(new Set<string>()));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        SchemaErdService,
        { provide: SchemaService, useValue: mockSchemaService }
      ]
    });
    service = TestBed.inject(SchemaErdService);
  });

  describe('Basic Service Setup', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('generateMermaidSyntax()', () => {
    it('should fetch entities and properties from SchemaService', (done) => {
      const mockEntities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'id', udt_name: 'int4', type: EntityPropertyType.IntegerNumber }),
        createMockProperty({ table_name: 'Issue', column_name: 'name', udt_name: 'varchar', type: EntityPropertyType.TextShort })
      ];

      mockSchemaService.getEntities.and.returnValue(of(mockEntities));
      mockSchemaService.getProperties.and.returnValue(of(mockProps));

      service.generateMermaidSyntax().subscribe(() => {
        expect(mockSchemaService.getEntities).toHaveBeenCalled();
        expect(mockSchemaService.getProperties).toHaveBeenCalled();
        done();
      });
    });

    it('should generate valid erDiagram syntax', (done) => {
      const mockEntities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'id', udt_name: 'int4' })
      ];

      mockSchemaService.getEntities.and.returnValue(of(mockEntities));
      mockSchemaService.getProperties.and.returnValue(of(mockProps));

      service.generateMermaidSyntax().subscribe(syntax => {
        expect(syntax).toContain('erDiagram');
        expect(syntax).toContain('Issue {');
        done();
      });
    });

    it('should handle missing entities gracefully', (done) => {
      mockSchemaService.getEntities.and.returnValue(of(undefined as any));
      mockSchemaService.getProperties.and.returnValue(of([]));

      service.generateMermaidSyntax().subscribe(syntax => {
        expect(syntax).toBe('erDiagram\n  %% No schema data available');
        done();
      });
    });

    it('should handle missing properties gracefully', (done) => {
      mockSchemaService.getEntities.and.returnValue(of([MOCK_ENTITIES.issue]));
      mockSchemaService.getProperties.and.returnValue(of(undefined as any));

      service.generateMermaidSyntax().subscribe(syntax => {
        expect(syntax).toBe('erDiagram\n  %% No schema data available');
        done();
      });
    });

    it('should generate entity blocks for all entities', (done) => {
      const mockEntities: SchemaEntityTable[] = [MOCK_ENTITIES.issue, MOCK_ENTITIES.status];
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'id' }),
        createMockProperty({ table_name: 'Status', column_name: 'id' })
      ];

      mockSchemaService.getEntities.and.returnValue(of(mockEntities));
      mockSchemaService.getProperties.and.returnValue(of(mockProps));

      service.generateMermaidSyntax().subscribe(syntax => {
        expect(syntax).toContain('Issue {');
        expect(syntax).toContain('Status {');
        done();
      });
    });

    it('should generate relationships for foreign keys', (done) => {
      const mockEntities: SchemaEntityTable[] = [MOCK_ENTITIES.issue, MOCK_ENTITIES.status];
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'id', udt_name: 'int4' }),
        createMockProperty({
          table_name: 'Issue',
          column_name: 'status_id',
          udt_name: 'int4',
          join_schema: 'public',
          join_table: 'Status',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        }),
        createMockProperty({ table_name: 'Status', column_name: 'id', udt_name: 'int4' })
      ];

      mockSchemaService.getEntities.and.returnValue(of(mockEntities));
      mockSchemaService.getProperties.and.returnValue(of(mockProps));

      service.generateMermaidSyntax().subscribe(syntax => {
        expect(syntax).toContain('Issue }o--|| Status : "status"');
        done();
      });
    });

    it('should complete observable with take(1) on forkJoin', (done) => {
      mockSchemaService.getEntities.and.returnValue(of([MOCK_ENTITIES.issue]));
      mockSchemaService.getProperties.and.returnValue(of([MOCK_PROPERTIES.textShort]));

      let completed = false;
      service.generateMermaidSyntax().subscribe({
        next: () => {},
        complete: () => {
          completed = true;
        }
      });

      setTimeout(() => {
        expect(completed).toBe(true);
        done();
      }, 100);
    });
  });

  describe('generateEntityBlock()', () => {
    it('should create entity block with sanitized name', () => {
      const entity = createMockEntity({ table_name: 'my_table' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'my_table', column_name: 'id' })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('My_table {');
    });

    it('should filter properties by table name', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'name', display_name: 'name' }),
        createMockProperty({ table_name: 'Status', column_name: 'status', display_name: 'status' })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('name');
      expect(block).not.toContain('status');
    });

    it('should sort properties by sort_order', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'third', display_name: 'third', sort_order: 3 }),
        createMockProperty({ table_name: 'Issue', column_name: 'first', display_name: 'first', sort_order: 1 }),
        createMockProperty({ table_name: 'Issue', column_name: 'second', display_name: 'second', sort_order: 2 })
      ];

      const block = service['generateEntityBlock'](entity, props);
      const firstIndex = block.indexOf('first');
      const secondIndex = block.indexOf('second');
      const thirdIndex = block.indexOf('third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('should mark id column as PK', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'id', display_name: 'id', type: EntityPropertyType.IntegerNumber })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('id PK');
    });

    it('should mark ForeignKeyName type as FK', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'status_id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('FK');
    });

    it('should mark User type as FK', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'assigned_to',
          type: EntityPropertyType.User
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('FK');
    });

    it('should add NOT NULL marker for non-nullable fields', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'name',
          is_nullable: false
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('"NOT NULL"');
    });

    it('should not add NOT NULL marker for nullable fields', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'description',
          is_nullable: true
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).not.toContain('"NOT NULL"');
    });

    it('should sanitize display names (remove spaces)', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'first_name',
          display_name: 'First Name'
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('FirstName');
      expect(block).not.toContain('First Name');
    });

    it('should sanitize display names (remove hyphens)', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'field',
          display_name: 'Some-Field'
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('SomeField');
    });

    it('should sanitize display names (remove dots)', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'field',
          display_name: 'Some.Field'
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('SomeField');
    });

    it('should use column_name when display_name is null', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'my_column',
          display_name: null as any
        })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('my_column');
    });

    it('should map property types correctly', () => {
      const entity = createMockEntity({ table_name: 'Issue' });
      const props: SchemaEntityProperty[] = [
        createMockProperty({ table_name: 'Issue', column_name: 'text', display_name: 'text', type: EntityPropertyType.TextShort }),
        createMockProperty({ table_name: 'Issue', column_name: 'num', display_name: 'num', type: EntityPropertyType.IntegerNumber }),
        createMockProperty({ table_name: 'Issue', column_name: 'flag', display_name: 'flag', type: EntityPropertyType.Boolean })
      ];

      const block = service['generateEntityBlock'](entity, props);
      expect(block).toContain('Text text');
      expect(block).toContain('Integer num');
      expect(block).toContain('Boolean flag');
    });
  });

  describe('generateRelationships()', () => {
    it('should generate many-to-one relationship syntax', () => {
      const entities: SchemaEntityTable[] = [MOCK_ENTITIES.issue, MOCK_ENTITIES.status];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'status_id',
          join_schema: 'public',
          join_table: 'Status',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toContain('Issue }o--|| Status : "status"');
    });

    it('should only process public schema joins', () => {
      const entities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'ext_id',
          join_schema: 'external',
          join_table: 'ExtTable',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toBe('');
    });

    it('should prevent duplicate relationships', () => {
      const entities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'status_id',
          join_schema: 'public',
          join_table: 'Status',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        }),
        createMockProperty({
          table_name: 'Issue',
          column_name: 'status_id',
          join_schema: 'public',
          join_table: 'Status',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      const count = (relationships.match(/Issue }o--\|\| Status/g) || []).length;
      expect(count).toBe(1);
    });

    it('should strip _id suffix from relationship labels', () => {
      const entities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'assigned_user_id',
          join_schema: 'public',
          join_table: 'User',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toContain('"assigned_user"');
      expect(relationships).not.toContain('assigned_user_id');
    });

    it('should sanitize entity names in relationships', () => {
      const entities: SchemaEntityTable[] = [];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'my-table',
          column_name: 'ref_id',
          join_schema: 'public',
          join_table: 'other-table',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toContain('Mytable }o--|| Othertable');
    });

    it('should ignore properties without join_table', () => {
      const entities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'name',
          join_table: '',
          type: EntityPropertyType.TextShort
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toBe('');
    });

    it('should handle multiple relationships from same table', () => {
      const entities: SchemaEntityTable[] = [];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'status_id',
          join_schema: 'public',
          join_table: 'Status',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        }),
        createMockProperty({
          table_name: 'Issue',
          column_name: 'assignee_id',
          join_schema: 'public',
          join_table: 'User',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toContain('Issue }o--|| Status : "status"');
      expect(relationships).toContain('Issue }o--|| User : "assignee"');
    });
  });

  describe('sanitizeEntityName()', () => {
    it('should capitalize first letter', () => {
      expect(service['sanitizeEntityName']('issue')).toBe('Issue');
    });

    it('should remove spaces', () => {
      expect(service['sanitizeEntityName']('my table')).toBe('Mytable');
    });

    it('should remove hyphens', () => {
      expect(service['sanitizeEntityName']('my-table')).toBe('Mytable');
    });

    it('should remove dots', () => {
      expect(service['sanitizeEntityName']('my.table')).toBe('Mytable');
    });

    it('should preserve underscores', () => {
      expect(service['sanitizeEntityName']('my_table')).toBe('My_table');
    });

    it('should preserve alphanumerics', () => {
      expect(service['sanitizeEntityName']('table123')).toBe('Table123');
    });

    it('should handle all special characters', () => {
      expect(service['sanitizeEntityName']('my-table.name_123')).toBe('Mytablename_123');
    });

    it('should handle empty string', () => {
      expect(service['sanitizeEntityName']('')).toBe('');
    });

    it('should handle string with only special characters', () => {
      // First char is capitalized (no-op for special chars), rest are removed
      expect(service['sanitizeEntityName']('---')).toBe('-');
    });

    it('should handle already capitalized names', () => {
      expect(service['sanitizeEntityName']('Issue')).toBe('Issue');
    });
  });

  describe('mapPropertyTypeToString()', () => {
    it('should map Unknown type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.Unknown)).toBe('Unknown');
    });

    it('should map TextShort type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.TextShort)).toBe('Text');
    });

    it('should map TextLong type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.TextLong)).toBe('LongText');
    });

    it('should map Boolean type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.Boolean)).toBe('Boolean');
    });

    it('should map Date type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.Date)).toBe('Date');
    });

    it('should map DateTime type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.DateTime)).toBe('DateTime');
    });

    it('should map DateTimeLocal type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.DateTimeLocal)).toBe('DateTime');
    });

    it('should map Money type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.Money)).toBe('Money');
    });

    it('should map IntegerNumber type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.IntegerNumber)).toBe('Integer');
    });

    it('should map DecimalNumber type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.DecimalNumber)).toBe('Decimal');
    });

    it('should map ForeignKeyName type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.ForeignKeyName)).toBe('Reference');
    });

    it('should map User type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.User)).toBe('User');
    });

    it('should map GeoPoint type', () => {
      expect(service['mapPropertyTypeToString'](EntityPropertyType.GeoPoint)).toBe('Location');
    });

    it('should fallback to Unknown for invalid type', () => {
      expect(service['mapPropertyTypeToString'](9999 as EntityPropertyType)).toBe('Unknown');
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with no properties', (done) => {
      const mockEntities: SchemaEntityTable[] = [MOCK_ENTITIES.issue];
      const mockProps: SchemaEntityProperty[] = [];

      mockSchemaService.getEntities.and.returnValue(of(mockEntities));
      mockSchemaService.getProperties.and.returnValue(of(mockProps));

      service.generateMermaidSyntax().subscribe(syntax => {
        expect(syntax).toContain('Issue {');
        expect(syntax).toContain('}');
        done();
      });
    });

    it('should handle self-referencing foreign key', () => {
      const entities: SchemaEntityTable[] = [];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'parent_id',
          join_schema: 'public',
          join_table: 'Issue',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toContain('Issue }o--|| Issue : "parent"');
    });

    it('should handle multiple foreign keys to same table', () => {
      const entities: SchemaEntityTable[] = [];
      const props: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'created_by_id',
          join_schema: 'public',
          join_table: 'User',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        }),
        createMockProperty({
          table_name: 'Issue',
          column_name: 'assigned_to_id',
          join_schema: 'public',
          join_table: 'User',
          join_column: 'id',
          type: EntityPropertyType.ForeignKeyName
        })
      ];

      const relationships = service['generateRelationships'](entities, props, new Set<string>());
      expect(relationships).toContain('Issue }o--|| User : "created_by"');
      expect(relationships).toContain('Issue }o--|| User : "assigned_to"');
    });

    it('should handle custom display names', (done) => {
      const mockEntities: SchemaEntityTable[] = [
        createMockEntity({ table_name: 'Issue', display_name: 'Issue Tracker' })
      ];
      const mockProps: SchemaEntityProperty[] = [
        createMockProperty({
          table_name: 'Issue',
          column_name: 'field',
          display_name: 'Custom Field Name'
        })
      ];

      mockSchemaService.getEntities.and.returnValue(of(mockEntities));
      mockSchemaService.getProperties.and.returnValue(of(mockProps));

      service.generateMermaidSyntax().subscribe(syntax => {
        // Entity name uses table_name, not display_name
        expect(syntax).toContain('Issue {');
        // Property uses sanitized display_name
        expect(syntax).toContain('CustomFieldName');
        done();
      });
    });
  });
});
