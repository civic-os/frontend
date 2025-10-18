/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 * AGPL-3.0-or-later
 */

import { Injectable } from '@angular/core';
import { Environment } from '../interfaces/environment';
import { environment } from '../../environments/environment';

// Extend Window interface to include our config
declare global {
  interface Window {
    civicOsConfig?: Environment;
  }
}

/**
 * ConfigService provides runtime configuration for the application.
 *
 * In production (Docker), configuration is loaded from /assets/config.js which is
 * generated at container startup from environment variables.
 *
 * In development, falls back to src/environments/environment.ts
 *
 * Usage:
 *   constructor(private config: ConfigService) {}
 *   const apiUrl = this.config.get().postgrestUrl;
 */
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: Environment;

  constructor() {
    // Load config from window.civicOsConfig (set by /assets/config.js in production)
    // Fall back to environment.ts for local development
    this.config = window.civicOsConfig || environment;
  }

  /**
   * Get the current configuration
   */
  get(): Environment {
    return this.config;
  }

  /**
   * Get PostgREST URL
   */
  getPostgrestUrl(): string {
    return this.config.postgrestUrl;
  }

  /**
   * Get Keycloak configuration
   */
  getKeycloakConfig() {
    return this.config.keycloak;
  }

  /**
   * Get map configuration
   */
  getMapConfig() {
    return this.config.map;
  }

  /**
   * Load configuration from /assets/config.js
   * This is called by APP_INITIALIZER before Angular bootstraps
   */
  loadConfig(): Promise<void> {
    return new Promise((resolve) => {
      // Check if config is already loaded (by script tag in index.html)
      if (window.civicOsConfig) {
        this.config = window.civicOsConfig;
        resolve();
        return;
      }

      // If not loaded, fall back to environment.ts (development mode)
      this.config = environment;
      resolve();
    });
  }
}
