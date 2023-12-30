import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EntityProperty, EntityPropertyType } from '../../interfaces/entity';

@Component({
  selector: 'app-display-property',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './display-property.component.html',
  styleUrl: './display-property.component.css'
})
export class DisplayPropertyComponent {
  @Input('properties') props!: EntityProperty[];
  @Input('propertyName') propName?: string;
  @Input('property') prop?: EntityProperty;
  @Input('datum') datum: any;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;

  ngOnInit() {
    if(this.prop) {
      this.propType = this.prop.type;
    } else {
      this.propType = this.props.find(x => x.name == this.propName)?.type ?? EntityPropertyType.Unknown;
    }
  }
}
