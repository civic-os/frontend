-- =====================================================
-- Custom Dashboards Schema
-- =====================================================
-- This file creates the database schema for customizable dashboards
-- with configurable widgets.
-- Phase 1: Core Infrastructure (Static dashboards with markdown)

-- =====================================================
-- Widget Types Registry (Extensible)
-- =====================================================
CREATE TABLE metadata.widget_types (
  widget_type VARCHAR(50) PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  config_schema JSONB,  -- JSON Schema for validation (future Phase 3)
  icon_name VARCHAR(50),  -- Material icon name for UI
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate with initial widget types (Phase 1: markdown only)
INSERT INTO metadata.widget_types (widget_type, display_name, description, icon_name) VALUES
  ('markdown', 'Markdown Content', 'Display formatted text, images, and links', 'article'),
  ('filtered_list', 'Filtered Entity List', 'Show filtered records from any entity (Phase 2)', 'list'),
  ('stat_card', 'Statistic Card', 'Display a single metric or KPI (Phase 5)', 'analytics'),
  ('query_result', 'Query Result', 'Show results from a database view (Phase 5)', 'table_view');

GRANT SELECT ON metadata.widget_types TO web_anon, authenticated;

-- =====================================================
-- Dashboards
-- =====================================================
CREATE TABLE metadata.dashboards (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,  -- System default dashboard
  is_public BOOLEAN DEFAULT TRUE,    -- Visible to all users
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES civic_os_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one dashboard can be the system default
CREATE UNIQUE INDEX idx_dashboards_single_default
  ON metadata.dashboards (is_default)
  WHERE is_default = TRUE;

-- Triggers for timestamp management
CREATE TRIGGER set_created_at_trigger
  BEFORE INSERT ON metadata.dashboards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_at();

CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.dashboards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE metadata.dashboards ENABLE ROW LEVEL SECURITY;

-- Everyone can read public dashboards
CREATE POLICY "Everyone can read public dashboards"
  ON metadata.dashboards
  FOR SELECT
  TO PUBLIC
  USING (is_public = TRUE);

-- Users can read their own private dashboards
CREATE POLICY "Users can read own private dashboards"
  ON metadata.dashboards
  FOR SELECT
  TO authenticated
  USING (created_by = public.current_user_id());

-- Admins can create dashboards
CREATE POLICY "Admins can insert dashboards"
  ON metadata.dashboards
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update dashboards
CREATE POLICY "Admins can update dashboards"
  ON metadata.dashboards
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete dashboards
CREATE POLICY "Admins can delete dashboards"
  ON metadata.dashboards
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON metadata.dashboards TO web_anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON metadata.dashboards TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE metadata.dashboards_id_seq TO authenticated;

-- =====================================================
-- Dashboard Widgets (Hybrid: Columns + JSONB)
-- =====================================================
CREATE TABLE metadata.dashboard_widgets (
  id SERIAL PRIMARY KEY,
  dashboard_id INT NOT NULL REFERENCES metadata.dashboards(id) ON DELETE CASCADE,
  widget_type VARCHAR(50) NOT NULL REFERENCES metadata.widget_types(widget_type),

  -- Common fields (typed, indexed, queryable)
  title TEXT,
  entity_key NAME,  -- Denormalized for queries (NULL for non-entity widgets like markdown)
  refresh_interval_seconds INT DEFAULT NULL,  -- NULL = no auto-refresh (Phase 1), 60 = default (Phase 2)

  -- Layout
  sort_order INT DEFAULT 0,
  width INT DEFAULT 1,  -- Grid columns (1-2)
  height INT DEFAULT 1, -- Grid rows (1-3)

  -- Widget-specific configuration (flexible)
  config JSONB NOT NULL DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validation
  CONSTRAINT valid_refresh_interval CHECK (refresh_interval_seconds IS NULL OR refresh_interval_seconds >= 0),
  CONSTRAINT valid_width CHECK (width BETWEEN 1 AND 2),
  CONSTRAINT valid_height CHECK (height BETWEEN 1 AND 3)
);

-- Index for "find widgets using entity X"
CREATE INDEX idx_widgets_entity_key ON metadata.dashboard_widgets(entity_key)
  WHERE entity_key IS NOT NULL;

-- Index for dashboard rendering (fetch all widgets)
CREATE INDEX idx_widgets_dashboard_id ON metadata.dashboard_widgets(dashboard_id, sort_order);

-- GIN index for JSONB queries (if needed later)
CREATE INDEX idx_widgets_config ON metadata.dashboard_widgets USING GIN (config);

-- Triggers
CREATE TRIGGER set_created_at_trigger
  BEFORE INSERT ON metadata.dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_at();

CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE metadata.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Everyone can read widgets of public dashboards
CREATE POLICY "Everyone can read public dashboard widgets"
  ON metadata.dashboard_widgets
  FOR SELECT
  TO PUBLIC
  USING (
    dashboard_id IN (
      SELECT id FROM metadata.dashboards WHERE is_public = TRUE
    )
  );

-- Users can read widgets of their private dashboards
CREATE POLICY "Users can read own dashboard widgets"
  ON metadata.dashboard_widgets
  FOR SELECT
  TO authenticated
  USING (
    dashboard_id IN (
      SELECT id FROM metadata.dashboards
      WHERE created_by = public.current_user_id()
    )
  );

-- Admins can manage widgets
CREATE POLICY "Admins can manage widgets"
  ON metadata.dashboard_widgets
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON metadata.dashboard_widgets TO web_anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON metadata.dashboard_widgets TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE metadata.dashboard_widgets_id_seq TO authenticated;

-- =====================================================
-- User Dashboard Preferences (Schema - Phase 3 functionality)
-- =====================================================
CREATE TABLE metadata.user_dashboard_preferences (
  user_id UUID PRIMARY KEY REFERENCES civic_os_users(id) ON DELETE CASCADE,
  default_dashboard_id INT REFERENCES metadata.dashboards(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE metadata.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own preferences
CREATE POLICY "Users can manage own preferences"
  ON metadata.user_dashboard_preferences
  FOR ALL
  TO authenticated
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

GRANT SELECT, INSERT, UPDATE ON metadata.user_dashboard_preferences TO authenticated;

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get user's default dashboard (user preference > system default)
CREATE OR REPLACE FUNCTION public.get_user_default_dashboard()
RETURNS INT AS $$
DECLARE
  v_user_id UUID;
  v_dashboard_id INT;
BEGIN
  v_user_id := public.current_user_id();

  -- Try user preference first (Phase 3 feature)
  IF v_user_id IS NOT NULL THEN
    SELECT default_dashboard_id INTO v_dashboard_id
    FROM metadata.user_dashboard_preferences
    WHERE user_id = v_user_id;

    IF v_dashboard_id IS NOT NULL THEN
      RETURN v_dashboard_id;
    END IF;
  END IF;

  -- Fall back to system default
  SELECT id INTO v_dashboard_id
  FROM metadata.dashboards
  WHERE is_default = TRUE AND is_public = TRUE
  LIMIT 1;

  RETURN v_dashboard_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_default_dashboard() TO web_anon, authenticated;

-- =====================================================
-- RPC Functions for Dashboard Access
-- =====================================================

/**
 * Get all visible dashboards (public + user's private)
 * Returns dashboards ordered by sort_order
 */
CREATE OR REPLACE FUNCTION public.get_dashboards()
RETURNS TABLE (
  id INT,
  display_name VARCHAR(100),
  description TEXT,
  is_default BOOLEAN,
  is_public BOOLEAN,
  sort_order INT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.display_name,
    d.description,
    d.is_default,
    d.is_public,
    d.sort_order,
    d.created_by,
    d.created_at,
    d.updated_at
  FROM metadata.dashboards d
  WHERE d.is_public = TRUE
     OR d.created_by = public.current_user_id()
  ORDER BY d.sort_order ASC, d.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_dashboards() TO web_anon, authenticated;

COMMENT ON FUNCTION public.get_dashboards() IS
  'Returns all dashboards visible to the current user (public dashboards + user''s private dashboards)';

/**
 * Get a specific dashboard with embedded widgets
 * Returns JSON with dashboard + widgets array
 */
CREATE OR REPLACE FUNCTION public.get_dashboard(p_dashboard_id INT)
RETURNS JSON AS $$
DECLARE
  v_dashboard JSON;
  v_widgets JSON;
  v_result JSON;
BEGIN
  -- Check if user can access this dashboard
  IF NOT EXISTS (
    SELECT 1 FROM metadata.dashboards
    WHERE id = p_dashboard_id
      AND (is_public = TRUE OR created_by = public.current_user_id())
  ) THEN
    RETURN NULL;
  END IF;

  -- Get dashboard data
  SELECT row_to_json(d.*) INTO v_dashboard
  FROM metadata.dashboards d
  WHERE d.id = p_dashboard_id;

  -- Get widgets data (sorted by sort_order)
  SELECT json_agg(w.* ORDER BY w.sort_order) INTO v_widgets
  FROM metadata.dashboard_widgets w
  WHERE w.dashboard_id = p_dashboard_id;

  -- Combine into single JSON object with widgets array
  v_result := jsonb_build_object(
    'id', (v_dashboard->>'id')::INT,
    'display_name', v_dashboard->>'display_name',
    'description', v_dashboard->>'description',
    'is_default', (v_dashboard->>'is_default')::BOOLEAN,
    'is_public', (v_dashboard->>'is_public')::BOOLEAN,
    'sort_order', (v_dashboard->>'sort_order')::INT,
    'created_by', (v_dashboard->>'created_by')::UUID,
    'created_at', v_dashboard->>'created_at',
    'updated_at', v_dashboard->>'updated_at',
    'widgets', COALESCE(v_widgets, '[]'::json)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_dashboard(INT) TO web_anon, authenticated;

COMMENT ON FUNCTION public.get_dashboard(INT) IS
  'Returns a dashboard with embedded widgets as JSON. Returns NULL if dashboard not found or not accessible.';

-- =====================================================
-- Default "Welcome" Dashboard
-- =====================================================

-- Insert default dashboard
INSERT INTO metadata.dashboards (display_name, description, is_default, is_public, sort_order)
VALUES (
  'Welcome',
  'Welcome to Civic OS - Your customizable dashboard',
  TRUE,  -- This is the default dashboard
  TRUE,  -- Public (visible to everyone)
  0      -- First in sort order
);

-- Insert welcome markdown widget
INSERT INTO metadata.dashboard_widgets (
  dashboard_id,
  widget_type,
  title,
  entity_key,
  refresh_interval_seconds,
  sort_order,
  width,
  height,
  config
)
VALUES (
  (SELECT id FROM metadata.dashboards WHERE display_name = 'Welcome'),
  'markdown',
  NULL,  -- No title (markdown content has its own heading)
  NULL,  -- Not entity-related
  NULL,  -- No auto-refresh (static content)
  0,     -- First widget
  2,     -- Full width
  1,     -- Standard height
  jsonb_build_object(
    'content', E'# Welcome to Civic OS\n\nPoint Civic OS at your PostgreSQL database, and it instantly creates a working web application — complete with forms, tables, search, and user permissions. No front-end code to write, no forms to build. Just focus on your data.\n\n## Getting Started\n\n- **Browse Entities**: Use the menu to explore your database tables\n- **Create Records**: Click the "Create" button on any entity list page\n- **Search**: Use full-text search on list pages\n- **Customize**: Admins can configure dashboards, entities, and permissions\n\n## Next Steps\n\n1. Explore the **Database Schema** (ERD) to understand your data model\n2. Check the **Entity Management** page to customize display names\n3. Review **Permissions** to configure role-based access control\n\n---\n\n*This dashboard is customizable! Admins can edit widgets and create new dashboards in Phase 3.*',
    'enableHtml', false
  )
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
