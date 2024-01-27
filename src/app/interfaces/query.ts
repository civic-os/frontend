export interface DataQuery {
    key: string;
    fields: string[];
    entityId?: string;
    orderField?: string;
    orderDirection?: string;
}