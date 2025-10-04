import { Component, inject, ViewChild } from '@angular/core';
import { Observable, mergeMap, of, tap } from 'rxjs';
import { SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { ActivatedRoute, Router } from '@angular/router';
import { SchemaService } from '../../services/schema.service';

import { EditPropertyComponent } from "../../components/edit-property/edit-property.component";
import { LetDirective } from '@ngrx/component';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { DialogComponent } from "../../components/dialog/dialog.component";

@Component({
    selector: 'app-create',
    templateUrl: './create.page.html',
    styleUrl: './create.page.css',
    imports: [
    EditPropertyComponent,
    LetDirective,
    ReactiveFormsModule,
    DialogComponent
]
})
export class CreatePage {
  private route = inject(ActivatedRoute);
  private schema = inject(SchemaService);
  private data = inject(DataService);
  private router = inject(Router);

  public entityKey?: string;
  public entity$: Observable<SchemaEntityTable | undefined>;
  public properties$: Observable<SchemaEntityProperty[]>;

  public createForm?: FormGroup;
  @ViewChild('successDialog') successDialog!: DialogComponent;
  @ViewChild('errorDialog') errorDialog!: DialogComponent;

  constructor() {
    this.entity$ = this.route.params.pipe(mergeMap(p => {
      this.entityKey = p['entityKey'];
      if(p['entityKey']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of();
      }
    }));
    this.properties$ = this.entity$.pipe(mergeMap(e => {
      if(e) {
        let props = this.schema.getPropsForCreate(e)
          .pipe(tap(props => {
            this.createForm = new FormGroup(
              Object.fromEntries(
                props.map(p => [p.column_name, new FormControl(
                  SchemaService.getDefaultValueForProperty(p), 
                  SchemaService.getFormValidatorsForProperty(p))])
              )
            );
          }));
        return props;
      } else {
        return of([]);
      }
    }));
  }

  submitForm(contents: any) {
    console.log(contents)
    console.log(this.createForm?.value);
    if(this.entityKey && this.createForm) {
      this.data.createData(this.entityKey, this.createForm.value)
        .subscribe(result => {
          console.log(result);
          if(result.success) {
            this.successDialog.open();
          } else {
            this.errorDialog.open(result.error);
          }
        });
    }
  }

  navToList(key?: string) {
    if(key) {
      this.router.navigate(['view', key]);
    } else {
      this.router.navigate(['view', this.entityKey]);
    }
  }
  navToCreate(key?: string) {
    this.createForm?.reset();
    if(key) {
      this.router.navigate(['create', key]);
    } else {
      this.router.navigate(['create', this.entityKey]);
    }
  }
}
