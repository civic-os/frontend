import { Component, Input, Output, EventEmitter, AfterViewInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-geo-point-map',
  imports: [],
  templateUrl: './geo-point-map.component.html',
  styleUrl: './geo-point-map.component.css'
})
export class GeoPointMapComponent implements AfterViewInit, OnDestroy {
  @Input() mode: 'display' | 'edit' = 'display';
  @Input() initialValue: string | null = null;
  @Input() width: string = '100%';
  @Input() height: string = '300px';
  @Input() maxWidth?: string;

  @Output() valueChange = new EventEmitter<string>();
  @Output() coordinatesChange = new EventEmitter<[number, number] | null>();

  private map?: L.Map;
  private marker?: L.Marker;
  private currentLat?: number;
  private currentLng?: number;
  public mapId = 'geo-map-' + Math.random().toString(36).substring(2, 9);

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeMap();
    }, 0);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private parseWKT(value: string | null): [number, number] | null {
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

  private initializeMap() {
    const mapElement = document.getElementById(this.mapId);
    if (!mapElement) return;

    // Parse initial coordinates
    const coords = this.parseWKT(this.initialValue);
    if (coords) {
      this.currentLng = coords[0];
      this.currentLat = coords[1];
      // Emit initial coordinates
      this.coordinatesChange.emit([coords[0], coords[1]]);
    }

    // Determine initial center
    const center: [number, number] = (this.currentLat !== undefined && this.currentLng !== undefined)
      ? [this.currentLat, this.currentLng]
      : environment.map.defaultCenter;

    // Create map with mode-specific options
    const mapOptions: L.MapOptions = {
      center: center,
      zoom: this.mode === 'display' ? 15 : environment.map.defaultZoom,
      zoomSnap: 1,
      zoomDelta: 1,
    };

    // Disable all interactions for display mode
    if (this.mode === 'display') {
      Object.assign(mapOptions, {
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false
      });
    }

    this.map = L.map(this.mapId, mapOptions);

    L.tileLayer(environment.map.tileUrl, {
      attribution: environment.map.attribution
    }).addTo(this.map);

    // Add existing marker if coordinates exist
    if (this.currentLat !== undefined && this.currentLng !== undefined) {
      this.createMarker(this.currentLat, this.currentLng);
    }

    // Add click handler for edit mode
    if (this.mode === 'edit') {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        // Adjust click coordinates to account for center anchor vs tip anchor
        const point = this.map!.latLngToContainerPoint(e.latlng);
        point.y -= 20; // Offset by anchor difference (41 - 21 = 20)
        const adjustedLatLng = this.map!.containerPointToLatLng(point);

        this.setLocation(adjustedLatLng.lat, adjustedLatLng.lng);
      });
    }
  }

  private createMarker(lat: number, lng: number) {
    const isDraggable = this.mode === 'edit';

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], {
        draggable: isDraggable,
        icon: this.getLeafletIcon()
      }).addTo(this.map!);

      if (isDraggable) {
        this.marker.on('dragend', () => {
          const position = this.marker!.getLatLng();
          this.setLocation(position.lat, position.lng);
        });
      }
    }
  }

  private setLocation(lat: number, lng: number) {
    this.currentLat = lat;
    this.currentLng = lng;

    if (this.map) {
      this.map.setView([lat, lng], this.map.getZoom());
    }

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.createMarker(lat, lng);
    }

    // Emit coordinates for display
    this.coordinatesChange.emit([lng, lat]);

    // Emit value change for edit mode
    if (this.mode === 'edit') {
      const ewkt = `SRID=4326;POINT(${lng} ${lat})`;
      this.valueChange.emit(ewkt);
    }
  }

  public useCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.setLocation(position.coords.latitude, position.coords.longitude);
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
}
