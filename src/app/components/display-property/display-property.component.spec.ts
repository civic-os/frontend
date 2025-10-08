import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
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
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([])
      ]
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
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('datum', 'Test Issue');  // Pass string directly, not wrapped in object
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Test Issue');
    });

    it('should show "Not Set" for null TextShort values', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('datum', null);
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('TextLong Type', () => {
    it('should render long text value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textLong);
      fixture.componentRef.setInput('datum', 'This is a long description with many details');
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('long description');
    });
  });

  describe('Boolean Type', () => {
    it('should render checked icon for true value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.boolean);
      fixture.componentRef.setInput('datum', true);  // Boolean value directly, not wrapped in object
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('.material-symbols-outlined'));
      expect(icon).toBeTruthy();
      expect(icon.nativeElement.textContent.trim()).toBe('check_box');
      expect(icon.nativeElement.classList.contains('text-primary')).toBe(true);
    });

    it('should render unchecked icon for false value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.boolean);
      fixture.componentRef.setInput('datum', false);  // Boolean value directly, not wrapped in object
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.css('.material-symbols-outlined'));
      expect(icon).toBeTruthy();
      expect(icon.nativeElement.textContent.trim()).toBe('disabled_by_default');
      expect(icon.nativeElement.classList.contains('text-error')).toBe(true);
    });
  });

  describe('IntegerNumber Type', () => {
    it('should render formatted number', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.integer);
      fixture.componentRef.setInput('datum', 42);  // Number directly, not wrapped in object
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      // Angular number pipe formats 42 as "42"
      expect(textContent).toContain('42');
    });
  });

  describe('Money Type', () => {
    it('should render currency formatted value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.money);
      fixture.componentRef.setInput('datum', 1234.56);
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      // Angular currency pipe formats as "$1,234.56"
      expect(textContent).toMatch(/\$.*1.*234.*56/);
    });
  });

  describe('Date Type', () => {
    it('should render formatted date', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.date);
      fixture.componentRef.setInput('datum', '2025-12-31');
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      // Angular date pipe formats dates
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).not.toBe('Not Set');
    });
  });

  describe('DateTime Type', () => {
    it('should render formatted datetime with medium format', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.dateTime);
      fixture.componentRef.setInput('datum', '2025-10-04T12:00:00');
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).not.toBe('Not Set');
    });
  });

  describe('DateTimeLocal Type', () => {
    it('should render formatted datetime with full format', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.dateTimeLocal);
      fixture.componentRef.setInput('datum', '2025-10-04T15:30:00-04:00');
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent.length).toBeGreaterThan(0);
      expect(textContent).not.toBe('Not Set');
    });
  });

  describe('ForeignKeyName Type', () => {
    it('should render linked display_name when linkRelated is true', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.foreignKey);
      fixture.componentRef.setInput('datum', { id: 1, display_name: 'Open' });  // ForeignKey data directly, not nested
      fixture.componentRef.setInput('linkRelated', true);
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('a'));
      expect(link).toBeTruthy();
      expect(link.nativeElement.textContent.trim()).toBe('Open');
      expect(link.nativeElement.getAttribute('href')).toContain('/view/Status/1');
    });

    it('should render plain display_name when linkRelated is false', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.foreignKey);
      fixture.componentRef.setInput('datum', { id: 1, display_name: 'Open' });  // ForeignKey data directly, not nested
      fixture.componentRef.setInput('linkRelated', false);
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('a'));
      expect(link).toBeFalsy(); // No link should exist

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Open');
    });

    it('should handle null foreign key value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.foreignKey);
      fixture.componentRef.setInput('datum', null);
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('User Type', () => {
    it('should render user with private information', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.user);
      fixture.componentRef.setInput('datum', {
        display_name: 'John Doe',
        private: {
          display_name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234'
        }
      });
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('John Doe');
      expect(textContent).toContain('john@example.com');
    });

    it('should render user without private information', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.user);
      fixture.componentRef.setInput('datum', { display_name: 'Jane Smith' });
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Jane Smith');
      expect(textContent).not.toContain('@');
    });

    it('should handle null user value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.user);
      fixture.componentRef.setInput('datum', null);
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('GeoPoint Type', () => {
    it('should render GeoPointMapComponent with WKT value', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('datum', MOCK_DATA.geoPoint.location);
      fixture.detectChanges();

      const mapComponent = fixture.debugElement.query(By.directive(GeoPointMapComponent));
      expect(mapComponent).toBeTruthy();

      const mapInstance = mapComponent.componentInstance as GeoPointMapComponent;
      expect(mapInstance.mode()).toBe('display');
      expect(mapInstance.initialValue()).toBe('POINT(-83.6875 43.0125)');
      expect(mapInstance.width()).toBe('100%');
      expect(mapInstance.height()).toBe('200px');
    });

    it('should display coordinates when available', async () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('datum', MOCK_DATA.geoPoint.location);
      fixture.detectChanges();

      // Simulate coordinates emission from map component
      component.onCoordinatesChange([-83.6875, 43.0125]);
      await new Promise(resolve => setTimeout(resolve, 10));
      fixture.detectChanges();

      const coordsDiv = fixture.debugElement.query(By.css('.text-xs'));
      expect(coordsDiv).toBeTruthy();
      const coordsText = coordsDiv.nativeElement.textContent.trim();
      expect(coordsText).toContain('43.0125'); // Latitude
      expect(coordsText).toContain('-83.6875'); // Longitude
    });

    it('should show "Not Set" for null GeoPoint', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('datum', null);
      fixture.detectChanges();

      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toContain('Not Set');
    });
  });

  describe('Unknown Type', () => {
    it('should render raw datum value for unknown types', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.unknown);
      fixture.componentRef.setInput('datum', 'Unknown value');
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
        fixture.componentRef.setInput('property', prop);
        fixture.componentRef.setInput('datum', null);
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

      expect(component.displayCoordinates()).toEqual(coords);
    });

    it('should handle null coordinates', () => {
      component.onCoordinatesChange(null);

      expect(component.displayCoordinates()).toBeNull();
    });
  });

  describe('Component Initialization', () => {
    it('should set propType from property type on init', () => {
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);

      expect(component.propType()).toBe(EntityPropertyType.TextShort);
    });

    it('should default linkRelated to true', () => {
      expect(component.linkRelated()).toBe(true);
    });
  });

  describe('Label and Tooltip Display', () => {
    it('should display property label', () => {
      const mockProperty = createMockProperty({
        display_name: 'Field Name'
      });

      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('datum', 'test value');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label span');
      expect(label.textContent).toContain('Field Name');
    });

    it('should display tooltip when description exists', () => {
      const mockProperty = createMockProperty({
        description: 'Detailed information about this field'
      });

      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('datum', 'value');
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector('.tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip.getAttribute('data-tip')).toBe('Detailed information about this field');
    });

    it('should not display tooltip when description is null', () => {
      const mockProperty = createMockProperty({
        description: undefined
      });

      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('datum', 'value');
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector('.tooltip');
      expect(tooltip).toBeFalsy();
    });
  });
});
