export interface EntityProperty {
    key: string,
    name?: string,
    description?: string,
    type: EntityPropertyType,
    foreign?: EntityForeignRelationship,
}

export interface EntityForeignRelationship {
    table: string,
    column: string,
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
    display_name: string,
}