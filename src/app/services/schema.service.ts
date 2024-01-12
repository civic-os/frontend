import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { OpenAPIV2 } from 'openapi-types';
import { Observable, map, of, tap } from 'rxjs';
import { EntityForeignRelationship, EntityProperty, EntityPropertyType, SchemaEntityProperty } from '../interfaces/entity';

@Injectable({
  providedIn: 'root'
})
export class SchemaService {
  public schema?: OpenAPIV2.Document;
  public properties?: SchemaEntityProperty;
  public static hideFields: string[] = ['id', 'created_at'];
  public static hideTablePrefixes: string[] = ['schema_', 'meta_'];

  constructor(
    private http: HttpClient,
  ) {

  }

  private getSchema() {
    return this.http.get<OpenAPIV2.Document>(environment.postgrestUrl)
    .pipe(tap(spec => {
      this.schema = spec;
    }));
  }

  public init() {
    // this.getSchema().subscribe();
  }

  public getEntities(): Observable<OpenAPIV2.DefinitionsObject | undefined> {
    let obs = this.schema ? of(this.schema.definitions) : this.getSchema().pipe(map(x => x.definitions));
    return obs.pipe(map(definitions => {
      if(definitions == undefined) {
        return undefined;
      } else {
        let keys = Object.keys(definitions)
          .filter(key => !SchemaService.hideTablePrefixes.some(prefix => key.startsWith(prefix)));
        return Object.entries(definitions)
          .filter(d => keys.includes(d[0]))
          .reduce((ac,a) => ({...ac,[a[0]]:a[1]}),{});
      }
    }));
    // if (this.schema) {
    //   return of(this.schema.definitions);
    // } else {
    //   return this.getSchema().pipe(map(x => x.definitions));
    // }
  }
  public getEntity(key: string) {
    return this.getEntities().pipe(map(e => {
      return e ? e[key] : null;
    }))
  }
  public getPropertiesAndForeignRelationships(entity: OpenAPIV2.SchemaObject): EntityProperty[] {
    if(entity.properties) {
      let props = entity.properties;
      console.log(entity)
      return Object.keys(props).map(name => {
        let val = props[name];
        if(val.type == 'integer' && val['description']?.includes('<fk')) {
          return {
            key: name,
            foreign: this.parseFk(val.description),
            type: EntityPropertyType.ForeignKeyName,
          }
        } else {
          return {
            key: name,
            type: (val.type == 'string' && val['format'] == 'timestamp with time zone') ? EntityPropertyType.DateTime :
              (val.type == 'string' && val['format'] == 'timestamp') ? EntityPropertyType.DateTime :
              (val.type == 'string' && val['format'] == 'date') ? EntityPropertyType.Date :
              (val.type == 'boolean' && val['format'] == 'boolean') ? EntityPropertyType.Boolean :
              (val.type == 'string' && val['format'] == 'money') ? EntityPropertyType.Money :
              (val.type == 'string' && val['format'] == 'character varying') ? EntityPropertyType.TextShort :
              (val.type == 'string' && val['format'] == 'text') ? EntityPropertyType.TextLong : EntityPropertyType.Unknown,
          }
        }
      })
    } else {
      return [];
    }
  }
  private parseFk(fkDesc: string) : EntityForeignRelationship {
    let meta = fkDesc.split('<fk')[1].split('/>')[0].trim();
    let parts = meta.split(' ');
    let table = parts.find(p => p.includes('table'))?.split('=')[1].replace("'", '').replace("'", '');
    let id = parts.find(p => p.includes('id'))?.split('=')[1].replace("'", '').replace("'", '');
    return {
      table: table ?? '',
      column: id ?? '',
    };
  }
  public static propertyToSelectString(prop: EntityProperty): string {
    return prop.foreign ? prop.key + ':' + prop.foreign.table + '(id,display_name)' :
      prop.key;
  }
  public static filterPropsForDisplay(props: EntityProperty[]): EntityProperty[] {
    return props.filter(x => !SchemaService.hideFields.includes(x.key));
  }
}
