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

import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { ApiError } from '../../interfaces/api';


@Component({
    selector: 'app-dialog',
    imports: [],
    templateUrl: './dialog.component.html',
    styleUrl: './dialog.component.css'
})
export class DialogComponent {
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;

  // Use Signal for reactive state in Angular 20
  public error = signal<ApiError | undefined>(undefined);

  public open(errorParam?: ApiError) {
    // Validate and normalize error parameter
    if (errorParam !== undefined && errorParam !== null) {
      // An error was passed - validate it has required fields
      if (!errorParam.humanMessage || !errorParam.message) {
        console.warn('Dialog error object missing required fields, filling in defaults:', errorParam);
        this.error.set({
          humanMessage: errorParam.humanMessage || 'An error occurred',
          message: errorParam.message || 'Unknown error',
          httpCode: errorParam.httpCode,
          code: errorParam.code,
          details: errorParam.details,
          hint: errorParam.hint
        });
      } else {
        this.error.set(errorParam);
      }
    } else {
      // No error passed - success dialog
      this.error.set(undefined);
    }

    this.dialog.nativeElement.showModal();
  }
}
