import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { OpenAPIV2 } from 'openapi-types';
import { Observable, map, of } from 'rxjs';

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
}
