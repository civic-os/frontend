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
