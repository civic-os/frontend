import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
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
  private http = inject(HttpClient);

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
    return this.http.post(environment.postgrestUrl + entity, data, {
      headers: {
        Prefer: 'return=representation'
      }
    })
      .pipe(
        catchError((err) => this.parseApiError(err)),
        map((response: any) => {
          // If it's already an error response from catchError, return as-is
          if (response && typeof response === 'object' && 'success' in response && response.success === false) {
            return response as ApiResponse;
          }
          // Otherwise, it's a successful HTTP response
          return <ApiResponse>{success: true, body: response};
        }),
      );
  }
  public editData(entity: string, id: string | number, data: any): Observable<ApiResponse> {
    return this.http.patch(environment.postgrestUrl + entity + '?id=eq.' + id, data, {
      headers: {
        Prefer: 'return=representation'
      }
    })
      .pipe(
        catchError((err) => this.parseApiError(err)),
        map((response) => {
          // If it's already an error response from catchError, return as-is
          if (response && typeof response === 'object' && 'success' in response && response.success === false) {
            return response as ApiResponse;
          }
          // Otherwise, it's a successful HTTP response - wrap it
          return this.checkEditResult(data, {success: true, body: response});
        }),
      );
  }

  public refreshCurrentUser(): Observable<ApiResponse> {
    return this.http.post(environment.postgrestUrl + 'rpc/refresh_current_user', {})
      .pipe(
        catchError((err) => this.parseApiError(err)),
        map((response) => {
          // If it's already an error response from catchError, return as-is
          if (response && typeof response === 'object' && 'success' in response && response.success === false) {
            return response as ApiResponse;
          }
          // Otherwise, it's a successful response
          return <ApiResponse>{success: true, body: response};
        }),
      );
  }

  private parseApiResponse(body: any) {
    // Check if it's already an error response with strict equality
    if(body && typeof body === 'object' && 'success' in body && body.success === false) {
      return body;
    } else {
      return <ApiResponse>{success: true, body: body};
    }
  }
  private checkEditResult(input: any, representation: any) {
    // If it's already an error response, return it as-is
    if (representation?.success === false) {
      return representation;
    }

    let identical: boolean;
    if(representation?.body?.[0] === undefined) {
      identical = false;
    } else {
      identical = (representation !== undefined) && Object.keys(input).every(key => {
        return input[key] === representation.body[0][key];
      });
    }

    if (identical) {
      return <ApiResponse>{success: true, body: representation.body};
    } else {
      return <ApiResponse>{
        success: false,
        error: {
          httpCode: 400,
          message: "The update was not applied. The returned data does not match the submitted data.",
          humanMessage: "Could not update",
          hint: "Please verify your changes and try again. If the problem persists, contact support."
        }
      };
    }
  }
  private parseApiError(evt: HttpErrorResponse): Observable<ApiResponse> {
    // Safely handle various error response formats
    let error: ApiError;

    if (evt.error && typeof evt.error === 'object') {
      // PostgREST or structured error response
      error = {
        httpCode: evt.status,
        code: evt.error.code,
        details: evt.error.details,
        hint: evt.error.hint,
        message: evt.error.message || evt.statusText || 'Unknown error',
        humanMessage: '' // Will be set below
      };
    } else {
      // Unstructured error (string, null, undefined, network error, etc.)
      error = {
        httpCode: evt.status,
        message: typeof evt.error === 'string' ? evt.error : (evt.statusText || 'Unknown error'),
        humanMessage: '' // Will be set below
      };
    }

    error.humanMessage = ErrorService.parseToHuman(error);
    let resp: ApiResponse = {success: false, error: error};
    return of(resp);
  }
}
