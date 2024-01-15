import { Component, Input } from '@angular/core';
import { SchemaEntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { CommonModule } from '@angular/common';
import { Observable, map } from 'rxjs';
import { DataService } from '../../services/data.service';
import { LetDirective } from '@ngrx/component';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { NgxCurrencyDirective } from 'ngx-currency';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
    selector: 'app-edit-property',
    standalone: true,
    templateUrl: './edit-property.component.html',
    styleUrl: './edit-property.component.css',
    imports: [
        CommonModule,
        LetDirective,
        NgxMaskDirective,
        NgxCurrencyDirective,
        ReactiveFormsModule,
    ],
    providers: [
      provideNgxMask(),
    ]
})
export class EditPropertyComponent {
  @Input('property') prop!: SchemaEntityProperty;
  @Input('initialValue') initialValue: any;
  @Input('formGroup') form!: FormGroup;
  public selectOptions$?: Observable<{id: number, text: string}[]>;

  propType!: EntityPropertyType;

  public EntityPropertyType = EntityPropertyType;
  
  constructor(
    private data: DataService,
  ) {}

  ngOnInit() {
    this.propType = this.prop.type;
    if(this.propType == EntityPropertyType.ForeignKeyName) {
      this.selectOptions$ = this.data.getData({
        key: this.prop.join_table, 
        fields: ['id:' + this.prop.join_column, 'display_name'],
        orderField: 'id',
      })
      .pipe(map(data => {
        return data.map(d => {
          return {
            id: d.id,
            text: d.display_name,
          }
        });
      }));
    }
  }

}
