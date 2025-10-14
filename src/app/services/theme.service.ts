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

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { parse, sRGB } from '@texel/color';

export interface MapTileConfig {
  tileUrl: string;
  attribution: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Light theme tile layers (OpenStreetMap default)
  private readonly LIGHT_TILE_CONFIG: MapTileConfig = {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  };

  // Dark theme tile layers (ESRI World Dark Gray)
  // Professional cartography with balanced detail for enterprise applications
  private readonly DARK_TILE_CONFIG: MapTileConfig = {
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  };

  // Luminance threshold for determining light vs dark themes
  private readonly LUMINANCE_THRESHOLD = 128;

  private themeSubject: BehaviorSubject<string>;
  public theme$: Observable<string>;

  constructor() {
    // Initialize with current theme from document
    const currentTheme = this.getCurrentTheme();
    this.themeSubject = new BehaviorSubject<string>(currentTheme);
    this.theme$ = this.themeSubject.asObservable();

    // Watch for theme attribute changes on document element
    this.observeThemeChanges();
  }

  /**
   * Gets the current theme from the data-theme attribute
   */
  private getCurrentTheme(): string {
    return document.documentElement.getAttribute('data-theme') || 'corporate';
  }

  /**
   * Sets up a MutationObserver to watch for theme changes
   */
  private observeThemeChanges(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = this.getCurrentTheme();
          this.themeSubject.next(newTheme);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Determines if the current theme is dark by calculating the luminance
   * of the base background color (--color-base-100 CSS variable in DaisyUI 5)
   *
   * Note: Always checks the currently applied theme. To check a different theme,
   * set it via data-theme attribute first.
   */
  public isDarkTheme(): boolean {
    const luminance = this.calculateBackgroundLuminance();
    return luminance < this.LUMINANCE_THRESHOLD;
  }

  /**
   * Calculates the luminance of the base background color using the YIQ formula
   * Returns a value between 0 (darkest) and 255 (lightest)
   */
  private calculateBackgroundLuminance(): number {
    // Get the computed value of the --color-base-100 CSS variable (DaisyUI 5 base background)
    const computedStyle = getComputedStyle(document.documentElement);
    const baseColor = computedStyle.getPropertyValue('--color-base-100').trim();

    if (!baseColor) {
      // Fallback: assume light theme if we can't read the variable
      return 255;
    }

    // Parse the color value to get RGB
    const rgb = this.parseColorToRGB(baseColor);

    if (!rgb) {
      // Fallback: assume light theme if we can't parse
      return 255;
    }

    // Calculate luminance using YIQ formula
    // Formula: (R*299 + G*587 + B*114) / 1000
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  }

  /**
   * Parses a CSS color value to RGB
   * Handles various formats: oklch, hsl, rgb, hex using @texel/color library
   */
  private parseColorToRGB(colorValue: string): { r: number; g: number; b: number } | null {
    try {
      // Parse the CSS color string and convert to sRGB (returns vec3: [r, g, b] in 0-1 range)
      const rgb = parse(colorValue, sRGB);

      if (!rgb || rgb.length < 3) {
        return null;
      }

      // Convert from 0-1 range to 0-255 range
      return {
        r: Math.round(rgb[0] * 255),
        g: Math.round(rgb[1] * 255),
        b: Math.round(rgb[2] * 255)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets the appropriate map tile configuration for the current theme
   */
  public getMapTileConfig(): MapTileConfig {
    return this.isDarkTheme() ? this.DARK_TILE_CONFIG : this.LIGHT_TILE_CONFIG;
  }

  /**
   * Gets the current theme value
   */
  public getTheme(): string {
    return this.themeSubject.value;
  }
}
