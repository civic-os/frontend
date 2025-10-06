import { Component, inject } from '@angular/core';
import { Observable, map, mergeMap, of } from 'rxjs';
import { SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SchemaService } from '../../services/schema.service';
import { DataService } from '../../services/data.service';

import { CommonModule } from '@angular/common';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';

@Component({
    selector: 'app-detail',
    templateUrl: './detail.page.html',
    styleUrl: './detail.page.css',
    imports: [
    CommonModule,
    RouterModule,
    DisplayPropertyComponent
]
})
export class DetailPage {
  private route = inject(ActivatedRoute);
  private schema = inject(SchemaService);
  private data = inject(DataService);

  public entityKey?: string;
  public entityId?: string;
  public entity$: Observable<SchemaEntityTable | undefined>;
  public properties$: Observable<SchemaEntityProperty[]>;
  public data$: Observable<any>;

  constructor() {
    this.entity$ = this.route.params.pipe(mergeMap(p => {
      this.entityKey = p['entityKey'];
      this.entityId = p['entityId'];
      if(p['entityKey']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of(undefined);
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
      if(props && props.length > 0 && this.entityKey) {
        let columns = props
          .map(x => SchemaService.propertyToSelectString(x));
        return this.data.getData({key: this.entityKey, fields: columns, entityId: this.entityId})
          .pipe(map(x => x[0]));
      } else {
        return of(undefined);
      }
    }));
  }

}
