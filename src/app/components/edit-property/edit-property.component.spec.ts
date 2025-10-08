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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('TextShort Type', () => {
    it('should render text input', () => {
      const formGroup = new FormGroup({
        name: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="text"]'));
      expect(input).toBeTruthy();
      expect(input.nativeElement.id).toBe('name');
    });

    it('should bind form control to input', () => {
      const formGroup = new FormGroup({
        name: new FormControl('Initial Value')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="text"]')).nativeElement;
      expect(input.value).toBe('Initial Value');
    });
  });

  describe('TextLong Type', () => {
    it('should render textarea', () => {
      const formGroup = new FormGroup({
        description: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textLong);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea).toBeTruthy();
      expect(textarea.nativeElement.id).toBe('description');
    });
  });

  describe('Boolean Type', () => {
    it('should render checkbox', () => {
      const formGroup = new FormGroup({
        is_active: new FormControl(false)
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.boolean);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]'));
      expect(checkbox).toBeTruthy();
      expect(checkbox.nativeElement.classList.contains('toggle')).toBe(true);
    });

    it('should reflect checked state from form control', () => {
      const formGroup = new FormGroup({
        is_active: new FormControl(true)
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.boolean);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(By.css('input[type="checkbox"]')).nativeElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('IntegerNumber Type', () => {
    it('should render number input with step=1', () => {
      const formGroup = new FormGroup({
        count: new FormControl(0)
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.integer);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="number"]'));
      expect(input).toBeTruthy();
      expect(input.nativeElement.getAttribute('step')).toBe('1');
    });
  });

  describe('Money Type', () => {
    it('should render currency input', () => {
      const formGroup = new FormGroup({
        amount: new FormControl(null)
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.money);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[currencyMask]'));
      expect(input).toBeTruthy();
    });
  });

  describe('Date Type', () => {
    it('should render date input', () => {
      const formGroup = new FormGroup({
        due_date: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.date);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="date"]'));
      expect(input).toBeTruthy();
    });
  });

  describe('DateTime Type', () => {
    it('should render datetime input', () => {
      const formGroup = new FormGroup({
        created_at: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.dateTime);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[type="datetime"]'));
      expect(input).toBeTruthy();
    });
  });

  describe('DateTimeLocal Type', () => {
    it('should render datetime-local input', () => {
      const formGroup = new FormGroup({
        updated_at: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.dateTimeLocal);
      fixture.componentRef.setInput('formGroup', formGroup);
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

      const formGroup = new FormGroup({
        status_id: new FormControl(null)
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.foreignKey);
      fixture.componentRef.setInput('formGroup', formGroup);
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

    it('should include null option for nullable foreign keys', async () => {
      mockDataService.getData.and.returnValue(of([{ id: 1, display_name: 'Option', created_at: '', updated_at: '' }] as any));

      const formGroup = new FormGroup({
        status_id: new FormControl(null)
      });
      fixture.componentRef.setInput('property', createMockProperty({
        ...MOCK_PROPERTIES.foreignKey,
        is_nullable: true
      }));
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      await new Promise(resolve => setTimeout(resolve, 10));
      fixture.detectChanges();

      const options = fixture.debugElement.queryAll(By.css('option'));
      expect(options[0].nativeElement.textContent).toContain('Select an Option');
    });

    it('should not include null option for non-nullable foreign keys', async () => {
      mockDataService.getData.and.returnValue(of([{ id: 1, display_name: 'Option', created_at: '', updated_at: '' }] as any));

      const formGroup = new FormGroup({
        status_id: new FormControl(1)
      });
      fixture.componentRef.setInput('property', createMockProperty({
        ...MOCK_PROPERTIES.foreignKey,
        is_nullable: false
      }));
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      await new Promise(resolve => setTimeout(resolve, 10));
      fixture.detectChanges();

      const options = fixture.debugElement.queryAll(By.css('option'));
      // Should only have data options, no "Select an Option"
      expect(options.length).toBe(1);
      expect(options[0].nativeElement.textContent).toContain('Option');
    });
  });

  describe('GeoPoint Type', () => {
    it('should render GeoPointMapComponent in edit mode', () => {
      const formGroup = new FormGroup({
        location: new FormControl(null)
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const mapComponent = fixture.debugElement.query(By.directive(GeoPointMapComponent));
      expect(mapComponent).toBeTruthy();

      const mapInstance = mapComponent.componentInstance as GeoPointMapComponent;
      expect(mapInstance.mode()).toBe('edit');
      expect(mapInstance.width()).toBe('100%');
      expect(mapInstance.height()).toBe('250px');
    });

    it('should update form control when map value changes', async () => {
      const formControl = new FormControl<string | null>(null);
      const formGroup = new FormGroup({
        location: formControl
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const newValue = 'SRID=4326;POINT(-83.5 43.2)';
      component.onMapValueChange(newValue);

      // onMapValueChange uses setTimeout(0), wait for it
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(formControl.value).toBe(newValue);
      expect(formControl.dirty).toBe(true);
    });
  });

  describe('Unknown Type', () => {
    it('should not render any input for unknown types', () => {
      const formGroup = new FormGroup({
        unknown_field: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.unknown);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const inputs = fixture.debugElement.queryAll(By.css('input, select, textarea'));
      // Should only find the label, no actual input elements
      expect(inputs.length).toBe(0);
    });
  });

  describe('Label Rendering', () => {
    it('should render label with display_name', () => {
      const formGroup = new FormGroup({
        name: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).toContain('Name');
    });

    it('should add asterisk for required (non-nullable) fields', () => {
      const formGroup = new FormGroup({
        name: new FormControl('')
      });
      fixture.componentRef.setInput('property', createMockProperty({
        ...MOCK_PROPERTIES.textShort,
        is_nullable: false
      }));
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).toContain('*');
    });

    it('should not add asterisk for nullable fields', () => {
      const formGroup = new FormGroup({
        name: new FormControl('')
      });
      fixture.componentRef.setInput('property', createMockProperty({
        ...MOCK_PROPERTIES.textShort,
        is_nullable: true
      }));
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('label'));
      expect(label.nativeElement.textContent).not.toContain('*');
    });
  });

  describe('Validation Error Display', () => {
    it('should show required error when field is touched and empty', () => {
      const formControl = new FormControl('', { validators: [] });
      const formGroup = new FormGroup({
        name: formControl
      });
      fixture.componentRef.setInput('property', createMockProperty({
        ...MOCK_PROPERTIES.textShort,
        is_nullable: false
      }));
      fixture.componentRef.setInput('formGroup', formGroup);
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
      const formControl = new FormControl('Valid Value');
      const formGroup = new FormGroup({
        name: formControl
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeFalsy();
    });

    it('should not show error when field is invalid but not touched', () => {
      const formControl = new FormControl('');
      formControl.setErrors({ required: true });
      const formGroup = new FormGroup({
        name: formControl
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeFalsy();
    });

    it('should show error when field is dirty and invalid', () => {
      const formControl = new FormControl('');
      const formGroup = new FormGroup({
        name: formControl
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();
      fixture.detectChanges();

      // Mark as dirty and set errors after initialization
      formControl.markAsDirty();
      formControl.setErrors({ required: true });
      fixture.detectChanges();

      const errorDiv = fixture.debugElement.query(By.css('.text-error'));
      expect(errorDiv).toBeTruthy();
    });
  });

  describe('Component Initialization', () => {
    it('should set propType from property type on init', () => {
      const formGroup = new FormGroup({
        name: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();

      expect(component.propType()).toBe(EntityPropertyType.TextShort);
    });

    it('should not call getData for non-ForeignKey types', () => {
      const formGroup = new FormGroup({
        name: new FormControl('')
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.textShort);
      fixture.componentRef.setInput('formGroup', formGroup);
      component.ngOnInit();

      expect(mockDataService.getData).not.toHaveBeenCalled();
    });
  });

  describe('onMapValueChange()', () => {
    it('should update form control value and mark as dirty', async () => {
      const formControl = new FormControl('');
      const formGroup = new FormGroup({
        location: formControl
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('formGroup', formGroup);

      const newValue = 'SRID=4326;POINT(-80.5 40.2)';
      component.onMapValueChange(newValue);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(formControl.value).toBe(newValue);
      expect(formControl.dirty).toBe(true);
    });

    it('should handle empty string value from map', async () => {
      const formControl = new FormControl('initial value');
      const formGroup = new FormGroup({
        location: formControl
      });
      fixture.componentRef.setInput('property', MOCK_PROPERTIES.geoPoint);
      fixture.componentRef.setInput('formGroup', formGroup);

      component.onMapValueChange('');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(formControl.value).toBe('');
    });
  });

  describe('Label and Tooltip Display', () => {
    it('should display property label', () => {
      const mockProperty = createMockProperty({
        column_name: 'test_field',
        display_name: 'Test Field'
      });

      const formGroup = new FormGroup({ test_field: new FormControl('') });
      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('formGroup', formGroup);
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('label span');
      expect(label.textContent).toContain('Test Field');
    });

    it('should display tooltip when description exists', () => {
      const mockProperty = createMockProperty({
        column_name: 'test',
        description: 'This is a helpful description'
      });

      const formGroup = new FormGroup({ test: new FormControl('') });
      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('formGroup', formGroup);
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector('.tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip.getAttribute('data-tip')).toBe('This is a helpful description');
    });

    it('should not display tooltip when description is null', () => {
      const mockProperty = createMockProperty({
        column_name: 'test',
        description: undefined
      });

      const formGroup = new FormGroup({ test: new FormControl('') });
      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('formGroup', formGroup);
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector('.tooltip');
      expect(tooltip).toBeFalsy();
    });

    it('should use font-semibold for label', () => {
      const mockProperty = createMockProperty({ column_name: 'test' });

      const formGroup = new FormGroup({ test: new FormControl('') });
      fixture.componentRef.setInput('property', mockProperty);
      fixture.componentRef.setInput('formGroup', formGroup);
      fixture.detectChanges();

      const labelSpan = fixture.nativeElement.querySelector('label span');
      expect(labelSpan.classList.contains('font-semibold')).toBe(true);
    });
  });
});
