import { Component } from '@angular/core';
import { Observable, mergeMap, of, tap } from 'rxjs';
import { SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { ActivatedRoute } from '@angular/router';
import { SchemaService } from '../../services/schema.service';
import { CommonModule } from '@angular/common';
import { PropToTitlePipe } from "../../pipes/prop-to-title.pipe";
import { EditPropertyComponent } from "../../components/edit-property/edit-property.component";
import { LetDirective } from '@ngrx/component';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
    selector: 'app-create',
    standalone: true,
    templateUrl: './create.page.html',
    styleUrl: './create.page.css',
    imports: [
        CommonModule,
        PropToTitlePipe,
        EditPropertyComponent,
        LetDirective,
        ReactiveFormsModule,
    ]
})
export class CreatePage {
  public entityKey?: string;
  public entityId?: string;
  public entity$: Observable<SchemaEntityTable | undefined>;
  public properties$: Observable<SchemaEntityProperty[]>;

  public createForm?: FormGroup;
  
  constructor(
    private route: ActivatedRoute,
    private schema: SchemaService,
  ) {
    this.entity$ = this.route.params.pipe(mergeMap(p => {
      this.entityKey = p['entityKey'];
      this.entityId = p['entityId'];
      console.log(p)
      if(p['entityKey']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of();
      }
    }));
    this.properties$ = this.entity$.pipe(mergeMap(e => {
      if(e) {
        let props = this.schema.getPropsForCreate(e)
          .pipe(tap(props => {
            this.createForm = new FormGroup(
              Object.fromEntries(
                props.map(p => [p.column_name, new FormControl('', SchemaService.getFormValidatorsForProperty(p))])
              )
            );
          }));
        return props;
      } else {
        return of([]);
      }
    }));
  }

  submitForm(contents: any) {
    console.log(contents)
    console.log(this.createForm?.value);
  }
}
