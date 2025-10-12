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


import { Component, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Observable, mergeMap, of, tap, map } from 'rxjs';
import { SchemaEntityProperty, SchemaEntityTable, EntityPropertyType } from '../../interfaces/entity';
import { ActivatedRoute, Router } from '@angular/router';
import { SchemaService } from '../../services/schema.service';

import { EditPropertyComponent } from "../../components/edit-property/edit-property.component";
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { DialogComponent } from "../../components/dialog/dialog.component";

@Component({
    selector: 'app-create',
    templateUrl: './create.page.html',
    styleUrl: './create.page.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
    EditPropertyComponent,
    CommonModule,
    ReactiveFormsModule,
    DialogComponent
]
})
export class CreatePage {
  private route = inject(ActivatedRoute);
  private schema = inject(SchemaService);
  private data = inject(DataService);
  private router = inject(Router);

  // Expose Math and SchemaService to template
  protected readonly Math = Math;
  protected readonly SchemaService = SchemaService;

  public entityKey?: string;
  public entity$: Observable<SchemaEntityTable | undefined> = this.route.params.pipe(mergeMap(p => {
    this.entityKey = p['entityKey'];
    if(p['entityKey']) {
      return this.schema.getEntity(p['entityKey']);
    } else {
      return of(undefined);
    }
  }));
  public properties$: Observable<SchemaEntityProperty[]> = this.entity$.pipe(mergeMap(e => {
    if(e) {
      // Filter OUT M:M properties - they can only be edited on Detail page after entity is created
      let props = this.schema.getPropsForCreate(e)
        .pipe(
          map(props => props.filter(p => p.type !== EntityPropertyType.ManyToMany)),
          tap(props => {
            this.createForm = new FormGroup(
              Object.fromEntries(
                props.map(p => [
                  p.column_name,
                  new FormControl(
                    SchemaService.getDefaultValueForProperty(p),
                    SchemaService.getFormValidatorsForProperty(p)
                  )
                ])
              )
            );
          })
        );
      return props;
    } else {
      return of([]);
    }
  }));

  public createForm?: FormGroup;
  @ViewChild('successDialog') successDialog!: DialogComponent;
  @ViewChild('errorDialog') errorDialog!: DialogComponent;

  submitForm(contents: any) {
    if(this.entityKey && this.createForm) {
      const formData = this.createForm.value;

      // M:M properties are filtered out, so just create the entity directly
      this.data.createData(this.entityKey, formData)
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
            console.error('Unexpected error during create:', err);
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
  navToCreate(key?: string) {
    this.createForm?.reset();
    if(key) {
      this.router.navigate(['create', key]);
    } else {
      this.router.navigate(['create', this.entityKey]);
    }
  }
}
