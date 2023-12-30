import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityData } from '../interfaces/entity';

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

  public getData(key: string, fields: string[], entityId?: string): Observable<EntityData[]> {
    let args: string[] = [];
    if(fields) {
      args.push('select=' + fields.join(','));
    }
    if(entityId) {
      args.push('id=eq.' + entityId);
    }
    let url = key + '?' + args.join('&');
    return this.get(url);
  }
}
