import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { RouterModule } from '@angular/router';
import { GeoPointMapComponent } from '../geo-point-map/geo-point-map.component';

@Component({
    selector: 'app-display-property',
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

  propType!: EntityPropertyType;
  displayCoordinates: [number, number] | null = null;

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    this.propType = this.prop().type;
  }

  onCoordinatesChange(coords: [number, number] | null) {
    this.displayCoordinates = coords;
  }
}
