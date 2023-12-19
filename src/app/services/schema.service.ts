import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { OpenAPIV2 } from 'openapi-types';
import { Observable, map, of } from 'rxjs';
import { EntityForeignRelationship, EntityProperty, EntityPropertyType } from '../interfaces/entity';

@Injectable({
  providedIn: 'root'
})
export class SchemaService {
  public schema?: OpenAPIV2.Document;
  public static hideFields: string[] = ['id', 'created_at'];

  constructor(
    private http: HttpClient,
  ) {

  }

  private getSchema() {
    return this.http.get<OpenAPIV2.Document>(environment.postgrestUrl)
    .pipe(map(spec => {
      this.schema = spec;
      return spec;
    }));
  }

  public init() {
    // this.getSchema().subscribe();
  }

  public getEntities(): Observable<OpenAPIV2.DefinitionsObject | undefined> {
    if (this.schema) {
      return of(this.schema.definitions);
    } else {
      return this.getSchema().pipe(map(x => x.definitions));
    }
  }
  public getEntity(key: string) {
    return this.getEntities().pipe(map(e => {
      return e ? e[key] : null;
    }))
  }
  public getPropertiesAndForeignRelationships(entity: OpenAPIV2.SchemaObject): EntityProperty[] {
    if(entity.properties) {
      let props = entity.properties;
      return Object.keys(props).map(name => {
        let val = props[name];
        let foreign = (val.type == 'integer' && val['description']?.includes('<fk')) ? this.parseFk(val.description) : null
        let type = (val.type == 'string' && val['format'] == 'timestamp with time zone') ? EntityPropertyType.DateTime :
          (val.type == 'string' && val['format'] == 'timestamp') ? EntityPropertyType.DateTime :
          (val.type == 'string' && val['format'] == 'date') ? EntityPropertyType.Date :
          (val.type == 'string' && val['format'] == 'money') ? EntityPropertyType.Money : null;
      })
    } else {
      return [];
    }
  }
  private parseFk(fkDesc: string) : EntityForeignRelationship {
    let meta = fkDesc.split('<fk')[1].split('/>')[0].trim();
    let parts = meta.split(' ');
    let table = parts.find();
    let id = parts.find();
    return {
      table: table,
      column: id,
    };
  }
}
