import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
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
  @Input('property') prop!: SchemaEntityProperty;
  @Input('datum') datum: any;
  @Input('linkRelated') linkRelated: boolean = true;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    this.propType = this.prop.type;
  }

  // Helper to parse coordinates from WKT/EWKT format for display
  getCoordinates(datum: any): number[] | null {
    if (!datum) return null;

    // Handle WKT/EWKT format: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
    if (typeof datum === 'string') {
      const match = datum.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
      if (match) {
        return [parseFloat(match[1]), parseFloat(match[2])];
      }
    }

    return null;
  }
}
