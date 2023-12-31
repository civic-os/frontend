import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-display-property',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './display-property.component.html',
  styleUrl: './display-property.component.css'
})
export class DisplayPropertyComponent {
  @Input('properties') props!: EntityProperty[];
  @Input('property') prop!: EntityProperty;
  @Input('datum') datum: any;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    this.propType = this.prop.type;
  }
}
