import { Component } from '@angular/core';
import { OpenAPIV2 } from 'openapi-types';
import { Observable, map, mergeMap, of } from 'rxjs';
import { EntityProperty, EntityPropertyType } from '../../interfaces/entity';
import { ActivatedRoute } from '@angular/router';
import { SchemaService } from '../../services/schema.service';
import { DataService } from '../../services/data.service';
import { CommonModule } from '@angular/common';
import { LetDirective } from '@ngrx/component';
import { DisplayPropertyComponent } from '../../components/display-property/display-property.component';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [
    CommonModule, 
    LetDirective,
    DisplayPropertyComponent,
  ],
  templateUrl: './detail.page.html',
  styleUrl: './detail.page.css'
})
export class DetailPage {
  public entityKey?: string;
  public entityId?: string;
  public entity$: Observable<OpenAPIV2.SchemaObject | null>;
  public properties$: Observable<EntityProperty[] | null>;
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
      this.entityId = p['entityId'];
      console.log(p)
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

  public printableHeader(property: string) {
    return property.split('_').join(' ');
  }

}
