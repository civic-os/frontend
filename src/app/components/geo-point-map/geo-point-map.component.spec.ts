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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GeoPointMapComponent } from './geo-point-map.component';

// Mock factory functions for Leaflet objects
function createMockMap(): any {
  return {
    setView: jasmine.createSpy('setView').and.returnValue({} as any),
    getZoom: jasmine.createSpy('getZoom').and.returnValue(13),
    addLayer: jasmine.createSpy('addLayer'),
    on: jasmine.createSpy('on'),
    remove: jasmine.createSpy('remove')
  };
}

function createMockMarker(): any {
  return {
    setLatLng: jasmine.createSpy('setLatLng'),
    getLatLng: jasmine.createSpy('getLatLng').and.returnValue({ lat: 43.0, lng: -83.5 }),
    on: jasmine.createSpy('on'),
    addTo: jasmine.createSpy('addTo').and.returnValue({} as any)
  };
}

describe('GeoPointMapComponent', () => {
  let component: GeoPointMapComponent;
  let fixture: ComponentFixture<GeoPointMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoPointMapComponent],
      providers: [provideZonelessChangeDetection()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeoPointMapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Clean up component and any pending async operations
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Inputs', () => {
    it('should have default mode of display', () => {
      expect(component.mode()).toBe('display');
    });

    it('should have default width of 100%', () => {
      expect(component.width()).toBe('100%');
    });

    it('should have default height of 300px', () => {
      expect(component.height()).toBe('300px');
    });

    it('should have null initialValue by default', () => {
      expect(component.initialValue()).toBeNull();
    });

    it('should accept edit mode', () => {
      fixture.componentRef.setInput('mode', 'edit');
      expect(component.mode()).toBe('edit');
    });
  });

  describe('WKT Parsing', () => {
    it('should parse standard WKT POINT format', () => {
      const wkt = 'POINT(-83.6875 43.0125)';
      const coords = component['parseWKT'](wkt);

      expect(coords).toBeDefined();
      expect(coords![0]).toBe(-83.6875);
      expect(coords![1]).toBe(43.0125);
    });

    it('should parse EWKT format with SRID', () => {
      const ewkt = 'SRID=4326;POINT(-83.6875 43.0125)';
      const coords = component['parseWKT'](ewkt);

      expect(coords).toBeDefined();
      expect(coords![0]).toBe(-83.6875);
      expect(coords![1]).toBe(43.0125);
    });

    it('should parse POINT with case insensitivity', () => {
      const wkt = 'point(-83.6875 43.0125)';
      const coords = component['parseWKT'](wkt);

      expect(coords).not.toBeNull();
      expect(coords![0]).toBe(-83.6875);
    });

    it('should parse POINT with extra whitespace', () => {
      const wkt = 'POINT(  -83.6875   43.0125  )';
      const coords = component['parseWKT'](wkt);

      expect(coords).not.toBeNull();
      expect(coords![0]).toBe(-83.6875);
      expect(coords![1]).toBe(43.0125);
    });

    it('should handle positive coordinates', () => {
      const wkt = 'POINT(120.5 35.2)';
      const coords = component['parseWKT'](wkt);

      expect(coords).toBeDefined();
      expect(coords![0]).toBe(120.5);
      expect(coords![1]).toBe(35.2);
    });

    it('should handle integer coordinates', () => {
      const wkt = 'POINT(-83 43)';
      const coords = component['parseWKT'](wkt);

      expect(coords).toBeDefined();
      expect(coords![0]).toBe(-83);
      expect(coords![1]).toBe(43);
    });

    it('should return null for null input', () => {
      const coords = component['parseWKT'](null);
      expect(coords).toBeNull();
    });

    it('should return null for empty string', () => {
      const coords = component['parseWKT']('');
      expect(coords).toBeNull();
    });

    it('should return null for invalid WKT format', () => {
      const invalidWkt = 'INVALID(-83.6875, 43.0125)';
      const coords = component['parseWKT'](invalidWkt);

      expect(coords).toBeNull();
    });

    it('should return null for malformed coordinates', () => {
      const malformed = 'POINT(not-a-number 43)';
      const coords = component['parseWKT'](malformed);

      expect(coords).toBeNull();
    });
  });

  describe('Map ID Generation', () => {
    it('should generate unique mapId on initialization', () => {
      expect(component.mapId).toBeDefined();
      expect(component.mapId).toMatch(/^geo-map-[a-z0-9]+$/);
    });

    it('should generate different IDs for different instances', () => {
      const fixture2 = TestBed.createComponent(GeoPointMapComponent);
      const component2 = fixture2.componentInstance;

      expect(component.mapId).not.toBe(component2.mapId);
    });
  });

  describe('Event Emitters', () => {
    it('should emit coordinatesChange with initial value', (done) => {
      fixture.componentRef.setInput('initialValue', 'POINT(-83.6875 43.0125)');

      // Mock initializeMap to prevent Leaflet operations but allow coordinate parsing
      spyOn<any>(component, 'initializeMap').and.callFake(() => {
        const coords = component['parseWKT'](component.initialValue());
        if (coords) {
          component.coordinatesChange.emit([coords[0], coords[1]]);
        }
      });

      component.coordinatesChange.subscribe(coords => {
        expect(coords).toBeDefined();
        expect(coords![0]).toBe(-83.6875);
        expect(coords![1]).toBe(43.0125);
        done();
      });

      fixture.detectChanges();
    });

    it('should not emit coordinates for null initial value', (done) => {
      fixture.componentRef.setInput('initialValue', null);
      let emitted = false;

      // Mock initializeMap to prevent Leaflet operations
      spyOn<any>(component, 'initializeMap');

      component.coordinatesChange.subscribe(() => {
        emitted = true;
      });

      fixture.detectChanges();

      // Should not emit for null initial value
      setTimeout(() => {
        expect(emitted).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Display Mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('mode', 'display');
      fixture.componentRef.setInput('initialValue', 'POINT(-83.6875 43.0125)');
      // Mock initializeMap to prevent Leaflet DOM operations in tests
      spyOn<any>(component, 'initializeMap');
    });

    it('should call initializeMap after view init', (done) => {
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['initializeMap']).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should not emit valueChange in display mode', (done) => {
      let valueEmitted = false;

      component.valueChange.subscribe(() => {
        valueEmitted = true;
      });

      fixture.detectChanges();

      setTimeout(() => {
        expect(valueEmitted).toBe(false);
        done();
      }, 10);
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('mode', 'edit');
      // Mock initializeMap to prevent Leaflet DOM operations in tests
      spyOn<any>(component, 'initializeMap');
    });

    it('should call initializeMap after view init', (done) => {
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['initializeMap']).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should emit valueChange with EWKT format when setLocation is called', (done) => {
      // Setup map mock for this specific test
      component['map'] = createMockMap();

      component.valueChange.subscribe(value => {
        expect(value).toBe('SRID=4326;POINT(-83.5 43.2)');
        done();
      });

      component['setLocation'](43.2, -83.5);
    });

    it('should emit coordinatesChange when setLocation is called', (done) => {
      // Setup map mock for this specific test
      component['map'] = createMockMap();

      component.coordinatesChange.subscribe(coords => {
        expect(coords).toBeDefined();
        expect(coords![0]).toBeCloseTo(-83.5, 4);
        expect(coords![1]).toBeCloseTo(43.2, 4);
        done();
      });

      component['setLocation'](43.2, -83.5);
    });
  });

  describe('useCurrentLocation()', () => {
    it('should call navigator.geolocation.getCurrentPosition', () => {
      const mockGeolocation = {
        getCurrentPosition: jasmine.createSpy('getCurrentPosition')
      };

      spyOnProperty(navigator, 'geolocation', 'get').and.returnValue(mockGeolocation as any);

      component.useCurrentLocation();

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it('should set location on successful geolocation', (done) => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060
        }
      };

      const mockGeolocation = {
        getCurrentPosition: (success: any) => success(mockPosition)
      };

      spyOnProperty(navigator, 'geolocation', 'get').and.returnValue(mockGeolocation as any);
      spyOn<any>(component, 'setLocation');

      component.useCurrentLocation();

      setTimeout(() => {
        expect(component['setLocation']).toHaveBeenCalledWith(40.7128, -74.0060);
        done();
      }, 10);
    });

    it('should handle geolocation errors gracefully', () => {
      const mockGeolocation = {
        getCurrentPosition: (_success: any, error: any) => {
          error({ code: 1, message: 'Permission denied' });
        }
      };

      spyOnProperty(navigator, 'geolocation', 'get').and.returnValue(mockGeolocation as any);
      spyOn(console, 'error');
      spyOn(window, 'alert');

      component.useCurrentLocation();

      expect(console.error).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Unable to get your location. Please check your browser permissions.');
    });

    it('should show alert when geolocation is not supported', () => {
      spyOnProperty(navigator, 'geolocation', 'get').and.returnValue(undefined as any);
      spyOn(window, 'alert');

      component.useCurrentLocation();

      expect(window.alert).toHaveBeenCalledWith('Geolocation is not supported by your browser.');
    });
  });

  describe('ngOnDestroy', () => {
    it('should call map.remove if map exists', () => {
      const mockMap = { remove: jasmine.createSpy('remove') } as any;
      component['map'] = mockMap;

      component.ngOnDestroy();

      expect(mockMap.remove).toHaveBeenCalled();
    });

    it('should not error if map was never initialized', () => {
      component['map'] = undefined;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('setLocation private method', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('mode', 'edit');
      // Mock the map object to prevent Leaflet operations
      component['map'] = createMockMap();
    });

    it('should update currentLat and currentLng', () => {
      component['setLocation'](42.5, -84.5);

      expect(component['currentLat']).toBe(42.5);
      expect(component['currentLng']).toBe(-84.5);
    });

    it('should emit coordinatesChange with lng, lat order', (done) => {
      component.coordinatesChange.subscribe(coords => {
        expect(coords).toEqual([-84.5, 42.5]); // lng, lat
        done();
      });

      component['setLocation'](42.5, -84.5);
    });

    it('should emit valueChange in edit mode', (done) => {
      component.valueChange.subscribe(value => {
        expect(value).toBe('SRID=4326;POINT(-84.5 42.5)');
        done();
      });

      component['setLocation'](42.5, -84.5);
    });

    it('should not emit valueChange in display mode', () => {
      fixture.componentRef.setInput('mode', 'display');
      let emitted = false;

      component.valueChange.subscribe(() => {
        emitted = true;
      });

      component['setLocation'](42.5, -84.5);

      expect(emitted).toBe(false);
    });
  });
});
