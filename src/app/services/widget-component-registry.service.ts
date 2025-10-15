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

import { Injectable, Type } from '@angular/core';

/**
 * Widget Component Registry
 *
 * Central registry for mapping widget types to Angular components.
 * This is critical infrastructure that enables dynamic widget loading.
 *
 * Usage:
 * 1. Register widgets during app initialization (APP_INITIALIZER)
 * 2. WidgetContainerComponent queries this registry to load the correct component
 * 3. Extensibility: New widget types can be added without modifying core code
 */
@Injectable({
  providedIn: 'root'
})
export class WidgetComponentRegistry {
  private registry = new Map<string, Type<any>>();

  /**
   * Register a widget component for a specific widget type.
   * Called during app initialization or lazy loading.
   *
   * @param widgetType The widget type identifier (e.g., 'markdown', 'filtered_list')
   * @param component The Angular component class to render for this widget type
   */
  register(widgetType: string, component: Type<any>): void {
    if (this.registry.has(widgetType)) {
      console.warn(`[WidgetComponentRegistry] Widget type "${widgetType}" is already registered. Overwriting.`);
    }
    this.registry.set(widgetType, component);
    console.log(`[WidgetComponentRegistry] Registered widget type: ${widgetType}`);
  }

  /**
   * Get the component class for a widget type.
   * Returns null if not found (allows graceful fallback).
   *
   * @param widgetType The widget type identifier
   * @returns The component class, or null if not registered
   */
  getComponent(widgetType: string): Type<any> | null {
    return this.registry.get(widgetType) || null;
  }

  /**
   * Check if a widget type has a registered component.
   *
   * @param widgetType The widget type identifier
   * @returns True if registered, false otherwise
   */
  hasComponent(widgetType: string): boolean {
    return this.registry.has(widgetType);
  }

  /**
   * Get all registered widget types.
   * Useful for debugging and validation.
   *
   * @returns Array of registered widget type identifiers
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Clear all registrations (primarily for testing).
   */
  clear(): void {
    this.registry.clear();
  }
}
