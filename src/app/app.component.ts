import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { SchemaService } from './services/schema.service';
import { Observable } from 'rxjs';
import { OpenAPIV2 } from 'openapi-types';
import { LetDirective } from '@ngrx/component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LetDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontend';
  public menuItems$: Observable<OpenAPIV2.DefinitionsObject | undefined>;
  constructor(
    private schema: SchemaService,
    private router: Router
  ) {
    this.menuItems$ = this.schema.getEntities();
    this.schema.init();
  }

  public navigate(key: string) {
    this.router.navigate(['view', key]);
  }

  public getMenuKeys(menuItems: OpenAPIV2.DefinitionsObject | undefined) : string[] {
    if(menuItems) {
      return Object.keys(menuItems).sort();
    } else {
      return [];
    }
  }
}
