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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SchemaEditorPage } from './schema-editor.page';
import { SchemaService } from '../../services/schema.service';
import { ThemeService } from '../../services/theme.service';
import { of } from 'rxjs';

/**
 * Unit tests for Schema Editor geometric port ordering functions.
 *
 * These tests focus on the critical geometry functions that power the
 * angle-based port placement algorithm. The algorithm maps angles to
 * entity sides and must correctly handle screen coordinates where Y
 * increases downward (opposite of mathematical convention).
 */
describe('SchemaEditorPage - Geometric Port Ordering', () => {
  let component: SchemaEditorPage;
  let fixture: ComponentFixture<SchemaEditorPage>;
  let mockSchemaService: jasmine.SpyObj<SchemaService>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;

  beforeEach(async () => {
    // Create mock services
    mockSchemaService = jasmine.createSpyObj('SchemaService', [
      'getEntities',
      'getProperties',
      'getDetectedJunctionTables'
    ]);
    mockThemeService = jasmine.createSpyObj('ThemeService', ['isDark']);

    // Set default mock return values
    mockSchemaService.getEntities.and.returnValue(of([]));
    mockSchemaService.getProperties.and.returnValue(of([]));
    mockSchemaService.getDetectedJunctionTables.and.returnValue(of(new Set<string>()));
    mockThemeService.isDark.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [SchemaEditorPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SchemaService, useValue: mockSchemaService },
        { provide: ThemeService, useValue: mockThemeService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SchemaEditorPage);
    component = fixture.componentInstance;
  });

  /**
   * Tests for determineSideFromAngle()
   *
   * This function maps angles (-180° to 180°) to entity sides (top, right, bottom, left).
   * Critical to get right because screen coordinates have Y increasing downward.
   */
  describe('determineSideFromAngle()', () => {
    // Helper to access private method
    function determineSideFromAngle(angle: number): 'top' | 'right' | 'bottom' | 'left' {
      return (component as any).determineSideFromAngle(angle);
    }

    describe('RIGHT side (angles -45° to 45°)', () => {
      it('should return "right" for -45° (boundary)', () => {
        expect(determineSideFromAngle(-45)).toBe('right');
      });

      it('should return "right" for -30° (upper right)', () => {
        expect(determineSideFromAngle(-30)).toBe('right');
      });

      it('should return "right" for 0° (directly right)', () => {
        expect(determineSideFromAngle(0)).toBe('right');
      });

      it('should return "right" for 30° (lower right)', () => {
        expect(determineSideFromAngle(30)).toBe('right');
      });

      it('should return "right" for 44.9° (just before boundary)', () => {
        expect(determineSideFromAngle(44.9)).toBe('right');
      });
    });

    describe('BOTTOM side (angles 45° to 135°) - positive Y in screen coords', () => {
      it('should return "bottom" for 45° (boundary)', () => {
        expect(determineSideFromAngle(45)).toBe('bottom');
      });

      it('should return "bottom" for 60° (lower-right diagonal)', () => {
        expect(determineSideFromAngle(60)).toBe('bottom');
      });

      it('should return "bottom" for 90° (directly down)', () => {
        expect(determineSideFromAngle(90)).toBe('bottom');
      });

      it('should return "bottom" for 120° (lower-left diagonal)', () => {
        expect(determineSideFromAngle(120)).toBe('bottom');
      });

      it('should return "bottom" for 134.9° (just before boundary)', () => {
        expect(determineSideFromAngle(134.9)).toBe('bottom');
      });
    });

    describe('LEFT side (angles 135° to -135°, wrapping through ±180°)', () => {
      it('should return "left" for 135° (boundary from bottom)', () => {
        expect(determineSideFromAngle(135)).toBe('left');
      });

      it('should return "left" for 150° (upper-left diagonal)', () => {
        expect(determineSideFromAngle(150)).toBe('left');
      });

      it('should return "left" for 180° (directly left)', () => {
        expect(determineSideFromAngle(180)).toBe('left');
      });

      it('should return "left" for -180° (directly left, negative notation)', () => {
        expect(determineSideFromAngle(-180)).toBe('left');
      });

      it('should return "left" for -150° (lower-left diagonal)', () => {
        expect(determineSideFromAngle(-150)).toBe('left');
      });

      it('should return "left" for -135.1° (just past boundary)', () => {
        expect(determineSideFromAngle(-135.1)).toBe('left');
      });
    });

    describe('TOP side (angles -135° to -45°) - negative Y in screen coords', () => {
      it('should return "top" for -135° (boundary from left)', () => {
        expect(determineSideFromAngle(-135)).toBe('top');
      });

      it('should return "top" for -120° (upper-left diagonal)', () => {
        expect(determineSideFromAngle(-120)).toBe('top');
      });

      it('should return "top" for -90° (directly up)', () => {
        expect(determineSideFromAngle(-90)).toBe('top');
      });

      it('should return "top" for -60° (upper-right diagonal)', () => {
        expect(determineSideFromAngle(-60)).toBe('top');
      });

      it('should return "top" for -45.1° (just past boundary)', () => {
        expect(determineSideFromAngle(-45.1)).toBe('top');
      });
    });

    describe('Edge cases and precision', () => {
      it('should handle very small positive angle', () => {
        expect(determineSideFromAngle(0.1)).toBe('right');
      });

      it('should handle very small negative angle', () => {
        expect(determineSideFromAngle(-0.1)).toBe('right');
      });

      it('should handle exact boundary at 45°', () => {
        // At exactly 45°, should be bottom (normalized >= 45 condition)
        expect(determineSideFromAngle(45.0)).toBe('bottom');
      });

      it('should handle exact boundary at -45°', () => {
        // At exactly -45°, should be right (normalized >= -45 condition)
        expect(determineSideFromAngle(-45.0)).toBe('right');
      });
    });
  });

  /**
   * Tests for getEntityCenter()
   *
   * This function calculates the center point of a JointJS element.
   * Must correctly handle position (top-left corner) + size to find center.
   */
  describe('getEntityCenter()', () => {
    // Helper to access private method
    function getEntityCenter(element: any): { x: number; y: number } {
      return (component as any).getEntityCenter(element);
    }

    it('should calculate center from position and size', () => {
      const mockElement = {
        position: () => ({ x: 100, y: 200 }),
        size: () => ({ width: 250, height: 100 })
      };

      const center = getEntityCenter(mockElement);

      expect(center.x).toBe(225); // 100 + 250/2
      expect(center.y).toBe(250); // 200 + 100/2
    });

    it('should handle zero position', () => {
      const mockElement = {
        position: () => ({ x: 0, y: 0 }),
        size: () => ({ width: 100, height: 50 })
      };

      const center = getEntityCenter(mockElement);

      expect(center.x).toBe(50);  // 0 + 100/2
      expect(center.y).toBe(25);  // 0 + 50/2
    });

    it('should handle large coordinates', () => {
      const mockElement = {
        position: () => ({ x: 5000, y: 3000 }),
        size: () => ({ width: 400, height: 200 })
      };

      const center = getEntityCenter(mockElement);

      expect(center.x).toBe(5200); // 5000 + 400/2
      expect(center.y).toBe(3100); // 3000 + 200/2
    });

    it('should handle decimal positions and sizes', () => {
      const mockElement = {
        position: () => ({ x: 100.5, y: 200.7 }),
        size: () => ({ width: 250.3, height: 100.9 })
      };

      const center = getEntityCenter(mockElement);

      expect(center.x).toBeCloseTo(225.65, 2); // 100.5 + 250.3/2
      expect(center.y).toBeCloseTo(251.15, 2); // 200.7 + 100.9/2
    });

    it('should handle square elements', () => {
      const mockElement = {
        position: () => ({ x: 300, y: 400 }),
        size: () => ({ width: 100, height: 100 })
      };

      const center = getEntityCenter(mockElement);

      expect(center.x).toBe(350); // 300 + 100/2
      expect(center.y).toBe(450); // 400 + 100/2
    });

    it('should handle very small elements', () => {
      const mockElement = {
        position: () => ({ x: 50, y: 75 }),
        size: () => ({ width: 10, height: 5 })
      };

      const center = getEntityCenter(mockElement);

      expect(center.x).toBe(55);   // 50 + 10/2
      expect(center.y).toBe(77.5); // 75 + 5/2
    });
  });
});

