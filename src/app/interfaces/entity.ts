export interface EntityProperty {
    name: string,
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