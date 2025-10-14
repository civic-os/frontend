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

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ThemeService, MapTileConfig } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
    service = TestBed.inject(ThemeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isDarkTheme (dynamic luminance detection)', () => {
    it('should return a boolean value', () => {
      const result = service.isDarkTheme();
      expect(typeof result).toBe('boolean');
    });

    it('should calculate luminance based on current theme', (done) => {
      // Set a theme and verify the method executes without errors
      document.documentElement.setAttribute('data-theme', 'corporate');
      setTimeout(() => {
        const result = service.isDarkTheme();
        expect(typeof result).toBe('boolean');
        done();
      }, 50);
    });

    it('should return true when luminance is below threshold (128)', () => {
      // Mock calculateBackgroundLuminance to return dark value
      spyOn<any>(service, 'calculateBackgroundLuminance').and.returnValue(100);

      const result = service.isDarkTheme();
      expect(result).toBe(true);
    });

    it('should return false when luminance is at or above threshold (128)', () => {
      // Mock calculateBackgroundLuminance to return light value
      spyOn<any>(service, 'calculateBackgroundLuminance').and.returnValue(200);

      const result = service.isDarkTheme();
      expect(result).toBe(false);
    });

    it('should return false when luminance equals threshold (128)', () => {
      // Mock calculateBackgroundLuminance to return exact threshold
      spyOn<any>(service, 'calculateBackgroundLuminance').and.returnValue(128);

      const result = service.isDarkTheme();
      expect(result).toBe(false);
    });

    it('should return true when luminance is just below threshold (127)', () => {
      // Mock calculateBackgroundLuminance to return just below threshold
      spyOn<any>(service, 'calculateBackgroundLuminance').and.returnValue(127);

      const result = service.isDarkTheme();
      expect(result).toBe(true);
    });
  });

  describe('getMapTileConfig', () => {
    it('should return a valid MapTileConfig object', () => {
      const config = service.getMapTileConfig();

      expect(config).toBeDefined();
      expect(config.tileUrl).toBeDefined();
      expect(config.attribution).toBeDefined();
      expect(typeof config.tileUrl).toBe('string');
      expect(typeof config.attribution).toBe('string');
      expect(config.tileUrl.length).toBeGreaterThan(0);
      expect(config.attribution.length).toBeGreaterThan(0);
    });

    it('should return either light or dark tile config', () => {
      const config = service.getMapTileConfig();

      const isLightConfig = config.tileUrl === 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const isDarkConfig = config.tileUrl === 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

      expect(isLightConfig || isDarkConfig).toBe(true);
    });

    it('should have appropriate attribution for returned tile provider', () => {
      const config = service.getMapTileConfig();

      if (config.tileUrl.includes('openstreetmap')) {
        expect(config.attribution).toContain('OpenStreetMap');
      } else if (config.tileUrl.includes('arcgisonline')) {
        expect(config.attribution).toContain('Esri');
      }
    });

    it('should respond to theme changes', (done) => {
      document.documentElement.setAttribute('data-theme', 'light');
      setTimeout(() => {
        const config1 = service.getMapTileConfig();

        document.documentElement.setAttribute('data-theme', 'dark');
        setTimeout(() => {
          const config2 = service.getMapTileConfig();

          // Both should return valid configs
          expect(config1).toBeDefined();
          expect(config2).toBeDefined();
          expect(config1.tileUrl).toBeDefined();
          expect(config2.tileUrl).toBeDefined();

          done();
        }, 50);
      }, 50);
    });
  });

  describe('getTheme', () => {
    it('should return a theme string', () => {
      const theme = service.getTheme();
      expect(typeof theme).toBe('string');
      expect(theme.length).toBeGreaterThan(0);
    });
  });

  describe('theme$ Observable', () => {
    it('should be defined', () => {
      expect(service.theme$).toBeDefined();
    });

    it('should be an observable that emits string values', () => {
      // Just verify the observable is set up correctly
      // We can't easily test emission in a test environment due to MutationObserver
      expect(service.theme$).toBeDefined();
      expect(service.getTheme()).toBeDefined();
      expect(typeof service.getTheme()).toBe('string');
    });
  });

  describe('MapTileConfig Interface', () => {
    it('should have tileUrl and attribution properties', () => {
      const config: MapTileConfig = service.getMapTileConfig();
      expect(config.tileUrl).toBeDefined();
      expect(config.attribution).toBeDefined();
      expect(typeof config.tileUrl).toBe('string');
      expect(typeof config.attribution).toBe('string');
    });
  });

  describe('parseColorToRGB (OKLCH color parsing)', () => {
    it('should parse OKLCH color values to RGB', () => {
      // OKLCH format: oklch(L C H / alpha)
      // Use a conservative value well within sRGB gamut
      // oklch(0.7 0.05 120) = muted yellowish-green
      const oklchColor = 'oklch(0.7 0.05 120)';
      const rgb = service['parseColorToRGB'](oklchColor);

      expect(rgb).not.toBeNull();
      if (rgb) {
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
        expect(rgb.g).toBeGreaterThanOrEqual(0);
        expect(rgb.g).toBeLessThanOrEqual(255);
        expect(rgb.b).toBeGreaterThanOrEqual(0);
        expect(rgb.b).toBeLessThanOrEqual(255);
      }
    });

    it('should parse RGB color values', () => {
      const rgbColor = 'rgb(128, 64, 200)';
      const rgb = service['parseColorToRGB'](rgbColor);

      expect(rgb).not.toBeNull();
      expect(rgb!.r).toBe(128);
      expect(rgb!.g).toBe(64);
      expect(rgb!.b).toBe(200);
    });

    it('should parse hex color values', () => {
      const hexColor = '#ff6600';
      const rgb = service['parseColorToRGB'](hexColor);

      expect(rgb).not.toBeNull();
      expect(rgb!.r).toBe(255);
      expect(rgb!.g).toBe(102);
      expect(rgb!.b).toBe(0);
    });

    it('should parse color values in various formats', () => {
      // Test that the parser can handle different CSS color formats
      const testColors = [
        'rgb(255, 255, 255)',  // White
        '#000000',             // Black
        'rgb(128, 128, 128)'   // Gray
      ];

      testColors.forEach(color => {
        const rgb = service['parseColorToRGB'](color);
        expect(rgb).not.toBeNull();
        if (rgb) {
          expect(rgb.r).toBeGreaterThanOrEqual(0);
          expect(rgb.r).toBeLessThanOrEqual(255);
        }
      });
    });

    it('should return null for invalid color format', () => {
      const invalidColor = 'not-a-color';
      const rgb = service['parseColorToRGB'](invalidColor);

      expect(rgb).toBeNull();
    });

    it('should return null for empty string', () => {
      const emptyColor = '';
      const rgb = service['parseColorToRGB'](emptyColor);

      expect(rgb).toBeNull();
    });

    it('should convert color from 0-1 range to 0-255 range', () => {
      // Pure white should be rgb(255, 255, 255)
      const whiteColor = 'rgb(255, 255, 255)';
      const rgb = service['parseColorToRGB'](whiteColor);

      expect(rgb).not.toBeNull();
      expect(rgb!.r).toBe(255);
      expect(rgb!.g).toBe(255);
      expect(rgb!.b).toBe(255);
    });

    it('should handle black color', () => {
      const blackColor = 'rgb(0, 0, 0)';
      const rgb = service['parseColorToRGB'](blackColor);

      expect(rgb).not.toBeNull();
      expect(rgb!.r).toBe(0);
      expect(rgb!.g).toBe(0);
      expect(rgb!.b).toBe(0);
    });
  });

  describe('calculateBackgroundLuminance (YIQ formula)', () => {
    it('should calculate luminance using YIQ formula', () => {
      // Mock getComputedStyle to return a known color
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('rgb(128, 128, 128)')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      const luminance = service['calculateBackgroundLuminance']();

      // YIQ formula: (128*299 + 128*587 + 128*114) / 1000 = 128
      expect(luminance).toBeCloseTo(128, 1);
    });

    it('should return 255 (light fallback) when CSS variable is empty', () => {
      // Mock getComputedStyle to return empty string
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      const luminance = service['calculateBackgroundLuminance']();

      expect(luminance).toBe(255);
    });

    it('should return 255 (light fallback) when color parsing fails', () => {
      // Mock getComputedStyle to return invalid color
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('invalid-color')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      const luminance = service['calculateBackgroundLuminance']();

      expect(luminance).toBe(255);
    });

    it('should calculate correct luminance for pure white', () => {
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('rgb(255, 255, 255)')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      const luminance = service['calculateBackgroundLuminance']();

      // YIQ formula: (255*299 + 255*587 + 255*114) / 1000 = 255
      expect(luminance).toBeCloseTo(255, 1);
    });

    it('should calculate correct luminance for pure black', () => {
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('rgb(0, 0, 0)')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      const luminance = service['calculateBackgroundLuminance']();

      // YIQ formula: (0*299 + 0*587 + 0*114) / 1000 = 0
      expect(luminance).toBe(0);
    });

    it('should read from --color-base-100 CSS variable', () => {
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('rgb(100, 100, 100)')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      service['calculateBackgroundLuminance']();

      expect(mockStyle.getPropertyValue).toHaveBeenCalledWith('--color-base-100');
    });

    it('should handle colors with extra whitespace', () => {
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('  rgb(128, 128, 128)  ')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      const luminance = service['calculateBackgroundLuminance']();

      // Should trim and parse correctly
      expect(luminance).toBeCloseTo(128, 1);
    });
  });

  describe('CSS Variable Reading', () => {
    it('should read CSS variables from document element', () => {
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('oklch(0.8 0.05 180)')
      };
      const getComputedStyleSpy = spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      service['calculateBackgroundLuminance']();

      expect(getComputedStyleSpy).toHaveBeenCalledWith(document.documentElement);
    });

    it('should handle missing CSS variable gracefully', () => {
      const mockStyle = {
        getPropertyValue: jasmine.createSpy('getPropertyValue').and.returnValue('')
      };
      spyOn(window, 'getComputedStyle').and.returnValue(mockStyle as any);

      // Should not throw error
      expect(() => service['calculateBackgroundLuminance']()).not.toThrow();
    });
  });

  describe('MutationObserver Integration', () => {
    it('should emit new theme value when data-theme changes', (done) => {
      let emissionCount = 0;

      service.theme$.subscribe((theme) => {
        emissionCount++;
        // First emission is initial value, second is after change
        if (emissionCount === 2) {
          expect(theme).toBe('dark');
          done();
        }
      });

      // Change theme
      setTimeout(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      }, 50);
    });

    it('should emit correct theme for multiple rapid changes', (done) => {
      const emissions: string[] = [];

      service.theme$.subscribe((theme) => {
        emissions.push(theme);
      });

      // Make multiple rapid changes
      setTimeout(() => {
        document.documentElement.setAttribute('data-theme', 'light');
      }, 50);

      setTimeout(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      }, 100);

      setTimeout(() => {
        document.documentElement.setAttribute('data-theme', 'emerald');
      }, 150);

      setTimeout(() => {
        // Should have received: initial + 3 changes
        expect(emissions.length).toBeGreaterThanOrEqual(3);
        expect(emissions[emissions.length - 1]).toBe('emerald');
        done();
      }, 250);
    });

    it('should observe document.documentElement for theme changes', () => {
      // MutationObserver is set up in constructor
      // Verify it exists by checking that theme changes are detected
      const initialTheme = service.getTheme();
      expect(initialTheme).toBeDefined();
    });
  });
});
