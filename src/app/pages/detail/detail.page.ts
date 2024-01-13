import { Component } from '@angular/core';
import { Observable, map, mergeMap, of } from 'rxjs';
import { EntityPropertyType, SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { ActivatedRoute } from '@angular/router';
import { SchemaService } from '../../services/schema.service';
import { DataService } from '../../services/data.service';
import { CommonModule } from '@angular/common';
import { LetDirective } from '@ngrx/component';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';
import { PropToTitlePipe } from "../../pipes/prop-to-title.pipe";

@Component({
    selector: 'app-detail',
    standalone: true,
    templateUrl: './detail.page.html',
    styleUrl: './detail.page.css',
    imports: [
        CommonModule,
        LetDirective,
        DisplayPropertyComponent,
        PropToTitlePipe,
    ]
})
export class DetailPage {
  public entityKey?: string;
  public entityId?: string;
  public entity$: Observable<SchemaEntityTable | undefined>;
  public properties$: Observable<SchemaEntityProperty[]>;
  public data$: Observable<any>;

  public EntityPropertyType = EntityPropertyType;
  public SchemaService = SchemaService;

  constructor(
    private route: ActivatedRoute,
    private schema: SchemaService,
    private data: DataService,
  ) {
    this.entity$ = this.route.params.pipe(mergeMap(p => {
      this.entityKey = p['entityKey'];
      if(p['entityKey']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of();
      }
    }));
    this.properties$ = this.entity$.pipe(mergeMap(e => {
      if(e) {
        let props = this.schema.getPropsForDetail(e);
        return props;
      } else {
        return of([]);
      }
    }));
    this.data$ = this.properties$.pipe(mergeMap(props => {
      if(props && this.entityKey) {
        console.log(props)
        let columns = props
          .map(x => SchemaService.propertyToSelectString(x));
        return this.data.getData(this.entityKey, columns, this.entityId)
          .pipe(map(x => x[0]));
      } else {
        return of();
      }
    }));
  }

}
