import { CommonModule } from '@angular/common';
import { Component, Input, AfterViewInit, inject } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { RouterModule } from '@angular/router';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-display-property',
    imports: [
        CommonModule,
        RouterModule,
    ],
    templateUrl: './display-property.component.html',
    styleUrl: './display-property.component.css'
})
export class DisplayPropertyComponent implements AfterViewInit {
  @Input('property') prop!: SchemaEntityProperty;
  @Input('datum') datum: any;
  @Input('linkRelated') linkRelated: boolean = true;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    this.propType = this.prop.type;
  }

  // Helper to parse coordinates from WKT/EWKT format
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

  private getLeafletIcon() {
    // Create explicit icon with correct anchor settings
    // Note: Using center anchor [12, 21] instead of bottom [12, 41] for consistent alignment across zoom levels
    return L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 21],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }

  ngAfterViewInit() {
    // Initialize map for GeoPoint fields
    if (this.propType === EntityPropertyType.GeoPoint && this.datum) {
      setTimeout(() => {
        this.initializeMap();
      }, 0);
    }
  }

  private initializeMap() {
    const mapId = 'map-' + this.prop.column_name;
    const mapElement = document.getElementById(mapId);

    if (!mapElement) return;

    // Parse WKT format from PostgREST computed field
    const coordinates = this.getCoordinates(this.datum);
    if (!coordinates) return;

    // WKT format is [lng, lat], Leaflet uses [lat, lng]
    const lng = coordinates[0];
    const lat = coordinates[1];

    const map = L.map(mapId, {
      center: [lat, lng],
      zoom: 15,
      zoomSnap: 1,  // Force integer zoom levels to prevent tile shifting
      zoomDelta: 1,  // Zoom by whole levels only
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false
    });

    L.tileLayer(environment.map.tileUrl, {
      attribution: environment.map.attribution
    }).addTo(map);

    // Add marker with explicit icon
    L.marker([lat, lng], {
      icon: this.getLeafletIcon()
    }).addTo(map);
  }
}
