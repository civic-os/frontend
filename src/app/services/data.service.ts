import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, filter, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { EntityData } from '../interfaces/entity';
import { DataQuery } from '../interfaces/query';
import { ApiError, ApiResponse } from '../interfaces/api';
import { ErrorService } from './error.service';

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

  public createData(entity: string, data: any): Observable<ApiResponse> {
    return this.http.post(environment.postgrestUrl + entity, data)
      .pipe(
        map(this.parseApiResponse),
        catchError(this.parseApiError)
      );
  }

  private parseApiResponse(body: any) {
    return <ApiResponse>{success: true, body: body};
  }
  private parseApiError(evt: HttpErrorResponse): Observable<ApiResponse> {
    let error = <ApiError>evt.error;
    error.httpCode = evt.status;
    error.humanMessage = ErrorService.parseToHuman(error);
    let resp: ApiResponse = {success: false, error: error};
    return of(resp);
  }
}
