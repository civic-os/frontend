import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeoPointMapComponent } from './geo-point-map.component';

describe('GeoPointMapComponent', () => {
  let component: GeoPointMapComponent;
  let fixture: ComponentFixture<GeoPointMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoPointMapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeoPointMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
