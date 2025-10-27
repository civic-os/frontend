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

import { inject, Injectable } from '@angular/core';
import { ApiError } from '../interfaces/api';
import { AnalyticsService } from './analytics.service';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  private analytics = inject(AnalyticsService);

  /**
   * Parse API error to human-readable message with analytics tracking.
   * Use this instance method when possible for analytics support.
   */
  public parseToHumanWithTracking(err: ApiError): string {
    const message = ErrorService.parseToHuman(err);

    // Track error with status code or PostgreSQL error code
    if (err.httpCode) {
      this.analytics.trackError(`HTTP ${err.httpCode}`, err.httpCode);
    } else if (err.code) {
      // Track PostgreSQL error codes as numeric if possible
      const numericCode = parseInt(err.code);
      if (!isNaN(numericCode)) {
        this.analytics.trackError(`PostgreSQL ${err.code}`, numericCode);
      } else {
        this.analytics.trackError(`PostgreSQL ${err.code}`);
      }
    } else {
      this.analytics.trackError(message);
    }

    return message;
  }

  /**
   * Parse API error to human-readable message (static version, no tracking).
   * Kept for backwards compatibility.
   */
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
    } else if(err.httpCode == 401) {
      return "Your session has expired. Please refresh the page to log in again.";
    }
    return "System Error";
  }
}
