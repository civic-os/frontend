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
