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

/**
 * Dashboard metadata and configuration.
 * Represents a collection of widgets displayed together.
 */
export interface Dashboard {
  id: number;
  display_name: string;
  description: string | null;
  is_default: boolean;
  is_public: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  widgets?: DashboardWidget[];  // Embedded widgets from PostgREST
}

/**
 * Widget configuration and metadata.
 * Uses hybrid storage: common fields as columns, widget-specific config in JSONB.
 */
export interface DashboardWidget {
  id: number;
  dashboard_id: number;
  widget_type: string;
  title: string | null;
  entity_key: string | null;
  refresh_interval_seconds: number | null;
  sort_order: number;
  width: number;  // 1-2 grid columns
  height: number; // 1-3 grid rows
  config: Record<string, any>;  // Widget-specific configuration (JSONB)
  created_at: string;
  updated_at: string;
}

/**
 * Widget type metadata from metadata.widget_types table.
 * Defines available widget types and their properties.
 */
export interface WidgetType {
  widget_type: string;
  display_name: string;
  description: string;
  icon_name: string;
  is_active: boolean;
  config_schema?: any;  // JSON Schema for validation (Phase 3)
}

/**
 * Configuration for markdown widget.
 * Stored in dashboard_widgets.config as JSONB.
 */
export interface MarkdownWidgetConfig {
  content: string;
  enableHtml: boolean;
}

/**
 * Configuration for filtered list widget (Phase 2).
 * Stored in dashboard_widgets.config as JSONB.
 */
export interface FilteredListWidgetConfig {
  filters: FilterCondition[];
  orderBy: string;
  orderDirection: 'asc' | 'desc';
  limit: number;
  showColumns: string[];
}

/**
 * Configuration for stat card widget (Phase 5).
 * Stored in dashboard_widgets.config as JSONB.
 */
export interface StatCardWidgetConfig {
  metric: 'count' | 'sum' | 'avg' | 'min' | 'max';
  entityKey: string;
  column?: string;  // Column to aggregate (required for sum/avg/min/max)
  filters: FilterCondition[];
  suffix?: string;  // e.g., " open issues"
  prefix?: string;  // e.g., "$"
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

/**
 * Filter condition for widgets.
 * Used in filtered list and stat card widgets.
 */
export interface FilterCondition {
  column: string;
  operator: string;  // 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in'
  value: any;
}
