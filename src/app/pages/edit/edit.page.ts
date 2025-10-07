import { Component, inject, ViewChild, signal, ChangeDetectionStrategy } from '@angular/core';
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
    changeDetection: ChangeDetectionStrategy.OnPush,
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
  public entity$: Observable<SchemaEntityTable | undefined> = this.route.params.pipe(mergeMap(p => {
    this.entityKey = p['entityKey'];
    this.entityId = p['entityId'];
    if(p['entityKey'] && p['entityId']) {
      return this.schema.getEntity(p['entityKey']);
    } else {
      return of(undefined);
    }
  }));
  public properties$: Observable<SchemaEntityProperty[]> = this.entity$.pipe(mergeMap(e => {
    if(e) {
      return this.schema.getPropsForEdit(e)
        .pipe(tap(props => {
          this.currentProps = props;
        }));
    } else {
      return of([]);
    }
  }));
  public data$: Observable<any> = this.properties$.pipe(mergeMap(props => {
    if(props && props.length > 0 && this.entityKey) {
      let columns = props
        .map(x => SchemaService.propertyToSelectStringForEdit(x));
      return this.data.getData({key: this.entityKey, entityId: this.entityId, fields: columns})
        .pipe(map(x => x[0]));
    } else {
      return of(undefined);
    }
  }),
  tap(data => {
    if (data && this.currentProps.length > 0) {
      // Create form with actual data values, not defaults
      const formConfig = Object.fromEntries(
        this.currentProps.map(p => {
          const value = (data as any)[p.column_name];
          return [
            p.column_name,
            new FormControl(
              value,
              SchemaService.getFormValidatorsForProperty(p)
            )
          ];
        })
      );

      this.editForm.set(new FormGroup(formConfig));
    }
    this.loading.set(false);
  })
  );

  public editForm = signal<FormGroup | undefined>(undefined);
  public loading = signal(true);
  private currentProps: SchemaEntityProperty[] = [];

  @ViewChild('successDialog') successDialog!: DialogComponent;
  @ViewChild('errorDialog') errorDialog!: DialogComponent;

  submitForm(contents: any) {
    const form = this.editForm();
    if(this.entityKey && this.entityId && form) {
      this.data.editData(this.entityKey, this.entityId, form.value)
        .subscribe({
          next: (result) => {
            if(result.success === true) {
              if (this.successDialog) {
                this.successDialog.open();
              } else {
                console.error('Success dialog not available');
              }
            } else {
              if (this.errorDialog) {
                this.errorDialog.open(result.error);
              } else {
                console.error('Error dialog not available', result.error);
              }
            }
          },
          error: (err) => {
            console.error('Unexpected error during edit:', err);
            if (this.errorDialog) {
              this.errorDialog.open({
                httpCode: 500,
                message: 'An unexpected error occurred',
                humanMessage: 'System Error'
              });
            }
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
