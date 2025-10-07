import { Component, inject, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';

import { Observable, map } from 'rxjs';
import { DataService } from '../../services/data.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { NgxCurrencyDirective } from 'ngx-currency';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeoPointMapComponent } from '../geo-point-map/geo-point-map.component';

@Component({
    selector: 'app-edit-property',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './edit-property.component.html',
    styleUrl: './edit-property.component.css',
    imports: [
    CommonModule,
    NgxMaskDirective,
    NgxCurrencyDirective,
    ReactiveFormsModule,
    GeoPointMapComponent
],
    providers: [
        provideNgxMask(),
    ]
})
export class EditPropertyComponent {
  private data = inject(DataService);

  prop = input.required<SchemaEntityProperty>({ alias: 'property' });
  form = input.required<FormGroup>({ alias: 'formGroup' });
  public selectOptions$?: Observable<{id: number, text: string}[]>;

  propType = computed(() => this.prop().type);

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    const prop = this.prop();
    if(this.propType() == EntityPropertyType.ForeignKeyName) {
      this.selectOptions$ = this.data.getData({
        key: prop.join_table,
        fields: ['id:' + prop.join_column, 'display_name'],
        orderField: 'id',
      })
      .pipe(map(data => {
        return data.map(d => {
          return {
            id: d.id,
            text: d.display_name,
          }
        });
      }));
    }
  }

  public onMapValueChange(ewkt: string) {
    // FormControl setValue automatically triggers change detection in OnPush
    // No setTimeout needed with Angular's reactive forms
    const prop = this.prop();
    const form = this.form();
    form.get(prop.column_name)?.setValue(ewkt);
    form.get(prop.column_name)?.markAsDirty();
  }
}
