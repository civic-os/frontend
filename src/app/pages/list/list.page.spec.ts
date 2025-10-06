import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ListPage } from './list.page';
import { SchemaService } from '../../services/schema.service';
import { DataService } from '../../services/data.service';
import { BehaviorSubject, of } from 'rxjs';
import { MOCK_ENTITIES, MOCK_PROPERTIES, createMockProperty } from '../../testing';
import { EntityPropertyType } from '../../interfaces/entity';

describe('ListPage', () => {
  let component: ListPage;
  let fixture: ComponentFixture<ListPage>;
  let mockSchemaService: jasmine.SpyObj<SchemaService>;
  let mockDataService: jasmine.SpyObj<DataService>;
  let routeParams: BehaviorSubject<any>;

  beforeEach(async () => {
    routeParams = new BehaviorSubject({ entityKey: 'Issue' });

    mockSchemaService = jasmine.createSpyObj('SchemaService', [
      'getEntity',
      'getPropsForList'
    ]);
    mockDataService = jasmine.createSpyObj('DataService', ['getData']);

    await TestBed.configureTestingModule({
      imports: [ListPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: routeParams.asObservable() } },
        { provide: SchemaService, useValue: mockSchemaService },
        { provide: DataService, useValue: mockDataService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Observable Chain Integration', () => {
    it('should load entity metadata from route params', (done) => {
      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(entity => {
        expect(entity).toBeDefined();
        expect(entity?.table_name).toBe('Issue');
        expect(mockSchemaService.getEntity).toHaveBeenCalledWith('Issue');
        done();
      });
    });

    it('should store entityKey from route params', (done) => {
      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(() => {
        expect(component.entityKey).toBe('Issue');
        done();
      });
    });

    it('should return undefined for missing entityKey', (done) => {
      routeParams.next({});
      mockSchemaService.getEntity.and.returnValue(of(undefined));

      component.entity$.subscribe(entity => {
        expect(entity).toBeUndefined();
        expect(mockSchemaService.getEntity).not.toHaveBeenCalled();
        done();
      });
    });

    it('should fetch properties for list view', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.foreignKey
      ];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of([] as any));

      component.properties$.subscribe(props => {
        expect(props.length).toBe(2);
        expect(props[0].column_name).toBe('name');
        expect(props[1].column_name).toBe('status_id');
        expect(mockSchemaService.getPropsForList).toHaveBeenCalledWith(MOCK_ENTITIES.issue);
        done();
      });
    });

    it('should return empty array when entity is undefined', (done) => {
      routeParams.next({});
      mockSchemaService.getEntity.and.returnValue(of(undefined));

      component.properties$.subscribe(props => {
        expect(props).toEqual([]);
        expect(mockSchemaService.getPropsForList).not.toHaveBeenCalled();
        done();
      });
    });

    it('should build PostgREST select query from properties', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.foreignKey
      ];
      const mockData = [
        { id: 1, name: 'Issue 1', status_id: { id: 1, display_name: 'Open' } },
        { id: 2, name: 'Issue 2', status_id: { id: 2, display_name: 'Closed' } }
      ];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of(mockData as any));

      component.data$.subscribe(data => {
        expect(mockDataService.getData).toHaveBeenCalledWith({
          key: 'Issue',
          fields: ['name', 'status_id:Status(id,display_name)']
        });
        expect(data).toEqual(mockData);
        done();
      });
    });

    it('should handle GeoPoint properties with computed field aliasing', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.geoPoint
      ];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of([] as any));

      component.data$.subscribe(() => {
        expect(mockDataService.getData).toHaveBeenCalledWith({
          key: 'Issue',
          fields: ['location:location_text']
        });
        done();
      });
    });

    it('should return empty observable when properties are empty', (done) => {
      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.data$.subscribe(data => {
        expect(data).toEqual([]);
        done();
      });
    });

    it('should return empty observable when entityKey is undefined', (done) => {
      routeParams.next({});
      mockSchemaService.getEntity.and.returnValue(of(undefined));

      component.data$.subscribe(data => {
        expect(mockDataService.getData).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Route Parameter Changes', () => {
    it('should reload data when route params change', (done) => {
      let callCount = 0;

      mockSchemaService.getEntity.and.callFake((key: string) => {
        if (key === 'Issue') return of(MOCK_ENTITIES.issue);
        if (key === 'Status') return of(MOCK_ENTITIES.status);
        return of(undefined);
      });
      mockSchemaService.getPropsForList.and.returnValue(of([MOCK_PROPERTIES.textShort]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(entity => {
        callCount++;
        if (callCount === 1) {
          expect(entity?.table_name).toBe('Issue');
          // Trigger route change
          routeParams.next({ entityKey: 'Status' });
        } else if (callCount === 2) {
          expect(entity?.table_name).toBe('Status');
          expect(component.entityKey).toBe('Status');
          done();
        }
      });
    });
  });

  describe('Data Flow with Multiple Property Types', () => {
    it('should handle mixed property types in select query', (done) => {
      const mockProps = [
        MOCK_PROPERTIES.textShort,
        MOCK_PROPERTIES.integer,
        MOCK_PROPERTIES.boolean,
        MOCK_PROPERTIES.foreignKey,
        MOCK_PROPERTIES.user,
        MOCK_PROPERTIES.geoPoint
      ];

      mockSchemaService.getEntity.and.returnValue(of(MOCK_ENTITIES.issue));
      mockSchemaService.getPropsForList.and.returnValue(of(mockProps));
      mockDataService.getData.and.returnValue(of([] as any));

      component.data$.subscribe(() => {
        const callArgs = mockDataService.getData.calls.argsFor(0)[0];
        expect(callArgs.fields).toContain('name'); // TextShort
        expect(callArgs.fields).toContain('count'); // Integer
        expect(callArgs.fields).toContain('is_active'); // Boolean
        expect(callArgs.fields).toContain('status_id:Status(id,display_name)'); // ForeignKey
        expect(callArgs.fields).toContain('assigned_to:civic_os_users!assigned_to(display_name,private:civic_os_users_private(display_name,phone,email))'); // User
        expect(callArgs.fields).toContain('location:location_text'); // GeoPoint
        done();
      });
    });
  });

  describe('Entity Description Tooltip', () => {
    it('should display entity with description in template', (done) => {
      const entityWithDescription = { ...MOCK_ENTITIES.issue, description: 'Track system issues' };
      mockSchemaService.getEntity.and.returnValue(of(entityWithDescription));
      mockSchemaService.getPropsForList.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(entity => {
        expect(entity?.description).toBe('Track system issues');
        done();
      });
    });

    it('should handle entities without description', (done) => {
      const entityWithoutDescription = { ...MOCK_ENTITIES.issue, description: null };
      mockSchemaService.getEntity.and.returnValue(of(entityWithoutDescription));
      mockSchemaService.getPropsForList.and.returnValue(of([]));
      mockDataService.getData.and.returnValue(of([] as any));

      component.entity$.subscribe(entity => {
        expect(entity?.description).toBeNull();
        done();
      });
    });
  });
});
