import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityData } from '../interfaces/entity';
import { DataQuery } from '../interfaces/query';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(
    private http: HttpClient,
  ) {
    
  }

  private get(url: string): Observable<any> {
    return this.http.get(environment.postgrestUrl + url);
  }

  public getData(query: DataQuery): Observable<EntityData[]> {
    let args: string[] = [];
    if(query.fields) {
      if(!query.fields.includes('id')) {
        query.fields.push('id');
      }
      args.push('select=' + query.fields.join(','));
    }
    if(query.orderField) {
      args.push('order='+query.orderField+'.'+(query.orderDirection ?? 'asc'))
    }
    if(query.entityId) {
      args.push('id=eq.' + query.entityId);
    }
    let url = query.key + '?' + args.join('&');
    return this.get(url);
  }
}
