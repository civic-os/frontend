import { Component, inject, Input, OnDestroy } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';

import { Observable, map, Subscription } from 'rxjs';
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
export class EditPropertyComponent implements OnDestroy {
  private data = inject(DataService);

  @Input('property') prop!: SchemaEntityProperty;
  @Input('formGroup') form!: FormGroup;
  public selectOptions$?: Observable<{id: number, text: string}[]>;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  // GeoPoint properties
  public currentLocation?: { lat: number; lng: number };
  private valueChangeSubscription?: Subscription;

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

  ngOnDestroy() {
    this.valueChangeSubscription?.unsubscribe();
  }

  public useCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please check your browser permissions.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
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
