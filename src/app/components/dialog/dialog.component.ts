import { Component, ElementRef, ViewChild } from '@angular/core';
import { ApiError } from '../../interfaces/api';


@Component({
    selector: 'app-dialog',
    imports: [],
    templateUrl: './dialog.component.html',
    styleUrl: './dialog.component.css'
})
export class DialogComponent {
  @ViewChild('dialog') dialog!: ElementRef<HTMLDialogElement>;
  public error?: ApiError;

  constructor(
    
  ) {

  }

  public open(error?: ApiError) {
    this.error = error;
    this.dialog.nativeElement.showModal();
  }
}
