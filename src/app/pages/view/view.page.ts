import { Component } from '@angular/core';
import { ActivatedRoute, Route } from '@angular/router';
import { Observable, map, mergeMap, of } from 'rxjs';
import { SchemaService } from '../../services/schema.service';
import { OpenAPIV2 } from 'openapi-types';
import { LetDirective } from '@ngrx/component';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [CommonModule, LetDirective],
  templateUrl: './view.page.html',
  styleUrl: './view.page.css'
})
export class ViewPage {
  public entityKey?: string;
  public entity$: Observable<OpenAPIV2.SchemaObject | null>;
  public data$: Observable<any>;

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
    this.data$ = this.entity$.pipe(mergeMap(e => {
      if(e?.properties && this.entityKey) {
        let columns = Object.keys(e.properties)
          .filter(x => !SchemaService.hideFields.includes(x))
        return this.data.getData(this.entityKey, columns);
      } else {
        return of();
      }
    }));
  }

  public headers(entity: OpenAPIV2.SchemaObject) : string[] {
    console.log(entity)
    return entity.properties ? 
      Object.keys(entity.properties)
        .filter(x => !SchemaService.hideFields.includes(x)) : 
      [];
  }

  public printableHeader(property: string) {
    return property.split('_').join(' ');
  }
}
