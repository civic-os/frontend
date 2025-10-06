import { Component, inject, ViewChild } from '@angular/core';

import { Router, RouterOutlet } from '@angular/router';
import { SchemaService } from './services/schema.service';
import { Observable } from 'rxjs';
import { OpenAPIV2 } from 'openapi-types';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SchemaEntityTable } from './interfaces/entity';
import { AuthService } from './services/auth.service';

@Component({
    selector: 'app-root',
    imports: [
    RouterOutlet,
    CommonModule,
    FormsModule
],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
  private schema = inject(SchemaService);
  private router = inject(Router);
  public auth = inject(AuthService);

  public drawerOpen: boolean = false;
  title = 'frontend';
  public menuItems$: Observable<SchemaEntityTable[] | undefined> = this.schema.getEntities();

  constructor() {
    this.schema.init();
  }

  public navigate(key: string) {
    this.router.navigate(['view', key]);
    this.drawerOpen = false;
  }

  public navigateToPermissions() {
    this.router.navigate(['permissions']);
    this.drawerOpen = false;
  }

  public navigateToEntityManagement() {
    this.router.navigate(['entity-management']);
    this.drawerOpen = false;
  }

  public getMenuKeys(menuItems: OpenAPIV2.DefinitionsObject | undefined) : string[] {
    if(menuItems) {
      return Object.keys(menuItems).sort();
    } else {
      return [];
    }
  }
}
