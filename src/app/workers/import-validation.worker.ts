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

/// <reference lib="webworker" />

/**
 * CRITICAL: EntityPropertyType Enum Duplication
 *
 * This enum is duplicated from src/app/interfaces/entity.ts because Web Workers
 * run in a separate thread context and CANNOT import from the main application thread.
 *
 * IMPORTANT MAINTENANCE NOTES:
 * 1. This enum MUST be kept in sync with EntityPropertyType in entity.ts
 * 2. Any changes to EntityPropertyType in entity.ts MUST be mirrored here
 * 3. Failure to sync will cause validation errors for new property types
 * 4. Consider using a build-time script to automate synchronization in the future
 *
 * Why this duplication is necessary:
 * - Web Workers execute in isolated contexts (no shared memory)
 * - Workers cannot use ES6 imports (module resolution is limited)
 * - Attempting to import causes runtime errors: "Cannot use import statement outside a module"
 * - The worker needs property type constants for type-specific validation logic
 *
 * Alternative approaches considered:
 * - Dynamic import(): Not supported in worker contexts
 * - SharedArrayBuffer: Overkill for simple enum values
 * - Message passing: Would add complexity and performance overhead
 * - Build-time code injection: Would require custom webpack configuration
 *
 * @see src/app/interfaces/entity.ts - Source of truth for EntityPropertyType
 * @see docs/development/IMPORT_EXPORT.md - Architecture documentation
 */
const EntityPropertyType = {
  Unknown: 0,
  TextShort: 1,
  TextLong: 2,
  Boolean: 3,
  Date: 4,
  DateTime: 5,
  DateTimeLocal: 6,
  Money: 7,
  IntegerNumber: 8,
  DecimalNumber: 9,
  ForeignKeyName: 10,
  User: 11,
  GeoPoint: 12,
  Color: 13,
  ManyToMany: 14
};

interface ImportError {
  row: number;
  column: string;
  value: any;
  error: string;
  errorType: string;
}

interface ValidationErrorSummary {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsByColumn: Map<string, number>;
  firstNErrors: ImportError[];
  allErrors: ImportError[];
}

/**
 * Cancellation flag - set to true when main thread sends 'cancel' message.
 * Checked during validation loop to allow early termination.
 */
let cancelled = false;

/**
 * Main message handler for Web Worker.
 *
 * Receives two message types:
 * - 'cancel': Stops validation in progress and sends 'cancelled' response
 * - 'validate': Starts validation with provided data, properties, and FK lookups
 *
 * @listens message
 */
addEventListener('message', ({ data }) => {
  if (data.type === 'cancel') {
    cancelled = true;
    postMessage({ type: 'cancelled' });
    return;
  }

  if (data.type === 'validate') {
    cancelled = false;
    validateData(data.data);
  }
});

/**
 * Core validation function - processes import rows with chunked progress updates.
 *
 * Validation Pipeline:
 * 1. Iterate through all rows from Excel file
 * 2. For each property in each row:
 *    a. Skip M:M properties (not yet supported for import)
 *    b. Skip system columns (id, created_at, updated_at)
 *    c. Handle NULL values (set null for nullable fields, error for required fields)
 *    d. Validate type-specific constraints (text length, number range, FK lookup, etc.)
 * 3. Build validatedRow with column_name keys (not display_name)
 * 4. Ensure ALL rows have identical keys (PostgREST PGRST102 requirement)
 * 5. Send progress updates every N rows (chunked to avoid flooding main thread)
 * 6. Build error summary with type grouping and column grouping
 * 7. Send completion message with valid rows and error summary
 *
 * CRITICAL: PostgREST bulk insert requires all objects to have identical keys.
 * Even nullable fields must be present with null values (line 145-147).
 *
 * @param params Object containing:
 *   - rows: Array of raw Excel data (display_name as keys)
 *   - properties: Array of SchemaEntityProperty objects
 *   - fkLookups: Serialized FK lookup maps (displayNameToIds, validIds, idsToDisplayName)
 *   - entityKey: Table name for the entity being imported
 *
 * @fires progress - Sends validation progress percentage updates
 * @fires complete - Sends validation results (valid rows and error summary)
 * @fires cancelled - Sends cancellation acknowledgment
 */
