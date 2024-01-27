import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, map, of, tap } from 'rxjs';
import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../interfaces/entity';
import { ValidatorFn, Validators } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class SchemaService {
  public properties?: SchemaEntityProperty[];
  public tables?: SchemaEntityTable[];
  public static hideFields: string[] = ['id', 'created_at', 'updated_at'];

  constructor(
    private http: HttpClient,
  ) {

  }

  private getSchema() {
    return this.http.get<SchemaEntityTable[]>(environment.postgrestUrl + 'schema_entities')
    .pipe(tap(tables => {
      this.tables = tables;
    }));
  }

  public init() {
    // this.getSchema().subscribe();
  }

  public getEntities(): Observable<SchemaEntityTable[]> {
    return this.tables ? of(this.tables) : this.getSchema();
  }
  public getEntity(key: string): Observable<SchemaEntityTable | undefined> {
    return this.getEntities().pipe(map(e => {
      return e.find(x => x.table_name == key);
    }));
  }
  public getProperties(): Observable<SchemaEntityProperty[]> {
    return this.properties ? of(this.properties) : this.http.get<SchemaEntityProperty[]>(environment.postgrestUrl + 'schema_properties')
    .pipe(
      map(props => {
        return props.map(p => {
          p.type = this.getPropertyType(p);
          return p;
        })
      }),
      tap(props => {
        this.properties = props;
      })
    );
  }
  public getPropertiesForEntity(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getProperties().pipe(map(props => {
      return props.filter(p => p.table_name == table.table_name);
    }));
  }
  private getPropertyType(val: SchemaEntityProperty): EntityPropertyType {
    return (['int4', 'int8'].includes(val.udt_name) && val.join_column != null) ? EntityPropertyType.ForeignKeyName :
      ['timestamp'].includes(val.udt_name) ? EntityPropertyType.DateTime :
      ['timestamptz'].includes(val.udt_name) ? EntityPropertyType.DateTimeLocal :
      ['date'].includes(val.udt_name) ? EntityPropertyType.Date :
      ['bool'].includes(val.udt_name) ? EntityPropertyType.Boolean :
      ['int4', 'int8'].includes(val.udt_name) ? EntityPropertyType.IntegerNumber :
      ['money'].includes(val.udt_name) ? EntityPropertyType.Money :
      ['varchar'].includes(val.udt_name) ? EntityPropertyType.TextShort :
      ['text'].includes(val.udt_name) ? EntityPropertyType.TextLong : 
      EntityPropertyType.Unknown;
  }
  public static propertyToSelectString(prop: SchemaEntityProperty): string {
    return (prop.join_schema == 'public' && prop.join_column) ? prop.column_name + ':' + prop.join_table + '(' + prop.join_column + ',display_name)' :
      prop.column_name;
  }
  public getPropsForList(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props.filter(p =>{
          return !SchemaService.hideFields.includes(p.column_name);
        });
      }));
  }
  public getPropsForDetail(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props.filter(p =>{
          return !SchemaService.hideFields.includes(p.column_name);
        });
      }));
  }
  public getPropsForCreate(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props.filter(p =>{
          return !(p.is_generated || p.is_identity) && 
            p.is_updatable &&
            !SchemaService.hideFields.includes(p.column_name);
        });
      }));    
  }
  public getPropsForEdit(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropsForCreate(table);
  }
  public static getFormValidatorsForProperty(prop: SchemaEntityProperty): ValidatorFn[] {
    let validators:ValidatorFn[] = [];

    if(!prop.is_nullable) {
      validators.push(Validators.required);
    }
    return validators;
  }
  public static getDefaultValueForProperty(prop: SchemaEntityProperty): any {
    if(prop.type == EntityPropertyType.Boolean) {
      return false;
    }
    return null;
  }
}
