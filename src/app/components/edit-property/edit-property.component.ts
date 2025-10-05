import { Component, inject, Input } from '@angular/core';
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

  @Input('property') prop!: SchemaEntityProperty;
  @Input('formGroup') form!: FormGroup;
  public selectOptions$?: Observable<{id: number, text: string}[]>;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    this.propType = this.prop.type;
    if(this.propType == EntityPropertyType.ForeignKeyName) {
      this.selectOptions$ = this.data.getData({
        key: this.prop.join_table,
        fields: ['id:' + this.prop.join_column, 'display_name'],
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
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.form.get(this.prop.column_name)?.setValue(ewkt);
      this.form.get(this.prop.column_name)?.markAsDirty();
    }, 0);
  }
}