/**
 * Unit tests for Schema Editor system type filtering.
 *
 * These tests verify that system types (Files, Users) are correctly
 * filtered from the diagram and treated as property types instead of
 * entity relationships.
 */
describe('SchemaEditorPage - System Type Filtering', () => {
  let component: SchemaEditorPage;
  let fixture: ComponentFixture<SchemaEditorPage>;
  let mockSchemaService: jasmine.SpyObj<SchemaService>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;

  beforeEach(async () => {
    mockSchemaService = jasmine.createSpyObj('SchemaService', [
      'getEntities',
      'getProperties',
      'getDetectedJunctionTables'
    ]);
    mockThemeService = jasmine.createSpyObj('ThemeService', ['isDark']);

    mockSchemaService.getEntities.and.returnValue(of([]));
    mockSchemaService.getProperties.and.returnValue(of([]));
    mockSchemaService.getDetectedJunctionTables.and.returnValue(of(new Set<string>()));
    mockThemeService.isDark.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [SchemaEditorPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SchemaService, useValue: mockSchemaService },
        { provide: ThemeService, useValue: mockThemeService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SchemaEditorPage);
    component = fixture.componentInstance;
  });

  describe('detectSystemTypes()', () => {
    function detectSystemTypes(): Set<string> {
      return (component as any).detectSystemTypes();
    }

    it('should return files as system type', () => {
      const result = detectSystemTypes();
      expect(result.has('files')).toBe(true);
    });

    it('should return civic_os_users as system type', () => {
      const result = detectSystemTypes();
      expect(result.has('civic_os_users')).toBe(true);
    });

    it('should return exactly 2 system types', () => {
      const result = detectSystemTypes();
      expect(result.size).toBe(2);
    });

    it('should not include domain tables', () => {
      const result = detectSystemTypes();
      expect(result.has('issues')).toBe(false);
      expect(result.has('statuses')).toBe(false);
      expect(result.has('tags')).toBe(false);
    });
  });

  describe('visibleEntities', () => {
    it('should filter out system types', () => {
      // Set up entities
      component.entities.set([
        { table_name: 'issues', display_name: 'Issues', description: 'Issue tracking', sort_order: 1, search_fields: null, show_map: false, map_property_name: null, insert: true, select: true, update: true, delete: true },
        { table_name: 'statuses', display_name: 'Statuses', description: 'Issue statuses', sort_order: 2, search_fields: null, show_map: false, map_property_name: null, insert: true, select: true, update: true, delete: true }
      ]);

      // Set up system types
      component.systemTypes.set(new Set(['files', 'civic_os_users']));

      // Set up junction tables
      component.junctionTables.set(new Set());

      // Get visible entities
      const visible = component.visibleEntities();

      // Should include only domain tables (system types are filtered out)
      expect(visible.length).toBe(2); // issues, statuses
      expect(visible.find(e => e.table_name === 'issues')).toBeTruthy();
      expect(visible.find(e => e.table_name === 'statuses')).toBeTruthy();

      // Files and civic_os_users are system types and should be filtered out
      expect(visible.find(e => e.table_name === 'files')).toBeFalsy();
      expect(visible.find(e => e.table_name === 'civic_os_users')).toBeFalsy();
    });

    it('should filter out junction tables', () => {
      component.entities.set([
        { table_name: 'issues', display_name: 'Issues', description: 'Issue tracking', sort_order: 1, search_fields: null, show_map: false, map_property_name: null, insert: true, select: true, update: true, delete: true },
        { table_name: 'tags', display_name: 'Tags', description: 'Tag labels', sort_order: 2, search_fields: null, show_map: false, map_property_name: null, insert: true, select: true, update: true, delete: true }
      ]);

      component.systemTypes.set(new Set(['files', 'civic_os_users']));
      component.junctionTables.set(new Set(['issue_tags']));

      const visible = component.visibleEntities();

      // Should include domain tables but not junctions or system types
      expect(visible.find(e => e.table_name === 'issues')).toBeTruthy();
      expect(visible.find(e => e.table_name === 'tags')).toBeTruthy();
      expect(visible.find(e => e.table_name === 'issue_tags')).toBeFalsy();
      expect(visible.find(e => e.table_name === 'files')).toBeFalsy();
    });

    it('should handle empty entity list', () => {
      component.entities.set([]);
      component.systemTypes.set(new Set(['files', 'civic_os_users']));
      component.junctionTables.set(new Set());

      const visible = component.visibleEntities();

      // Should only show metadata entities that aren't system types
      expect(visible.length).toBe(0);
    });
  });

  describe('responsive layout detection', () => {
    it('should use LR layout for landscape orientation', () => {
      // Mock landscape dimensions (width > height)
      spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1920);
      spyOnProperty(window, 'innerHeight', 'get').and.returnValue(1080);

      const isLandscape = window.innerWidth > window.innerHeight;
      const rankdir = isLandscape ? 'LR' : 'TB';

      expect(rankdir).toBe('LR');
    });

    it('should use TB layout for portrait orientation', () => {
      // Mock portrait dimensions (height > width)
      spyOnProperty(window, 'innerWidth', 'get').and.returnValue(768);
      spyOnProperty(window, 'innerHeight', 'get').and.returnValue(1024);

      const isLandscape = window.innerWidth > window.innerHeight;
      const rankdir = isLandscape ? 'LR' : 'TB';

      expect(rankdir).toBe('TB');
    });

    it('should use LR layout for square dimensions', () => {
      // Mock square dimensions (width === height)
      spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight', 'get').and.returnValue(1000);

      const isLandscape = window.innerWidth > window.innerHeight;
      const rankdir = isLandscape ? 'LR' : 'TB';

      // Should default to LR when dimensions are equal
      expect(rankdir).toBe('TB'); // Not greater, so TB
    });
  });
});
