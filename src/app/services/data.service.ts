import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

  public getData(key: string, fields: string[]): Observable<any[]> {
    let url = key + '?';
    if(fields) {
      url += 'select=' + fields.join(',');
    }
    return this.get(url);
  }
}
