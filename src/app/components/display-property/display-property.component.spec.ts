import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisplayPropertyComponent } from './display-property.component';

describe('DisplayPropertyComponent', () => {
  let component: DisplayPropertyComponent;
  let fixture: ComponentFixture<DisplayPropertyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayPropertyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DisplayPropertyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