function validateData(params: any): void {
  const { rows, properties, fkLookups, entityKey } = params;

  const validRows: any[] = [];
  const allErrors: ImportError[] = [];
  const errorsByType = new Map<string, number>();
  const errorsByColumn = new Map<string, number>();

  const totalRows = rows.length;
  const chunkSize = totalRows > 1000 ? 100 : 10;

  for (let i = 0; i < totalRows; i++) {
    if (cancelled) {
      postMessage({ type: 'cancelled' });
      return;
    }

    const row = rows[i];
    const rowNumber = i + 3; // +3 for 1-indexed, hint row, and header row
    const rowErrors: ImportError[] = [];

    const validatedRow: any = {};

    // Validate each property
    for (const prop of properties) {
      // Skip M:M properties
      if (prop.type === EntityPropertyType.ManyToMany) {
        continue;
      }

      // Skip system columns (id, created_at, updated_at)
      if (['id', 'created_at', 'updated_at'].includes(prop.column_name)) {
        continue;
      }

      const displayName = prop.display_name;
      const value = row[displayName];

      // NULL handling
      if (value === null || value === undefined || value === '') {
        if (!prop.is_nullable) {
          rowErrors.push({
            row: rowNumber,
            column: displayName,
            value: value,
            error: 'This field is required',
            errorType: 'Required field missing'
          });
        } else {
          // Add null value to ensure consistent keys across all rows
          // PostgREST bulk insert requires all objects to have identical keys
          validatedRow[prop.column_name] = null;
        }
        continue;
      }

      // Type-specific validation
      try {
        const validatedValue = validateProperty(prop, value, fkLookups, rowNumber, displayName, rowErrors);
        if (validatedValue !== undefined) {
          validatedRow[prop.column_name] = validatedValue;
        }
      } catch (error) {
        rowErrors.push({
          row: rowNumber,
          column: displayName,
          value: value,
          error: error instanceof Error ? error.message : 'Validation error',
          errorType: 'Validation error'
        });
      }
    }

    // If no errors, add to valid rows
    if (rowErrors.length === 0) {
      validRows.push(validatedRow);
    } else {
      allErrors.push(...rowErrors);

      // Track error stats
      rowErrors.forEach(err => {
        errorsByType.set(err.errorType, (errorsByType.get(err.errorType) || 0) + 1);
        errorsByColumn.set(err.column, (errorsByColumn.get(err.column) || 0) + 1);
      });
    }

    // Send progress updates
    if (i % chunkSize === 0 || i === totalRows - 1) {
      const percentage = Math.round(((i + 1) / totalRows) * 100);
      postMessage({
        type: 'progress',
        progress: {
          currentRow: i + 1,
          totalRows: totalRows,
          percentage: percentage,
          stage: 'Validating'
        }
      });
    }
  }

  // Build summary
  const errorSummary: ValidationErrorSummary = {
    totalErrors: allErrors.length,
    errorsByType: errorsByType,
    errorsByColumn: errorsByColumn,
    firstNErrors: allErrors.slice(0, 100),
    allErrors: allErrors
  };

  // Send completion
  postMessage({
    type: 'complete',
    results: {
      validRows: validRows,
      errorSummary: errorSummary
    }
  });
}

/**
 * Route property validation to type-specific validator function.
 *
 * Acts as a dispatcher that delegates to specialized validation functions
 * based on the property's EntityPropertyType.
 *
 * @param prop Property metadata (type, validation_rules, join_table, etc.)
 * @param value Raw value from Excel cell
 * @param fkLookups FK lookup maps for foreign key validation
 * @param rowNumber Excel row number (for error reporting)
 * @param displayName Property display name (for error messages)
 * @param rowErrors Array to collect validation errors
 * @returns Validated and transformed value ready for database insertion
 */
