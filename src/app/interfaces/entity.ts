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
    TextShort,
    TextLong,
    Date,
    DateTime,
    Money,
    Number,
}