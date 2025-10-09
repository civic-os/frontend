import { Component, inject, ViewChild, AfterViewInit } from '@angular/core';

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
export class AppComponent implements AfterViewInit {
  private schema = inject(SchemaService);
  private router = inject(Router);
  public auth = inject(AuthService);

  public drawerOpen: boolean = false;
  title = 'frontend';

  // Initialize schema on app startup
  private _schemaInit = this.schema.init();

  public menuItems$: Observable<SchemaEntityTable[] | undefined> = this.schema.getEntities();

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

  public navigateToPropertyManagement() {
    this.router.navigate(['property-management']);
    this.drawerOpen = false;
  }

  public navigateToSchemaErd() {
    this.router.navigate(['schema-erd']);
    this.drawerOpen = false;
  }

  public getMenuKeys(menuItems: OpenAPIV2.DefinitionsObject | undefined) : string[] {
    if(menuItems) {
      return Object.keys(menuItems).sort();
    } else {
      return [];
    }
  }

  ngAfterViewInit(): void {
    // Listen for theme changes from DaisyUI theme-controller inputs
    // DaisyUI's theme-controller is CSS-only and doesn't update data-theme attribute
    // We need to manually update it so other components can react to theme changes
    const themeInputs = document.querySelectorAll<HTMLInputElement>('input.theme-controller');

    console.log('[AppComponent] Found theme-controller inputs:', themeInputs.length);

    themeInputs.forEach((input, index) => {
      console.log(`[AppComponent] Theme input ${index}: value="${input.value}", checked=${input.checked}`);

      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          console.log('[AppComponent] Theme changed to:', target.value);
          document.documentElement.setAttribute('data-theme', target.value);
        }
      });
    });
  }
}
