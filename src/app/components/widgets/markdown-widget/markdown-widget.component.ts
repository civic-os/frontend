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

import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';
import { DashboardWidget, MarkdownWidgetConfig } from '../../../interfaces/dashboard';

/**
 * Markdown Widget Component
 *
 * Displays formatted markdown content with optional HTML support.
 * - Phase 1: Basic markdown rendering
 * - No auto-refresh (static content)
 * - DOMPurify sanitization if enableHtml is true
 *
 * Widget Config (JSONB):
 * {
 *   "content": "# Markdown text...",
 *   "enableHtml": false
 * }
 */
@Component({
  selector: 'app-markdown-widget',
  imports: [MarkdownModule],
  templateUrl: './markdown-widget.component.html',
  styleUrl: './markdown-widget.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkdownWidgetComponent {
  // Widget configuration from parent
  widget = input.required<DashboardWidget>();

  // Extract config as typed interface
  config = computed<MarkdownWidgetConfig>(() => {
    const w = this.widget();
    return w.config as MarkdownWidgetConfig;
  });

  // Markdown content to display
  content = computed(() => {
    const cfg = this.config();
    return cfg?.content || '';
  });

  // Whether to allow HTML in markdown (default: false for security)
  enableHtml = computed(() => {
    const cfg = this.config();
    return cfg?.enableHtml || false;
  });
}
