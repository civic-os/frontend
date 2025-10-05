import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { GeoPointMapComponent } from './geo-point-map.component';

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

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
