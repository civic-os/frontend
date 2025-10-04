import { Component, inject, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';

import { Observable, map, Subscription } from 'rxjs';
import { DataService } from '../../services/data.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { NgxCurrencyDirective } from 'ngx-currency';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-edit-property',
    templateUrl: './edit-property.component.html',
    styleUrl: './edit-property.component.css',
    imports: [
    CommonModule,
    NgxMaskDirective,
    NgxCurrencyDirective,
    ReactiveFormsModule
],
    providers: [
        provideNgxMask(),
    ]
})
export class EditPropertyComponent implements AfterViewInit, OnDestroy {
  private data = inject(DataService);

  @Input('property') prop!: SchemaEntityProperty;
  @Input('formGroup') form!: FormGroup;
  public selectOptions$?: Observable<{id: number, text: string}[]>;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  // GeoPoint properties
  private map?: L.Map;
  private marker?: L.Marker;
  public geoPointLat?: number;
  public geoPointLng?: number;
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

    // Initialize GeoPoint - watch for value changes
    if (this.propType === EntityPropertyType.GeoPoint) {

      // Watch for form value changes (happens when edit page loads data)
      this.valueChangeSubscription = this.form.get(this.prop.column_name)?.valueChanges.subscribe(value => {
        if (value && !this.geoPointLat && !this.geoPointLng) {
          // Parse WKT format from PostgREST: "POINT(lng lat)"
          const coords = this.parseGeographyValue(value);
          if (coords) {
            this.geoPointLng = coords[0];
            this.geoPointLat = coords[1];
            // Reinitialize map with the loaded coordinates
            if (this.map) {
              this.updateMapWithCoordinates();
            }
          }
        }
      });

      // Check if value already exists (for immediate initialization)
      const currentValue = this.form.get(this.prop.column_name)?.value;
      if (currentValue) {
        const coords = this.parseGeographyValue(currentValue);
        if (coords) {
          this.geoPointLng = coords[0];
          this.geoPointLat = coords[1];
        }
      }
    }
  }

  ngOnDestroy() {
    this.valueChangeSubscription?.unsubscribe();
  }

  private parseGeographyValue(value: any): [number, number] | null {
    if (!value) return null;

    // Handle WKT/EWKT format: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
    if (typeof value === 'string') {
      const match = value.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
      if (match) {
        return [parseFloat(match[1]), parseFloat(match[2])];
      }
    }

    return null;
  }

  private getLeafletIcon() {
    // Create explicit icon with correct anchor settings
    // This ensures markers stay aligned at all zoom levels
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
    // Always initialize map for GeoPoint fields
    if (this.propType === EntityPropertyType.GeoPoint) {
      setTimeout(() => {
        this.initializeEditMap();
      }, 0);
    }
  }

  private updateMapWithCoordinates() {
    if (!this.map || this.geoPointLat === undefined || this.geoPointLng === undefined) return;

    // Center map on coordinates
    this.map.setView([this.geoPointLat, this.geoPointLng], environment.map.defaultZoom);

    // Add marker if it doesn't exist
    if (!this.marker) {
      this.marker = L.marker([this.geoPointLat, this.geoPointLng], {
        draggable: true,
        icon: this.getLeafletIcon()
      }).addTo(this.map);

      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        this.geoPointLat = position.lat;
        this.geoPointLng = position.lng;
        this.updateFormValue();
      });
    }
  }

  private initializeEditMap() {
    const mapId = 'edit-map-' + this.prop.column_name;
    const mapElement = document.getElementById(mapId);

    if (!mapElement) return;

    // Determine initial center
    const center: [number, number] = (this.geoPointLat !== undefined && this.geoPointLng !== undefined)
      ? [this.geoPointLat, this.geoPointLng]
      : environment.map.defaultCenter;

    this.map = L.map(mapId, {
      center: center,
      zoom: environment.map.defaultZoom,
      zoomSnap: 1,  // Force integer zoom levels to prevent tile shifting
      zoomDelta: 1  // Zoom by whole levels only
    });

    L.tileLayer(environment.map.tileUrl, {
      attribution: environment.map.attribution
    }).addTo(this.map);

    // Add existing marker if coordinates exist
    if (this.geoPointLat !== undefined && this.geoPointLng !== undefined) {
      this.marker = L.marker([this.geoPointLat, this.geoPointLng], {
        draggable: true,
        icon: this.getLeafletIcon()
      }).addTo(this.map);

      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        this.geoPointLat = position.lat;
        this.geoPointLng = position.lng;
        this.updateFormValue();
      });
    }

    // Click to add/move marker
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      // Adjust click coordinates to account for center anchor vs tip anchor
      // Icon anchor is [12, 21] (center), but we want to place at tip [12, 41]
      // So we need to offset by 20 pixels upward
      const point = this.map!.latLngToContainerPoint(e.latlng);
      point.y -= 20; // Offset by anchor difference (41 - 21 = 20)
      const adjustedLatLng = this.map!.containerPointToLatLng(point);

      this.geoPointLat = adjustedLatLng.lat;
      this.geoPointLng = adjustedLatLng.lng;

      if (this.marker) {
        this.marker.setLatLng(adjustedLatLng);
      } else {
        this.marker = L.marker(adjustedLatLng, {
          draggable: true,
          icon: this.getLeafletIcon()
        }).addTo(this.map!);

        this.marker.on('dragend', () => {
          const position = this.marker!.getLatLng();
          this.geoPointLat = position.lat;
          this.geoPointLng = position.lng;
          this.updateFormValue();
        });
      }

      this.updateFormValue();
    });
  }

  public useCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.geoPointLat = position.coords.latitude;
          this.geoPointLng = position.coords.longitude;

          if (this.map) {
            this.map.setView([this.geoPointLat, this.geoPointLng], environment.map.defaultZoom);

            if (this.marker) {
              this.marker.setLatLng([this.geoPointLat, this.geoPointLng]);
            } else {
              this.marker = L.marker([this.geoPointLat, this.geoPointLng], {
                draggable: true,
                icon: this.getLeafletIcon()
              }).addTo(this.map);

              this.marker.on('dragend', () => {
                const position = this.marker!.getLatLng();
                this.geoPointLat = position.lat;
                this.geoPointLng = position.lng;
                this.updateFormValue();
              });
            }
          }

          this.updateFormValue();
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

  private updateFormValue() {
    if (this.geoPointLat !== undefined && this.geoPointLng !== undefined) {
      // PostgREST expects geography Point in EWKT format: "SRID=4326;POINT(lng lat)"
      const ewkt = `SRID=4326;POINT(${this.geoPointLng} ${this.geoPointLat})`;

      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.form.get(this.prop.column_name)?.setValue(ewkt);
        this.form.get(this.prop.column_name)?.markAsDirty();
      }, 0);
    }
  }

}
