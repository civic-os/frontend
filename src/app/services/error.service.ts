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
    } else if(err.code == '23514') {
      // CHECK constraint violation
      // Try to extract constraint name from details or message
      // PostgreSQL format: 'new row for relation "table_name" violates check constraint "constraint_name"'
      const constraintMatch = err.details?.match(/constraint "([^"]+)"/) || err.message?.match(/constraint "([^"]+)"/);
      if (constraintMatch && constraintMatch[1]) {
        const constraintName = constraintMatch[1];
        // TODO: In a real implementation, we would look up the constraint_name in metadata.constraint_messages
        // For now, return a generic message with the constraint name
        return `Validation failed: ${constraintName}`;
      }
      return "Validation failed";
    } else if(err.httpCode == 404) {
      return "Resource not found";
    }
    return "System Error";
  }
}
