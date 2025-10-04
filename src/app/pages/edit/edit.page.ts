import { Component, inject, ViewChild } from '@angular/core';
import { SchemaService } from '../../services/schema.service';
import { Observable, map, mergeMap, of, tap } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { DialogComponent } from '../../components/dialog/dialog.component';

import { EditPropertyComponent } from '../../components/edit-property/edit-property.component';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-edit',
    imports: [
    EditPropertyComponent,
    CommonModule,
    ReactiveFormsModule,
    DialogComponent
],
    templateUrl: './edit.page.html',
    styleUrl: './edit.page.css'
})
export class EditPage {
  private route = inject(ActivatedRoute);
  private schema = inject(SchemaService);
  private data = inject(DataService);
  private router = inject(Router);

  public entityKey?: string;
  public entityId?: string;
  public entity$: Observable<SchemaEntityTable | undefined>;
  public properties$: Observable<SchemaEntityProperty[]>;
  public data$: Observable<any>;

  public editForm?: FormGroup;
  @ViewChild('successDialog') successDialog!: DialogComponent;
  @ViewChild('errorDialog') errorDialog!: DialogComponent;

  constructor() {
    this.entity$ = this.route.params.pipe(mergeMap(p => {
      this.entityKey = p['entityKey'];
      this.entityId = p['entityId'];
      if(p['entityKey'] && p['entityId']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of();
      }
    }));
    this.properties$ = this.entity$.pipe(mergeMap(e => {
      if(e) {
        let props = this.schema.getPropsForEdit(e)
          .pipe(tap(props => {
            this.editForm = new FormGroup(
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
    this.data$ = this.properties$.pipe(mergeMap(props => {
      if(props && this.entityKey) {
        let columns = props
          .map(x => SchemaService.propertyToSelectString(x));
        return this.data.getData({key: this.entityKey, entityId: this.entityId, fields: columns})
          .pipe(map(x => x[0]));
      } else {
        return of();
      }
    }),
    tap(data => {
      Object.keys(data)
        .filter(key => !['id'].includes(key))
        .forEach(key => this.editForm?.controls[key].setValue((<any>data)[key]));
    })
    );
  }

  submitForm(contents: any) {
    console.log(this.entityKey, this.entityId, this.editForm)
    console.log(this.editForm?.value);
    if(this.entityKey && this.entityId && this.editForm) {
      this.data.editData(this.entityKey, this.entityId, this.editForm.value)
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
  navToRecord(key: string, id?: string) {
    this.router.navigate(['view', key, id]);
  }
}
