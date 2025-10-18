/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ApplicationConfig, provideZonelessChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { createInterceptorCondition, INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG, IncludeBearerTokenCondition, includeBearerTokenInterceptor, provideKeycloak } from 'keycloak-angular';
import { environment } from '../environments/environment';
import { WidgetComponentRegistry } from './services/widget-component-registry.service';
import { MarkdownWidgetComponent } from './components/widgets/markdown-widget/markdown-widget.component';
import { provideMarkdown } from 'ngx-markdown';
import { ConfigService } from './services/config.service';

// Get runtime config (loaded from /assets/config.js in production, or environment.ts in dev)
// This is available immediately because config.js is loaded via script tag in index.html
const runtimeConfig = (window as any).civicOsConfig || environment;

const escapedUrl = runtimeConfig.postgrestUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const urlCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: new RegExp(`^(${escapedUrl})(.*)?$`, 'i'),
  bearerPrefix: 'Bearer'
});

/**
 * Register widget components at application startup
 * This is critical for dynamic widget loading in dashboards
 */
function initializeWidgetRegistry(registry: WidgetComponentRegistry): () => void {
  return () => {
    console.log('[AppConfig] Registering widget components...');

    // Register all widget components
    registry.register('markdown', MarkdownWidgetComponent);

    console.log('[AppConfig] Widget registration complete');
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideKeycloak({
      config: {
        url: runtimeConfig.keycloak.url,
        realm: runtimeConfig.keycloak.realm,
        clientId: runtimeConfig.keycloak.clientId
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html'
      }
    }),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [urlCondition] // <-- Note that multiple conditions might be added.
    },
    provideRouter(routes),
    // provideHttpClient(withFetch()),
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),
    // Markdown support for MarkdownWidget
    provideMarkdown(),
    // Register widget components at startup
    {
      provide: APP_INITIALIZER,
      useFactory: initializeWidgetRegistry,
      deps: [WidgetComponentRegistry],
      multi: true
    }
  ]
};
