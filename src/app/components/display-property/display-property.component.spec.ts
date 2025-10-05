import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { DisplayPropertyComponent } from './display-property.component';
import { EntityPropertyType } from '../../interfaces/entity';
import { MOCK_PROPERTIES, MOCK_DATA, createMockProperty } from '../../testing';
import { GeoPointMapComponent } from '../geo-point-map/geo-point-map.component';
import { DebugElement } from '@angular/core';

describe('DisplayPropertyComponent', () => {
  let component: DisplayPropertyComponent;
  let fixture: ComponentFixture<DisplayPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayPropertyComponent],
      providers: [provideZonelessChangeDetection()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DisplayPropertyComponent);
    component = fixture.componentInstance;
    // Don't call detectChanges here - let each test control when it runs
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('TextShort Type', () => {
    it('should render plain text value', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.datum = MOCK_DATA.textValue;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Test Issue');
    });

    it('should show "Not Set" for null TextShort values', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.datum = null;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('TextLong Type', () => {
    it('should render long text value', () => {
      component.prop = MOCK_PROPERTIES.textLong;
      component.datum = 'This is a long description with many details';
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('long description');
    });
  });

  describe('Boolean Type', () => {
    it('should render checked icon for true value', () => {
      component.prop = MOCK_PROPERTIES.boolean;
      component.datum = MOCK_DATA.booleanTrue;
      component.ngOnInit();
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('.material-symbols-outlined'));
      expect(icon).toBeTruthy();
      expect(icon.nativeElement.textContent.trim()).toBe('check_box');
      expect(icon.nativeElement.classList.contains('text-primary')).toBe(true);
    });

    it('should render unchecked icon for false value', () => {
      component.prop = MOCK_PROPERTIES.boolean;
      component.datum = MOCK_DATA.booleanFalse;
      component.ngOnInit();
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('.material-symbols-outlined'));
      expect(icon).toBeTruthy();
      expect(icon.nativeElement.textContent.trim()).toBe('disabled_by_default');
      expect(icon.nativeElement.classList.contains('text-error')).toBe(true);
    });
  });

  describe('IntegerNumber Type', () => {
    it('should render formatted number', () => {
      component.prop = MOCK_PROPERTIES.integer;
      component.datum = MOCK_DATA.integer;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      // Angular number pipe formats 42 as "42"
      expect(textContent).toContain('42');
    });
  });

  describe('Money Type', () => {
    it('should render currency formatted value', () => {
      component.prop = MOCK_PROPERTIES.money;
      component.datum = 1234.56;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      // Angular currency pipe formats as "$1,234.56"
      expect(textContent).toMatch(/\$.*1.*234.*56/);
    });
  });

  describe('Date Type', () => {
    it('should render formatted date', () => {
      component.prop = MOCK_PROPERTIES.date;
      component.datum = '2025-12-31';
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      // Angular date pipe formats dates
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).not.toBe('Not Set');
    });
  });

  describe('DateTime Type', () => {
    it('should render formatted datetime with medium format', () => {
      component.prop = MOCK_PROPERTIES.dateTime;
      component.datum = '2025-10-04T12:00:00';
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).not.toBe('Not Set');
    });
  });

  describe('DateTimeLocal Type', () => {
    it('should render formatted datetime with full format', () => {
      component.prop = MOCK_PROPERTIES.dateTimeLocal;
      component.datum = '2025-10-04T15:30:00-04:00';
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).not.toBe('Not Set');
    });
  });

  describe('ForeignKeyName Type', () => {
    it('should render linked display_name when linkRelated is true', () => {
      component.prop = MOCK_PROPERTIES.foreignKey;
      component.datum = MOCK_DATA.foreignKey;
      component.linkRelated = true;
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('a'));
      expect(link).toBeTruthy();
      expect(link.nativeElement.textContent.trim()).toBe('Open');
      expect(link.nativeElement.getAttribute('href')).toContain('/view/Status/1');
    });

    it('should render plain display_name when linkRelated is false', () => {
      component.prop = MOCK_PROPERTIES.foreignKey;
      component.datum = MOCK_DATA.foreignKey;
      component.linkRelated = false;
      component.ngOnInit();
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('a'));
      expect(link).toBeFalsy(); // No link should exist

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Open');
    });

    it('should handle null foreign key value', () => {
      component.prop = MOCK_PROPERTIES.foreignKey;
      component.datum = null;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('User Type', () => {
    it('should render user with private information', () => {
      component.prop = MOCK_PROPERTIES.user;
      component.datum = MOCK_DATA.user;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('John Doe');
      expect(textContent).toContain('john@example.com');
    });

    it('should render user without private information', () => {
      component.prop = MOCK_PROPERTIES.user;
      component.datum = { display_name: 'Jane Smith' };
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Jane Smith');
      expect(textContent).not.toContain('@');
    });

    it('should handle null user value', () => {
      component.prop = MOCK_PROPERTIES.user;
      component.datum = null;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('GeoPoint Type', () => {
    it('should render GeoPointMapComponent with WKT value', () => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      component.datum = MOCK_DATA.geoPoint.location;
      component.ngOnInit();
      fixture.detectChanges();

      const mapComponent = fixture.debugElement.query(By.directive(GeoPointMapComponent));
      expect(mapComponent).toBeTruthy();

      const mapInstance = mapComponent.componentInstance as GeoPointMapComponent;
      expect(mapInstance.mode).toBe('display');
      expect(mapInstance.initialValue).toBe('POINT(-83.6875 43.0125)');
      expect(mapInstance.width).toBe('300px');
      expect(mapInstance.height).toBe('200px');
    });

    it('should display coordinates when available', () => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      component.datum = MOCK_DATA.geoPoint.location;
      component.ngOnInit();
      fixture.detectChanges();

      // Simulate coordinates emission from map component
      component.onCoordinatesChange([-83.6875, 43.0125]);
      fixture.detectChanges();

      const coordsDiv = fixture.debugElement.query(By.css('.text-xs'));
      expect(coordsDiv).toBeTruthy();
      const coordsText = coordsDiv.nativeElement.textContent.trim();
      expect(coordsText).toContain('43.0125'); // Latitude
      expect(coordsText).toContain('-83.6875'); // Longitude
    });

    it('should show "No location set" for null GeoPoint', () => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      component.datum = null;
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('No location set');
    });
  });

  describe('Unknown Type', () => {
    it('should render raw datum value for unknown types', () => {
      component.prop = MOCK_PROPERTIES.unknown;
      component.datum = 'Unknown value';
      component.ngOnInit();
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Unknown value');
    });
  });

  describe('Null Handling', () => {
    it('should show "Not Set" for null datum across all types', () => {
      const types = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.integer,
        MOCK_PROPERTIES.money,
        MOCK_PROPERTIES.date
      ];

      types.forEach(prop => {
        component.prop = prop;
        component.datum = null;
        component.ngOnInit();
        fixture.detectChanges();

        const textContent = fixture.nativeElement.textContent.trim();
        expect(textContent).toContain('Not Set');
      });
    });
  });

  describe('onCoordinatesChange()', () => {
    it('should update displayCoordinates when called', () => {
      const coords: [number, number] = [-83.5, 43.2];
      component.onCoordinatesChange(coords);

      expect(component.displayCoordinates).toEqual(coords);
    });

    it('should handle null coordinates', () => {
      component.onCoordinatesChange(null);

      expect(component.displayCoordinates).toBeNull();
    });
  });

  describe('Component Initialization', () => {
    it('should set propType from property type on init', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.ngOnInit();

      expect(component.propType).toBe(EntityPropertyType.TextShort);
    });

    it('should default linkRelated to true', () => {
      expect(component.linkRelated).toBe(true);
    });
  });
});
