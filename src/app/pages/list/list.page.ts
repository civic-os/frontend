import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Route, RouterModule } from '@angular/router';
import { Observable, map, mergeMap, of } from 'rxjs';
import { SchemaService } from '../../services/schema.service';
import { CommonModule } from '@angular/common';

import { DataService } from '../../services/data.service';
import { SchemaEntityProperty, SchemaEntityTable } from '../../interfaces/entity';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';

@Component({
    selector: 'app-view',
    templateUrl: './list.page.html',
    styleUrl: './list.page.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
    CommonModule,
    RouterModule,
    DisplayPropertyComponent
]
})
export class ListPage {
  private route = inject(ActivatedRoute);
  private schema = inject(SchemaService);
  private data = inject(DataService);

  public entityKey?: string;
  public entity$: Observable<SchemaEntityTable | undefined>;
  public properties$: Observable<SchemaEntityProperty[]>;
  public data$: Observable<any>;

  constructor() {
    this.entity$ = this.route.params.pipe(mergeMap(p => {
      this.entityKey = p['entityKey'];
      if(p['entityKey']) {
        return this.schema.getEntity(p['entityKey']);
      } else {
        return of(undefined);
      }
    }));
    this.properties$ = this.entity$.pipe(mergeMap(e => {
      if(e) {
        let props = this.schema.getPropsForList(e);
        return props;
      } else {
        return of([]);
      }
    }));
    this.data$ = this.properties$.pipe(mergeMap(props => {
      if(props && props.length > 0 && this.entityKey) {
        let columns = props
          .map(x => SchemaService.propertyToSelectString(x));
        return this.data.getData({key: this.entityKey, fields: columns});
      } else {
        return of([]);
      }
    }));
  }
}
