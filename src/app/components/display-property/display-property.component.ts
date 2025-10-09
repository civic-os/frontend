import { CommonModule } from '@angular/common';
import { Component, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { RouterModule } from '@angular/router';
import { GeoPointMapComponent } from '../geo-point-map/geo-point-map.component';

@Component({
    selector: 'app-display-property',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        RouterModule,
        GeoPointMapComponent,
    ],
    templateUrl: './display-property.component.html',
    styleUrl: './display-property.component.css'
})
export class DisplayPropertyComponent {
  prop = input.required<SchemaEntityProperty>({ alias: 'property' });
  datum = input<any>();
  linkRelated = input<boolean>(true);
  showLabel = input<boolean>(true);

  propType = computed(() => this.prop().type);
  displayCoordinates = signal<[number, number] | null>(null);

  public EntityPropertyType = EntityPropertyType;

  onCoordinatesChange(coords: [number, number] | null) {
    this.displayCoordinates.set(coords);
  }
}
