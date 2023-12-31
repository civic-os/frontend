import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListPage } from './list.page';

describe('ViewPage', () => {
  let component: ListPage;
  let fixture: ComponentFixture<ListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPage]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
