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

export interface SchemaEntityTable {
    display_name: string,
    sort_order: number,
    description: string | null,
    search_fields: string[] | null,
    table_name: string,
    insert: boolean,
    select: boolean,
    update: boolean,
    delete: boolean,
}

export interface SchemaEntityProperty {
    table_catalog: string,
    table_schema: string,
    table_name: string,
    column_name: string,
    display_name: string,
    description?: string,
    sort_order: number,
    column_width?: number,
    sortable?: boolean,
    filterable?: boolean,
    column_default: string,
    is_nullable: boolean,
    data_type: string,
    character_maximum_length: number,
    udt_schema: string,
    udt_name: string,
    is_self_referencing: boolean,
    is_identity: boolean,
    is_generated: boolean,
    is_updatable: boolean,
    join_schema: string,
    join_table: string,
    join_column: string,
    geography_type: string,
    show_on_list?: boolean,
    show_on_create?: boolean,
    show_on_edit?: boolean,
    show_on_detail?: boolean,

    type: EntityPropertyType, // Calculated in Schema Service
}

export enum EntityPropertyType {
    Unknown,
    TextShort,
    TextLong,
    Boolean,
    Date,
    DateTime,
    DateTimeLocal,
    Money,
    IntegerNumber,
    DecimalNumber,
    ForeignKeyName,
    User,
    GeoPoint,
}

export interface EntityData {
    id: number,
    created_at: string,
    updated_at: string,
    display_name: string,
}