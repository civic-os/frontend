export interface SchemaEntityTable {
    display_name: string,
    sort_order: number,
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
    sort_order: number,
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

    type: EntityPropertyType, // Calculated in Schema Service
}

export enum EntityPropertyType {
    Unknown,
    TextShort,
    TextLong,
    Boolean,
    Date,
    DateTime,
    Money,
    Number,
    ForeignKeyName,
}

export interface EntityData {
    id: number,
    created_at: string,
    updated_at: string,
    display_name: string,
}