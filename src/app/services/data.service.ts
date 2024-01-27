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
        catchError(this.parseApiError),
        map(this.parseApiResponse),
      );
  }
  public editData(entity: string, id: string | number, data: any): Observable<ApiResponse> {
    return this.http.patch(environment.postgrestUrl + entity + '?id=eq.' + id, data, {
      headers: {
        Prefer: 'return=representation'
      }
    })
      .pipe(
        catchError(this.parseApiError),
        map(this.parseApiResponse),
        map(x => this.checkEditResult(data, x)),
      );
  }

  private parseApiResponse(body: any) {
    if(body.success == false) {
      return body;
    } else {
      return <ApiResponse>{success: true, body: body};
    }
  }
  private checkEditResult(input: any, representation: any) {
    console.log(input, representation.body[0]);
    let identical: boolean;
    if(representation?.body[0] == undefined) {
      identical = false;
    } else {
      identical = (representation != undefined) && Object.keys(input).every(key => {
        return input[key] == representation.body[0][key];
      });
    }
    return <ApiResponse>{success: identical, error: identical ? null : {humanMessage: "Could not update", message: "Please contact support"}};
  }
  private parseApiError(evt: HttpErrorResponse): Observable<ApiResponse> {
    let error = <ApiError>evt.error;
    error.httpCode = evt.status;
    error.humanMessage = ErrorService.parseToHuman(error);
    let resp: ApiResponse = {success: false, error: error};
    return of(resp);
  }
}
