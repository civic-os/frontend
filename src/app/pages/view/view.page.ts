import { Component } from '@angular/core';
import { ActivatedRoute, Route, RouterModule } from '@angular/router';
import { Observable, map, mergeMap, of } from 'rxjs';
import { SchemaService } from '../../services/schema.service';
import { OpenAPIV2 } from 'openapi-types';
import { LetDirective } from '@ngrx/component';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { EntityProperty } from '../../interfaces/entity';
import { EntityPropertyType } from '../../interfaces/entity';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';
import { PropToTitlePipe } from "../../pipes/prop-to-title.pipe";

@Component({
    selector: 'app-view',
    standalone: true,
    templateUrl: './view.page.html',
    styleUrl: './view.page.css',
    imports: [
        CommonModule,
        LetDirective,
        RouterModule,
        DisplayPropertyComponent,
        PropToTitlePipe
    ]
})
export class ViewPage {
  public entityKey?: string;
  public entity$: Observable<OpenAPIV2.SchemaObject | null>;
  public properties$: Observable<EntityProperty[] | null>;
  public data$: Observable<any>;

  public EntityPropertyType = EntityPropertyType;

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
    this.properties$ = this.entity$.pipe(map(e => {
      if(e) {
        let props = this.schema.getPropertiesAndForeignRelationships(e);
        return props;
      } else {
        return null;
      }
    }));
    this.data$ = this.properties$.pipe(mergeMap(props => {
      if(props && this.entityKey) {
        let columns = props
          //.filter(x => !SchemaService.hideFields.includes(x.name))
          .map(x => SchemaService.propertyToSelectString(x));
        return this.data.getData(this.entityKey, columns);
      } else {
        return of();
      }
    }));
  }

  public filterProps(props: EntityProperty[]): EntityProperty[] {
    return props.filter(x => !SchemaService.hideFields.includes(x.name));
  }
}
