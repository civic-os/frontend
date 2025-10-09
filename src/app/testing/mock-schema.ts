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

import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../interfaces/entity';

/**
 * Creates a mock SchemaEntityTable with sensible defaults.
 * Override any properties as needed for specific test cases.
 */
export function createMockEntity(overrides?: Partial<SchemaEntityTable>): SchemaEntityTable {
  return {
    display_name: 'Test Entity',
    sort_order: 1,
    description: null,
    table_name: 'test_entity',
    insert: true,
    select: true,
    update: true,
    delete: true,
    ...overrides
  };
}

/**
 * Creates a mock SchemaEntityProperty with sensible defaults.
 * Override any properties as needed for specific test cases.
 */
export function createMockProperty(overrides?: Partial<SchemaEntityProperty>): SchemaEntityProperty {
  return {
    table_catalog: 'civic_os_db',
    table_schema: 'public',
    table_name: 'test_entity',
    column_name: 'test_column',
    display_name: 'Test Column',
    sort_order: 1,
    column_default: '',
    is_nullable: true,
    data_type: 'character varying',
    character_maximum_length: 255,
    udt_schema: 'pg_catalog',
    udt_name: 'varchar',
    is_self_referencing: false,
    is_identity: false,
    is_generated: false,
    is_updatable: true,
    join_schema: '',
    join_table: '',
    join_column: '',
    geography_type: '',
    type: EntityPropertyType.TextShort,
    ...overrides
  };
}

/**
 * Pre-configured property type samples for common test scenarios.
 * Use these to quickly set up tests for each EntityPropertyType.
 */
export const MOCK_PROPERTIES = {
  textShort: createMockProperty({
    column_name: 'name',
    display_name: 'Name',
    data_type: 'character varying',
    udt_name: 'varchar',
    character_maximum_length: 255,
    type: EntityPropertyType.TextShort
  }),

  textLong: createMockProperty({
    column_name: 'description',
    display_name: 'Description',
    data_type: 'text',
    udt_name: 'text',
    character_maximum_length: 0,
    type: EntityPropertyType.TextLong
  }),

  boolean: createMockProperty({
    column_name: 'is_active',
    display_name: 'Is Active',
    data_type: 'boolean',
    udt_name: 'bool',
    type: EntityPropertyType.Boolean
  }),

  integer: createMockProperty({
    column_name: 'count',
    display_name: 'Count',
    data_type: 'integer',
    udt_name: 'int4',
    type: EntityPropertyType.IntegerNumber
  }),

  integerBig: createMockProperty({
    column_name: 'big_count',
    display_name: 'Big Count',
    data_type: 'bigint',
    udt_name: 'int8',
    type: EntityPropertyType.IntegerNumber
  }),

  money: createMockProperty({
    column_name: 'amount',
    display_name: 'Amount',
    data_type: 'money',
    udt_name: 'money',
    type: EntityPropertyType.Money
  }),

  date: createMockProperty({
    column_name: 'due_date',
    display_name: 'Due Date',
    data_type: 'date',
    udt_name: 'date',
    type: EntityPropertyType.Date
  }),

  dateTime: createMockProperty({
    column_name: 'created_at',
    display_name: 'Created At',
    data_type: 'timestamp without time zone',
    udt_name: 'timestamp',
    type: EntityPropertyType.DateTime
  }),

  dateTimeLocal: createMockProperty({
    column_name: 'updated_at',
    display_name: 'Updated At',
    data_type: 'timestamp with time zone',
    udt_name: 'timestamptz',
    type: EntityPropertyType.DateTimeLocal
  }),

  foreignKey: createMockProperty({
    column_name: 'status_id',
    display_name: 'Status',
    data_type: 'integer',
    udt_name: 'int4',
    join_schema: 'public',
    join_table: 'Status',
    join_column: 'id',
    type: EntityPropertyType.ForeignKeyName,
    is_nullable: false
  }),

  user: createMockProperty({
    column_name: 'assigned_to',
    display_name: 'Assigned To',
    data_type: 'uuid',
    udt_name: 'uuid',
    join_table: 'civic_os_users',
    type: EntityPropertyType.User
  }),

  geoPoint: createMockProperty({
    column_name: 'location',
    display_name: 'Location',
    data_type: 'USER-DEFINED',
    udt_name: 'geography',
    geography_type: 'Point',
    type: EntityPropertyType.GeoPoint
  }),

  unknown: createMockProperty({
    column_name: 'unknown_field',
    display_name: 'Unknown Field',
    data_type: 'unknown_type',
    udt_name: 'unknown_type',
    type: EntityPropertyType.Unknown
  })
};

/**
 * Pre-configured entity samples for common test scenarios.
 */
export const MOCK_ENTITIES = {
  issue: createMockEntity({
    table_name: 'Issue',
    display_name: 'Issues',
    sort_order: 1
  }),

  status: createMockEntity({
    table_name: 'Status',
    display_name: 'Statuses',
    sort_order: 2
  }),

  workPackage: createMockEntity({
    table_name: 'WorkPackage',
    display_name: 'Work Packages',
    sort_order: 3
  })
};

/**
 * Mock data samples for testing DisplayPropertyComponent
 */
export const MOCK_DATA = {
  textValue: { name: 'Test Issue' },
  booleanTrue: { is_active: true },
  booleanFalse: { is_active: false },
  integer: { count: 42 },
  money: { amount: '$1,234.56' },
  date: { due_date: '2025-12-31' },
  dateTime: { created_at: '2025-10-04T12:00:00' },
  foreignKey: { status_id: { id: 1, display_name: 'Open' } },
  user: {
    assigned_to: {
      display_name: 'John Doe',
      private: { email: 'john@example.com', phone: '555-1234' }
    }
  },
  geoPoint: { location: 'POINT(-83.6875 43.0125)' },
  geoPointNull: { location: null }
};
