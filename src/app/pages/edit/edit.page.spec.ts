import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { EditPage } from './edit.page';
import { SchemaService } from '../../services/schema.service';
import { DataService } from '../../services/data.service';
import { BehaviorSubject, of } from 'rxjs';
import { MOCK_ENTITIES, MOCK_PROPERTIES, createMockProperty } from '../../testing';

describe('EditPage', () => {
  let component: EditPage;
  let fixture: ComponentFixture<EditPage>;
  let mockSchemaService: jasmine.SpyObj<SchemaService>;
  let mockDataService: jasmine.SpyObj<DataService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let routeParams: BehaviorSubject<any>;

  beforeEach(async () => {
    routeParams = new BehaviorSubject({ entityKey: 'Issue', entityId: '42' });

    mockSchemaService = jasmine.createSpyObj('SchemaService', [
      'getEntity',
      'getPropsForEdit'
    ]);
    mockDataService = jasmine.createSpyObj('DataService', ['getData', 'editData']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [EditPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: routeParams.asObservable() } },
        { provide: SchemaService, useValue: mockSchemaService },
        { provide: DataService, useValue: mockDataService },
        { provide: Router, useValue: mockRouter }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Observable Chain Integration', () => {
    it('should load entity metadata from route params', (done) => {
      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(entity => {
        expect(entity).toBeDefined();
        expect(entity?.table_name).toBe('Issue');
        expect(mockSchemaService.getEntity).toHaveBeenCalledWith('Issue');
        done();
      });
    });

    it('should store entityKey and entityId from route params', (done) => {
      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(() => {
        expect(component.entityKey).toBe('Issue');
        expect(component.entityId).toBe('42');
        done();
      });
    });

    it('should return undefined when entityKey or entityId is missing', (done) => {
      routeParams.next({ entityKey: 'Issue' });
      mockSchemaService.getEntity.and.returnValue(of(undefined));

      component.entity$.subscribe(entity => {
        expect(entity).toBeUndefined();
        expect(mockSchemaService.getEntity).not.toHaveBeenCalled();
        done();
      });
    });

    it('should fetch properties for edit form', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.foreignKey
      ];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of([{ id: 42, name: 'Test' }] as any));

      component.properties$.subscribe(props => {
        expect(props.length).toBe(2);
        expect(mockSchemaService.getPropsForEdit).toHaveBeenCalledWith(MOCK_ENTITIES.issue);
        done();
      });
    });

    it('should fetch existing record data', (done) => {
      const mockProps = [MOCK_PROPERTIES.textShort];
      const mockData = [{ id: 42, name: 'Existing Issue' }];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of(mockData as any));

      component.data$.subscribe(data => {
        expect(mockDataService.getData).toHaveBeenCalledWith({
          key: 'Issue',
          fields: ['name'],
          entityId: '42'
        });
        expect(data).toEqual({ id: 42, name: 'Existing Issue' });
        done();
      });
    });
  });

  describe('Form Generation and Population', () => {
    it('should create form with controls for each editable property', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.integer
      ];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of([{ id: 42, name: 'Test', count: 5 }] as any));

      component.data$.subscribe(() => {
        expect(component.editForm()).toBeDefined();
        expect(component.editForm()?.get('name')).toBeDefined();
        expect(component.editForm()?.get('count')).toBeDefined();
        done();
      });
    });

    it('should populate form with existing data', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.integer,
        MOCK_PROPERTIES.boolean
      ];
      const mockData = [{ id: 42, name: 'Test Issue', count: 10, is_active: true }];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of(mockData as any));

      component.data$.subscribe(() => {
        expect(component.editForm()?.get('name')?.value).toBe('Test Issue');
        expect(component.editForm()?.get('count')?.value).toBe(10);
        expect(component.editForm()?.get('is_active')?.value).toBe(true);
        done();
      });
    });

    it('should not populate id field (filtered out)', (done) => {
      const mockProps = [MOCK_PROPERTIES.textShort];
      const mockData = [{ id: 42, name: 'Test' }];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of(mockData as any));

      component.data$.subscribe(() => {
        // Note: FormGroup.get returns null for non-existent controls, not undefined
        expect(component.editForm()?.get('id')).toBeNull();
        done();
      });
    });

    it('should add validators for required fields', (done) => {
      const mockProps = [
        createMockProperty({ ...MOCK_PROPERTIES.textShort, is_nullable: false })
      ];
      const mockData = [{ id: 42, name: '' }];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of(mockData as any));

      component.data$.subscribe(() => {
        const nameControl = component.editForm()?.get('name');
        nameControl?.setValue('');
        expect(nameControl?.hasError('required')).toBe(true);
        done();
      });
    });
  });

  describe('submitForm()', () => {
    beforeEach(() => {
      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of([MOCK_PROPERTIES.textShort]));
      mockDataService.getData.and.returnValue(of([{ id: 42, name: 'Old Name' }] as any));

      // Initialize component and dialogs FIRST
      fixture.detectChanges();

      // THEN spy on the dialog components
      spyOn(component.successDialog, 'open');
      spyOn(component.errorDialog, 'open');
    });

    it('should call editData with form values', (done) => {
      mockDataService.editData.and.returnValue(of({ success: true }));

      component.data$.subscribe(() => {
        component.editForm()?.patchValue({ name: 'Updated Name' });
        component.submitForm({});

        setTimeout(() => {
          expect(mockDataService.editData).toHaveBeenCalledWith(
            'Issue',
            '42',
            { name: 'Updated Name' }
          );
          done();
        }, 10);
      });
    });

    it('should open success dialog on successful update', (done) => {
      mockDataService.editData.and.returnValue(of({ success: true }));

      component.data$.subscribe(() => {
        component.submitForm({});

        setTimeout(() => {
          expect(component.successDialog.open).toHaveBeenCalled();
          expect(component.errorDialog.open).not.toHaveBeenCalled();
          done();
        }, 10);
      });
    });

    it('should open error dialog on failed update', (done) => {
      const error = {
        httpCode: 400,
        message: 'Update failed',
        details: 'Constraint violation',
        hint: 'Check your input',
        humanMessage: 'Could not update'
      };
      mockDataService.editData.and.returnValue(of({ success: false, error }));

      component.data$.subscribe(() => {
        component.submitForm({});

        setTimeout(() => {
          expect(component.errorDialog.open).toHaveBeenCalledWith(error);
          expect(component.successDialog.open).not.toHaveBeenCalled();
          done();
        }, 10);
      });
    });

    it('should not submit when entityKey is undefined', () => {
      component.entityKey = undefined;
      component.entityId = '42';
      component.submitForm({});

      expect(mockDataService.editData).not.toHaveBeenCalled();
    });

    it('should not submit when entityId is undefined', () => {
      component.entityKey = 'Issue';
      component.entityId = undefined;
      component.submitForm({});

      expect(mockDataService.editData).not.toHaveBeenCalled();
    });

    it('should not submit when editForm is undefined', () => {
      component.entityKey = 'Issue';
      component.entityId = '42';
      component.editForm.set(undefined);
      component.submitForm({});

      expect(mockDataService.editData).not.toHaveBeenCalled();
    });
  });

  describe('navToList()', () => {
    it('should navigate to current entity list', () => {
      component.entityKey = 'Issue';
      component.navToList();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['view', 'Issue']);
    });

    it('should navigate to specified entity list', () => {
      component.entityKey = 'Issue';
      component.navToList('Status');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['view', 'Status']);
    });
  });

  describe('navToRecord()', () => {
    it('should navigate to specified record', () => {
      component.navToRecord('Issue', '99');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['view', 'Issue', '99']);
    });
  });

  describe('Route Parameter Changes', () => {
    it('should reload data when entityId changes', (done) => {
      let callCount = 0;

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of([MOCK_PROPERTIES.textShort]));
      mockDataService.getData.and.callFake((params: any) => {
        if (params.entityId === '42') {
          return of([{ id: 42, name: 'Issue 42' }] as any);
        } else {
          return of([{ id: 99, name: 'Issue 99' }] as any);
        }
      });

      component.data$.subscribe(data => {
        callCount++;
        if (callCount === 1) {
          expect(data.id).toBe(42);
          expect(component.editForm()?.get('name')?.value).toBe('Issue 42');

          // Trigger route change to different record
          routeParams.next({ entityKey: 'Issue', entityId: '99' });
        } else if (callCount === 2) {
          expect(data.id).toBe(99);
          expect(component.entityId).toBe('99');
          // Form should be repopulated with new data
          setTimeout(() => {
            expect(component.editForm()?.get('name')?.value).toBe('Issue 99');
            done();
          }, 10);
        }
      });
    });

    it('should recreate form when entityKey changes', (done) => {
      let callCount = 0;

      mockSchemaService.getEntity.and.callFake((key: string) => {
        if (key === 'Issue') return of(MOCK_ENTITIES.issue);
        if (key === 'Status') return of(MOCK_ENTITIES.status);
        return of(undefined);
      });
      mockSchemaService.getPropsForEdit.and.returnValue(of([MOCK_PROPERTIES.textShort]));
      mockDataService.getData.and.returnValue(of([{ id: 1, name: 'Test' }] as any));

      component.data$.subscribe(() => {
        callCount++;
        if (callCount === 1) {
          expect(component.entityKey).toBe('Issue');
          expect(component.editForm()).toBeDefined();

          routeParams.next({ entityKey: 'Status', entityId: '5' });
        } else if (callCount === 2) {
          expect(component.entityKey).toBe('Status');
          expect(component.editForm()).toBeDefined();
          done();
        }
      });
    });
  });

  describe('Data Flow with Complex Property Types', () => {
    it('should handle all property types in edit form', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.textLong,
        MOCK_PROPERTIES.boolean,
        MOCK_PROPERTIES.integer,
        MOCK_PROPERTIES.money,
        MOCK_PROPERTIES.date,
        MOCK_PROPERTIES.foreignKey,
        MOCK_PROPERTIES.geoPoint
      ];
      const mockData = [{
        id: 42,
        name: 'Test',
        description: 'Long text',
        is_active: true,
        count: 5,
        amount: '$100',
        due_date: '2025-12-31',
        status_id: 1,
        location: 'POINT(-83 43)'
      }];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForEdit.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of(mockData as any));

      component.data$.subscribe(() => {
        const callArgs = mockDataService.getData.calls.argsFor(0)[0];
        expect(callArgs.fields).toContain('name');
        expect(callArgs.fields).toContain('description');
        expect(callArgs.fields).toContain('is_active');
        expect(callArgs.fields).toContain('count');
        expect(callArgs.fields).toContain('amount');
        expect(callArgs.fields).toContain('due_date');
        expect(callArgs.fields).toContain('status_id'); // Edit forms use raw ID, not embedded object
        expect(callArgs.fields).toContain('location:location_text');
        done();
      });
    });
  });

  describe('Entity Description Tooltip', () => {
    it('should display entity with description in template', (done) => {
      const entityWithDescription = { ...MOCK_ENTITIES.issue, description: 'Track system issues' };
      mockSchemaService.getEntity.and.returnValue(of(entityWithDescription));
      mockSchemaService.getPropsForEdit.and.returnValue(of([MOCK_PROPERTIES.textShort]));
      mockDataService.getData.and.returnValue(of([{ id: 1, name: 'Test' }] as any));

      component.entity$.subscribe(entity => {
        expect(entity?.description).toBe('Track system issues');
        done();
      });
    });

    it('should handle entities without description', (done) => {
      const entityWithoutDescription = { ...MOCK_ENTITIES.issue, description: null };
      mockSchemaService.getEntity.and.returnValue(of(entityWithoutDescription));
      mockSchemaService.getPropsForEdit.and.returnValue(of([MOCK_PROPERTIES.textShort]));
      mockDataService.getData.and.returnValue(of([{ id: 1, name: 'Test' }] as any));

      component.entity$.subscribe(entity => {
        expect(entity?.description).toBeNull();
        done();
      });
    });
  });
});