function validateProperty(
  prop: any,
  value: any,
  fkLookups: any,
  rowNumber: number,
  displayName: string,
  rowErrors: ImportError[]
): any {
  switch (prop.type) {
    case EntityPropertyType.TextShort:
    case EntityPropertyType.TextLong:
      return validateText(prop, value, rowNumber, displayName, rowErrors);

    case EntityPropertyType.IntegerNumber:
      return validateInteger(prop, value, rowNumber, displayName, rowErrors);

    case EntityPropertyType.Money:
      return validateMoney(prop, value, rowNumber, displayName, rowErrors);

    case EntityPropertyType.Boolean:
      return validateBoolean(value, rowNumber, displayName, rowErrors);

    case EntityPropertyType.Date:
    case EntityPropertyType.DateTime:
    case EntityPropertyType.DateTimeLocal:
      return validateDateTime(prop, value, rowNumber, displayName, rowErrors);

    case EntityPropertyType.ForeignKeyName:
    case EntityPropertyType.User:
      return validateForeignKey(prop, value, fkLookups, rowNumber, displayName, rowErrors);

    case EntityPropertyType.GeoPoint:
      return validateGeoPoint(value, rowNumber, displayName, rowErrors);

    case EntityPropertyType.Color:
      return validateColor(value, rowNumber, displayName, rowErrors);

    default:
      return value;
  }
}

function validateText(prop: any, value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): string {
  const str = String(value).trim();

  // Validation rules
  if (prop.validation_rules) {
    for (const rule of prop.validation_rules) {
      if (rule.type === 'minLength' && str.length < parseInt(rule.value)) {
        rowErrors.push({
          row: rowNumber,
          column: displayName,
          value: value,
          error: rule.message || `Must be at least ${rule.value} characters`,
          errorType: 'Text length error'
        });
      }
      if (rule.type === 'maxLength' && str.length > parseInt(rule.value)) {
        rowErrors.push({
          row: rowNumber,
          column: displayName,
          value: value,
          error: rule.message || `Must be at most ${rule.value} characters`,
          errorType: 'Text length error'
        });
      }
      if (rule.type === 'pattern' && !new RegExp(rule.value).test(str)) {
        rowErrors.push({
          row: rowNumber,
          column: displayName,
          value: value,
          error: rule.message || 'Invalid format',
          errorType: 'Pattern mismatch'
        });
      }
    }
  }

  return str;
}

function validateInteger(prop: any, value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): number {
  const num = parseInt(String(value));

  if (isNaN(num)) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Must be a valid number',
      errorType: 'Invalid number'
    });
    return 0;
  }

  // Validation rules
  if (prop.validation_rules) {
    for (const rule of prop.validation_rules) {
      if (rule.type === 'min' && num < parseFloat(rule.value)) {
        rowErrors.push({
          row: rowNumber,
          column: displayName,
          value: value,
          error: rule.message || `Must be at least ${rule.value}`,
          errorType: 'Number range error'
        });
      }
      if (rule.type === 'max' && num > parseFloat(rule.value)) {
        rowErrors.push({
          row: rowNumber,
          column: displayName,
          value: value,
          error: rule.message || `Must be at most ${rule.value}`,
          errorType: 'Number range error'
        });
      }
    }
  }

  return num;
}

function validateMoney(prop: any, value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): number {
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));

  if (isNaN(num)) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Must be a valid monetary value',
      errorType: 'Invalid money'
    });
    return 0;
  }

  return num;
}

function validateBoolean(value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): boolean {
  const str = String(value).toLowerCase().trim();

  if (['true', 'yes', '1', 'y'].includes(str)) return true;
  if (['false', 'no', '0', 'n'].includes(str)) return false;

  rowErrors.push({
    row: rowNumber,
    column: displayName,
    value: value,
    error: 'Must be true/false or yes/no',
    errorType: 'Invalid boolean'
  });
  return false;
}

