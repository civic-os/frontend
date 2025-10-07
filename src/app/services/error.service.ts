import { Injectable } from '@angular/core';
import { ApiError } from '../interfaces/api';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  public static parseToHuman(err: ApiError): string {
    //https://postgrest.org/en/stable/references/errors.html
    if(err.code == '42501') {
      return "Permissions error";
    } else if(err.code == '23505') {
      return "Record must be unique";
    } else if(err.httpCode == 404) {
      return "Resource not found";
    }
    return "System Error";
  }
}
