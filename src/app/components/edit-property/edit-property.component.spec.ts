import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { EditPropertyComponent } from './edit-property.component';
import { DataService } from '../../services/data.service';
import { EntityPropertyType } from '../../interfaces/entity';
import { MOCK_PROPERTIES, createMockProperty } from '../../testing';
import { GeoPointMapComponent } from '../geo-point-map/geo-point-map.component';

describe('EditPropertyComponent', () => {
  let component: EditPropertyComponent;
  let fixture: ComponentFixture<EditPropertyComponent>;
  let mockDataService: jasmine.SpyObj<DataService>;

  beforeEach(async () => {
    mockDataService = jasmine.createSpyObj('DataService', ['getData']);

    await TestBed.configureTestingModule({
      imports: [EditPropertyComponent, ReactiveFormsModule],
      providers: [
        provideZonelessChangeDetection(),
        { provide: DataService, useValue: mockDataService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditPropertyComponent);
    component = fixture.componentInstance;

    // Setup basic form for all tests
    component.form = new FormGroup({});
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('TextShort Type', () => {
    it('should render text input', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.form.addControl('name', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="text"]'));
      expect(input).toBeTruthy();
      expect(input.nativeElement.id).toBe('name');
    });

    it('should bind form control to input', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.form.addControl('name', new FormControl('Initial Value'));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="text"]')).nativeElement;
      expect(input.value).toBe('Initial Value');
    });
  });

  describe('TextLong Type', () => {
    it('should render textarea', () => {
      component.prop = MOCK_PROPERTIES.textLong;
      component.form.addControl('description', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea).toBeTruthy();
      expect(textarea.nativeElement.id).toBe('description');
    });
  });

  describe('Boolean Type', () => {
    it('should render checkbox', () => {
      component.prop = MOCK_PROPERTIES.boolean;
      component.form.addControl('is_active', new FormControl(false));
      component.ngOnInit();
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]'));
      expect(checkbox).toBeTruthy();
      expect(checkbox.nativeElement.classList.contains('toggle')).toBe(true);
    });

    it('should reflect checked state from form control', () => {
      component.prop = MOCK_PROPERTIES.boolean;
      component.form.addControl('is_active', new FormControl(true));
      component.ngOnInit();
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]')).nativeElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('IntegerNumber Type', () => {
    it('should render number input with step=1', () => {
      component.prop = MOCK_PROPERTIES.integer;
      component.form.addControl('count', new FormControl(0));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="number"]'));
      expect(input).toBeTruthy();
      expect(input.nativeElement.getAttribute('step')).toBe('1');
    });
  });

  describe('Money Type', () => {
    it('should render currency input', () => {
      component.prop = MOCK_PROPERTIES.money;
      component.form.addControl('amount', new FormControl(null));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[currencyMask]'));
      expect(input).toBeTruthy();
    });
  });

  describe('Date Type', () => {
    it('should render date input', () => {
      component.prop = MOCK_PROPERTIES.date;
      component.form.addControl('due_date', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="date"]'));
      expect(input).toBeTruthy();
    });
  });

  describe('DateTime Type', () => {
    it('should render datetime input', () => {
      component.prop = MOCK_PROPERTIES.dateTime;
      component.form.addControl('created_at', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="datetime"]'));
      expect(input).toBeTruthy();
    });
  });

  describe('DateTimeLocal Type', () => {
    it('should render datetime-local input', () => {
      component.prop = MOCK_PROPERTIES.dateTimeLocal;
      component.form.addControl('updated_at', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="datetime-local"]'));
      expect(input).toBeTruthy();
    });
  });

  describe('ForeignKeyName Type', () => {
    it('should fetch dropdown options on init', (done) => {
      const mockOptions = [
        { id: 1, display_name: 'Option 1', created_at: '', updated_at: '' },
        { id: 2, display_name: 'Option 2', created_at: '', updated_at: '' }
      ];

      mockDataService.getData.and.returnValue(of(mockOptions as any));

      component.prop = MOCK_PROPERTIES.foreignKey;
      component.form.addControl('status_id', new FormControl(null));
      component.ngOnInit();

      expect(mockDataService.getData).toHaveBeenCalledWith({
        key: 'Status',
        fields: ['id:id', 'display_name'],
        orderField: 'id'
      });

      component.selectOptions$?.subscribe(options => {
        expect(options.length).toBe(2);
        expect(options[0]).toEqual({ id: 1, text: 'Option 1' });
        expect(options[1]).toEqual({ id: 2, text: 'Option 2' });
        done();
      });
    });

    it('should render select dropdown with options', (done) => {
      const mockOptions = [
        { id: 1, display_name: 'Open', created_at: '', updated_at: '' },
        { id: 2, display_name: 'Closed', created_at: '', updated_at: '' }
      ];

      mockDataService.getData.and.returnValue(of(mockOptions as any));

      component.prop = MOCK_PROPERTIES.foreignKey;
      component.form.addControl('status_id', new FormControl(null));
      component.ngOnInit();
      fixture.detectChanges();

      // Wait for async pipe to render
      setTimeout(() => {
        fixture.detectChanges();

        const select = fixture.debugElement.query(By.css('select'));
        expect(select).toBeTruthy();

        const options = fixture.debugElement.queryAll(By.css('option'));
        // Should have 3 options: "Select an Option" + 2 data options (is_nullable defaults to true in mock)
        expect(options.length).toBe(3);
        expect(options[1].nativeElement.textContent).toContain('Open');
        expect(options[2].nativeElement.textContent).toContain('Closed');

        done();
      }, 100);
    });

    it('should include null option for nullable foreign keys', (done) => {
      mockDataService.getData.and.returnValue(of([{ id: 1, display_name: 'Option', created_at: '', updated_at: '' }] as any));

      component.prop = createMockProperty({
        ...MOCK_PROPERTIES.foreignKey,
        is_nullable: true
      });
      component.form.addControl('status_id', new FormControl(null));
      component.ngOnInit();
      fixture.detectChanges();

      setTimeout(() => {
        fixture.detectChanges();

        const options = fixture.debugElement.queryAll(By.css('option'));
        expect(options[0].nativeElement.textContent).toContain('Select an Option');

        done();
      }, 100);
    });

    it('should not include null option for non-nullable foreign keys', (done) => {
      mockDataService.getData.and.returnValue(of([{ id: 1, display_name: 'Option', created_at: '', updated_at: '' }] as any));

      component.prop = createMockProperty({
        ...MOCK_PROPERTIES.foreignKey,
        is_nullable: false
      });
      component.form.addControl('status_id', new FormControl(1));
      component.ngOnInit();
      fixture.detectChanges();

      setTimeout(() => {
        fixture.detectChanges();

        const options = fixture.debugElement.queryAll(By.css('option'));
        // Should only have data options, no "Select an Option"
        expect(options.length).toBe(1);
        expect(options[0].nativeElement.textContent).toContain('Option');

        done();
      }, 100);
    });
  });

  describe('GeoPoint Type', () => {
    it('should render GeoPointMapComponent in edit mode', () => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      component.form.addControl('location', new FormControl(null));
      component.ngOnInit();
      fixture.detectChanges();

      const mapComponent = fixture.debugElement.query(By.directive(GeoPointMapComponent));
      expect(mapComponent).toBeTruthy();

      const mapInstance = mapComponent.componentInstance as GeoPointMapComponent;
      expect(mapInstance.mode).toBe('edit');
      expect(mapInstance.width).toBe('100%');
      expect(mapInstance.height).toBe('300px');
    });

    it('should update form control when map value changes', (done) => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      const formControl = new FormControl<string | null>(null);
      component.form.addControl('location', formControl);
      component.ngOnInit();
      fixture.detectChanges();

      const newValue = 'SRID=4326;POINT(-83.5 43.2)';
      component.onMapValueChange(newValue);

      // onMapValueChange uses setTimeout, so we need to wait
      setTimeout(() => {
        expect(formControl.value).toBe(newValue);
        expect(formControl.dirty).toBe(true);
        done();
      }, 10);
    });
  });

  describe('Unknown Type', () => {
    it('should not render any input for unknown types', () => {
      component.prop = MOCK_PROPERTIES.unknown;
      component.form.addControl('unknown_field', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const inputs = fixture.debugElement.queryAll(By.css('input, select, textarea'));
      // Should only find the label, no actual input elements
      expect(inputs.length).toBe(0);
    });
  });

  describe('Label Rendering', () => {
    it('should render label with display_name', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.form.addControl('name', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).toContain('Name');
    });

    it('should add asterisk for required (non-nullable) fields', () => {
      component.prop = createMockProperty({
        ...MOCK_PROPERTIES.textShort,
        is_nullable: false
      });
      component.form.addControl('name', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).toContain('*');
    });

    it('should not add asterisk for nullable fields', () => {
      component.prop = createMockProperty({
        ...MOCK_PROPERTIES.textShort,
        is_nullable: true
      });
      component.form.addControl('name', new FormControl(''));
      component.ngOnInit();
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).not.toContain('*');
    });
  });

  describe('Validation Error Display', () => {
    it('should show required error when field is touched and empty', () => {
      component.prop = createMockProperty({
        ...MOCK_PROPERTIES.textShort,
        is_nullable: false
      });
      const formControl = new FormControl('', { validators: [] });
      component.form.addControl('name', formControl);
      component.ngOnInit();
      fixture.detectChanges();

      // Simulate user interaction
      formControl.markAsTouched();
      formControl.setErrors({ required: true });
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.nativeElement.textContent).toContain('Name is required');
    });

    it('should not show error when field is valid', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      const formControl = new FormControl('Valid Value');
      component.form.addControl('name', formControl);
      component.ngOnInit();
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeFalsy();
    });

    it('should not show error when field is invalid but not touched', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      const formControl = new FormControl('');
      formControl.setErrors({ required: true });
      component.form.addControl('name', formControl);
      component.ngOnInit();
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeFalsy();
    });

    it('should show error when field is dirty and invalid', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      const formControl = new FormControl('');
      formControl.markAsDirty();
      formControl.setErrors({ required: true });
      component.form.addControl('name', formControl);
      component.ngOnInit();
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeTruthy();
    });
  });

  describe('Component Initialization', () => {
    it('should set propType from property type on init', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.form.addControl('name', new FormControl(''));
      component.ngOnInit();

      expect(component.propType).toBe(EntityPropertyType.TextShort);
    });

    it('should not call getData for non-ForeignKey types', () => {
      component.prop = MOCK_PROPERTIES.textShort;
      component.form.addControl('name', new FormControl(''));
      component.ngOnInit();

      expect(mockDataService.getData).not.toHaveBeenCalled();
    });
  });

  describe('onMapValueChange()', () => {
    it('should update form control value and mark as dirty', (done) => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      const formControl = new FormControl('');
      component.form.addControl('location', formControl);

      const newValue = 'SRID=4326;POINT(-80.5 40.2)';
      component.onMapValueChange(newValue);

      setTimeout(() => {
        expect(formControl.value).toBe(newValue);
        expect(formControl.dirty).toBe(true);
        done();
      }, 10);
    });

    it('should handle empty string value from map', (done) => {
      component.prop = MOCK_PROPERTIES.geoPoint;
      const formControl = new FormControl('initial value');
      component.form.addControl('location', formControl);

      component.onMapValueChange('');

      setTimeout(() => {
        expect(formControl.value).toBe('');
        done();
      }, 10);
    });
  });
});