function validateDateTime(prop: any, value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): string {
  const str = String(value).trim();

  // Try to parse as Date
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Invalid date/time format',
      errorType: 'Invalid datetime'
    });
    return str;
  }

  // Format based on type
  if (prop.type === EntityPropertyType.Date) {
    return date.toISOString().split('T')[0];
  } else if (prop.type === EntityPropertyType.DateTimeLocal) {
    return date.toISOString();
  } else {
    // DateTime - no timezone
    return date.toISOString().replace('Z', '').replace('.000', '');
  }
}

/**
 * Validate foreign key with hybrid ID/name lookup (FK Hybrid Display approach).
 *
 * Accepts EITHER:
 * - Direct ID values (e.g., 5 or "a1b2c3d4-uuid")
 * - Display names (case-insensitive, e.g., "John Doe" → ID lookup)
 *
 * This enables flexible data entry:
 * - Power users can use IDs for precision
 * - Regular users can use human-readable names
 * - Export → Edit → Import workflow preserves both ID and Name columns
 *
 * Validation Logic:
 * 1. Check if value is a valid ID (direct match in validIds Set)
 * 2. If not ID, perform case-insensitive name lookup in displayNameToIds Map
 * 3. If name matches multiple IDs, error (ambiguous - user must use ID)
 * 4. If name matches one ID, return that ID
 * 5. If no match, error (not found)
 *
 * @param prop Property metadata (join_table, join_column, type)
 * @param value Raw value from Excel (ID or display name)
 * @param fkLookups FK lookup maps from main thread
 * @param rowNumber Excel row number (for error reporting)
 * @param displayName Property display name (for error messages)
 * @param rowErrors Array to collect validation errors
 * @returns Validated ID value, or null if validation failed
 *
 * @see docs/development/IMPORT_EXPORT.md - FK Hybrid Display architecture
 */
function validateForeignKey(
  prop: any,
  value: any,
  fkLookups: any,
  rowNumber: number,
  displayName: string,
  rowErrors: ImportError[]
): any {
  const tableName = prop.type === EntityPropertyType.User ? 'civic_os_users' : prop.join_table;
  const lookup = fkLookups[tableName];

  if (!lookup) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'FK lookup not available',
      errorType: 'System error'
    });
    return null;
  }

  // Check if value is an ID
  if (lookup.validIds.includes(value)) {
    return value;
  }

  // Try name lookup (case-insensitive)
  const nameKey = String(value).toLowerCase().trim();
  const ids = lookup.displayNameToIds[nameKey];

  if (!ids || ids.length === 0) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: `"${value}" not found in ${displayName}`,
      errorType: `${displayName} not found`
    });
    return null;
  }

  if (ids.length > 1) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: `"${value}" matches multiple ${displayName} entries. Use ID instead.`,
      errorType: `Duplicate ${displayName}`
    });
    return null;
  }

  return ids[0];
}

function validateGeoPoint(value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): string {
  const str = String(value).trim();

  // Check if already in WKT format
  if (str.startsWith('POINT(')) {
    return `SRID=4326;${str}`;
  }

  // Parse lat,lng format
  const parts = str.split(',').map(p => p.trim());
  if (parts.length !== 2) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Must be in format: latitude,longitude (e.g., 42.36,-71.06)',
      errorType: 'Invalid geopoint'
    });
    return str;
  }

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Latitude and longitude must be valid numbers',
      errorType: 'Invalid geopoint'
    });
    return str;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Latitude must be between -90 and 90, longitude between -180 and 180',
      errorType: 'Invalid geopoint'
    });
    return str;
  }

  // Convert to WKT (note: WKT is lng,lat not lat,lng)
  return `SRID=4326;POINT(${lng} ${lat})`;
}

function validateColor(value: any, rowNumber: number, displayName: string, rowErrors: ImportError[]): string {
  const str = String(value).trim().toUpperCase();

  // Check hex color format
  if (!/^#[0-9A-F]{6}$/.test(str)) {
    rowErrors.push({
      row: rowNumber,
      column: displayName,
      value: value,
      error: 'Must be in format #RRGGBB (e.g., #3B82F6)',
      errorType: 'Invalid color'
    });
    return str;
  }

  return str;
}
