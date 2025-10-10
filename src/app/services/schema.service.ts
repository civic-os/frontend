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

import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, filter, map, of, ReplaySubject, tap } from 'rxjs';
import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../interfaces/entity';
import { ValidatorFn, Validators } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class SchemaService {
  private http = inject(HttpClient);

  public properties?: SchemaEntityProperty[];
  private tables = signal<SchemaEntityTable[] | undefined>(undefined);
  private tablesSubject = new ReplaySubject<SchemaEntityTable[]>(1);

  // Sync signal to subject for backward compatibility with Observable API
  private _syncEffect = effect(() => {
    const tables = this.tables();
    if (tables !== undefined) {
      this.tablesSubject.next(tables);
    }
  });

  private getSchema() {
    return this.http.get<SchemaEntityTable[]>(environment.postgrestUrl + 'schema_entities')
    .pipe(tap(tables => {
      this.tables.set(tables);
    }));
  }

  public init() {
    // Load schema on init
    this.getSchema().subscribe();
  }

  public refreshCache() {
    // Refresh schema in background - new values will emit to subscribers
    this.getSchema().subscribe();
    this.getProperties().subscribe();
  }

  public getEntities(): Observable<SchemaEntityTable[]> {
    // If no data yet, trigger a fetch in the background
    if (!this.tables()) {
      this.getSchema().subscribe();
    }

    // Return observable that's synced with signal via effect
    return this.tablesSubject.asObservable();
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
  public getPropertiesForEntityFresh(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    // Fetch fresh from database, bypass cache
    return this.http.get<SchemaEntityProperty[]>(environment.postgrestUrl + 'schema_properties')
      .pipe(
        map(props => {
          return props
            .filter(p => p.table_name == table.table_name)
            .map(p => {
              p.type = this.getPropertyType(p);
              return p;
            });
        })
      );
  }
  private getPropertyType(val: SchemaEntityProperty): EntityPropertyType {
    return (['int4', 'int8'].includes(val.udt_name) && val.join_column != null) ? EntityPropertyType.ForeignKeyName :
      (['uuid'].includes(val.udt_name) && val.join_table == 'civic_os_users') ? EntityPropertyType.User :
      (['geography'].includes(val.udt_name) && val.geography_type == 'Point') ? EntityPropertyType.GeoPoint :
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
    return (prop.type == EntityPropertyType.User) ? prop.column_name + ':civic_os_users!' + prop.column_name + '(display_name,private:civic_os_users_private(display_name,phone,email))' :
      (prop.join_schema == 'public' && prop.join_column) ? prop.column_name + ':' + prop.join_table + '(' + prop.join_column + ',display_name)' :
      (prop.type == EntityPropertyType.GeoPoint) ? prop.column_name + ':' + prop.column_name + '_text' :
      prop.column_name;
  }

  /**
   * Returns the PostgREST select string for a property in edit forms.
   * For FK fields, returns only the column name (raw ID) instead of embedded objects.
   * Edit forms need primitive IDs for form controls, not display objects.
   */
  public static propertyToSelectStringForEdit(prop: SchemaEntityProperty): string {
    // For FK fields in edit forms, we only need the raw ID value
    if (prop.type === EntityPropertyType.ForeignKeyName) {
      return prop.column_name;
    }

    // GeoPoint still needs the computed _text field
    if (prop.type === EntityPropertyType.GeoPoint) {
      return prop.column_name + ':' + prop.column_name + '_text';
    }

    // User fields also need just the ID for edit forms
    if (prop.type === EntityPropertyType.User) {
      return prop.column_name;
    }

    // Everything else uses the column name directly
    return prop.column_name;
  }
  public getPropsForList(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props
          .filter(p => p.show_on_list !== false)
          .sort((a, b) => a.sort_order - b.sort_order);
      }));
  }
  public getPropsForDetail(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props
          .filter(p => p.show_on_detail !== false)
          .sort((a, b) => a.sort_order - b.sort_order);
      }));
  }
  public getPropsForCreate(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props
          .filter(p =>{
            return !(p.is_generated || p.is_identity) &&
              p.is_updatable &&
              p.show_on_create !== false;
          })
          .sort((a, b) => a.sort_order - b.sort_order);
      }));
  }
  public getPropsForEdit(table: SchemaEntityTable): Observable<SchemaEntityProperty[]> {
    return this.getPropertiesForEntity(table)
      .pipe(map(props => {
        return props
          .filter(p =>{
            return !(p.is_generated || p.is_identity) &&
              p.is_updatable &&
              p.show_on_edit !== false;
          })
          .sort((a, b) => a.sort_order - b.sort_order);
      }));
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

  /**
   * Get the column span for a property based on custom width or type-based defaults
   */
  public static getColumnSpan(property: SchemaEntityProperty): number {
    // Use custom width if set, otherwise use type-based defaults
    if (property.column_width) {
      return property.column_width;
    }

    // Default widths based on property type
    switch (property.type) {
      case EntityPropertyType.TextLong:
      case EntityPropertyType.GeoPoint:
        return 2;
      default:
        return 1;
    }
  }
}
