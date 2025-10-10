# Drag-and-Drop Bug Fix Documentation

## Bug Summary
System fields (`id`, `created_at`, `updated_at`, `civic_os_text_search`) were incorrectly appearing on pages after using drag-and-drop to reorder properties in the Property Management UI.

## Root Cause
The `update_property_sort_order` database function was creating metadata rows with **table defaults** (`show_on_list=true`) instead of **smart defaults** (`show_on_list=false` for system fields).

### Detailed Bug Flow
1. User drags to reorder properties in Property Management
2. Frontend calls `update_property_sort_order()` for ALL properties (including system fields)
3. For properties without existing metadata rows (like `id`), function creates new rows
4. **BUG**: Function only inserted `(table_name, column_name, sort_order)`
5. PostgreSQL auto-filled missing columns with table defaults from schema:
   ```sql
   show_on_list BOOLEAN DEFAULT true,  -- ❌ Wrong for system fields!
   show_on_create BOOLEAN DEFAULT true,
   show_on_edit BOOLEAN DEFAULT true,
   show_on_detail BOOLEAN DEFAULT true
   ```
6. View's `COALESCE(properties.show_on_list, CASE...)` found `true` in metadata table
7. Smart defaults in CASE statement never executed
8. System fields appeared everywhere 😱

## The Fix

### 1. Updated SQL Function (postgres/3_civic_os_schema.sql:558-597)

**Before:**
```sql
INSERT INTO metadata.properties (table_name, column_name, sort_order)
VALUES (p_table_name, p_column_name, p_sort_order)
ON CONFLICT (table_name, column_name) DO UPDATE
  SET sort_order = EXCLUDED.sort_order;
```

**After:**
```sql
INSERT INTO metadata.properties (
  table_name, column_name, sort_order,
  show_on_list, show_on_create, show_on_edit, show_on_detail
)
VALUES (
  p_table_name, p_column_name, p_sort_order,
  -- Smart defaults matching view logic
  CASE WHEN p_column_name IN ('id', 'civic_os_text_search', 'created_at', 'updated_at')
    THEN false ELSE true END,
  CASE WHEN p_column_name IN ('id', 'civic_os_text_search', 'created_at', 'updated_at')
    THEN false ELSE true END,
  CASE WHEN p_column_name IN ('id', 'civic_os_text_search', 'created_at', 'updated_at')
    THEN false ELSE true END,
  CASE WHEN p_column_name IN ('id', 'civic_os_text_search') THEN false
       WHEN p_column_name IN ('created_at', 'updated_at') THEN true
       ELSE true END
)
ON CONFLICT (table_name, column_name) DO UPDATE
  SET sort_order = EXCLUDED.sort_order;
  -- Note: Don't update show_on_* to preserve user customizations
```

### 2. Created Cleanup Script (cleanup_metadata_defaults.sql)

For databases with existing corrupted data:
```bash
docker exec -i postgres_db psql -U postgres -d civic_os_db < cleanup_metadata_defaults.sql
```

Script deletes metadata rows where system fields have table defaults instead of smart defaults.

### 3. Added Regression Test (property-management.service.spec.ts:188-214)

Documents expected behavior and prevents future regressions:
```typescript
it('should handle reordering system fields without breaking visibility (regression test)', ...)
```

## Smart Defaults Reference

| Field                | List | Create | Edit | Detail |
|----------------------|------|--------|------|--------|
| `id`                 | ❌   | ❌     | ❌   | ❌     |
| `civic_os_text_search` | ❌   | ❌     | ❌   | ❌     |
| `created_at`         | ❌   | ❌     | ❌   | ✅     |
| `updated_at`         | ❌   | ❌     | ❌   | ✅     |
| Regular fields       | ✅   | ✅     | ✅   | ✅     |

## Verification Steps

### 1. Check Database Schema
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'update_property_sort_order';
```
Should contain: `-- Smart defaults: same logic as schema_properties view`

### 2. Test Drag-and-Drop
1. Go to Property Management as admin
2. Drag any property to reorder
3. Check database:
   ```sql
   SELECT column_name, show_on_list, show_on_create, show_on_edit, show_on_detail
   FROM metadata.properties
   WHERE column_name IN ('id', 'created_at', 'updated_at')
   ORDER BY column_name;
   ```
4. Verify correct values:
   - `id`: `f, f, f, f`
   - `created_at`: `f, f, f, t`
   - `updated_at`: `f, f, f, t`

### 3. Test UI
- `id` should NOT appear on List/Create/Edit pages
- `created_at` and `updated_at` should ONLY appear on Detail page (by default)
- Admin can still override these by checking boxes in Property Management

## Files Modified

1. `postgres/3_civic_os_schema.sql` (lines 558-597) - Fixed SQL function
2. `cleanup_metadata_defaults.sql` (new) - Data cleanup script
3. `src/app/services/property-management.service.spec.ts` - Added regression test

## Test Results

✅ All 445 unit tests pass
✅ Database function verified with smart defaults
✅ Manual testing confirms system fields remain hidden after reordering

## Related Context

This bug fix is part of a larger feature implementation for property visibility management:
- Wired up "Show On" toggles in Property Management UI
- Implemented smart defaults in database view
- Made visibility toggles override hardcoded hideFields logic
- Fixed date display format (EDT instead of GMT-04:00)

Date: October 10, 2025
