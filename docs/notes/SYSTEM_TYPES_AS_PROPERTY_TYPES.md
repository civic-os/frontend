# System Types as Property Types - Architecture Pattern

**Date**: January 2025
**Status**: Implemented
**Components**: Schema Editor POC, Schema Inspector Panel

## Overview

This document describes the architectural decision to treat certain metadata tables (Files, Users) as **property types** rather than **entity relationships** in the Schema Editor and Inspector Panel.

## The Core Concept

### Traditional Database View
In a traditional ER diagram, ALL foreign keys are shown as relationship lines between entities:
```
Issue ──[photo_id]──> File
Issue ──[reporter_id]──> User
Issue ──[status_id]──> Status
```

### System Types View (Our Approach)
We distinguish between **domain relationships** and **system type properties**:

```
Issue ──[status_id]──> Status   (shown as relationship line)

Issue
├─ 📄 photo: File                (shown as property with icon)
└─ 👤 reporter: User              (shown as property with icon)
```

## Why This Pattern?

### Problem Statement
Files and Users are **metadata system tables** that serve as foundational types, similar to primitive types like `Color`, `Email`, or `PhoneNumber`. Showing them as entity boxes and relationship lines:
- **Clutters the diagram** with infrastructure concerns
- **Obscures domain relationships** (Status, Tags, Categories)
- **Creates visual noise** (100s of links to Files/Users)
- **Misrepresents the mental model** (photo is a property, not a domain relationship)

### Solution: Circuit Diagram Pattern
We treat system types like **components in a circuit diagram**:
- Domain entities are ICs (integrated circuits)
- System types are passive components (resistors, capacitors) shown as inline labels
- Domain relationships are wires connecting ICs

## Implementation Details

### Shared Constant
All system type logic uses the shared constant from `src/app/constants/system-types.ts`:
```typescript
export const METADATA_SYSTEM_TABLES = ['files', 'civic_os_users'] as const;
```

### Filtering Rules

**Schema Editor POC** (`schema-editor-poc.page.ts`):
1. **Entity Boxes**: System types filtered from `visibleEntities` computed signal
2. **Relationship Links**: FK/M:M links to system types skipped in `renderRelationships()`
3. **Auto-Layout**: System types excluded from Dagre graph nodes

**Schema Inspector Panel** (`schema-inspector-panel.component.ts`):
1. **Properties Tab**:
   - System type FKs shown with icons (📄 File, 👤 User)
   - Uses `isSystemTypeReference()` helper to detect
   - Uses `getSystemTypeInfo()` to map table name → icon + friendly name
2. **Relations Tab**:
   - System types filtered from `belongsToRelationships` computed
   - System types filtered from `hasManyRelationships` computed
   - System types filtered from `manyToManyRelationships` computed

### Visual Treatment

**Properties Tab Display**:
```html
@if (isSystemTypeReference(property)) {
  <span class="material-symbols-outlined {{ info.color }}">{{ info.icon }}</span>
  <span>{{ info.name }}</span>
}
```

**Example**:
- `photo_id` UUID → `files` becomes: **📄 File**
- `created_by` UUID → `civic_os_users` becomes: **👤 User**

## Edge Cases

### Metadata Table Selection
When a user clicks Files or Users entity box:
- **Properties Tab**: Hidden (metadata tables don't show properties)
- **Relations Tab**: Shows inverse relationships (which domain entities reference it)
- **Default Tab**: Switches to Relations tab automatically

### Adding New System Types
To add a new system type (e.g., `tags`):
1. Add to `METADATA_SYSTEM_TABLES` constant in `system-types.ts`
2. Add mapping to `getSystemTypeInfo()` in inspector panel
3. No changes needed elsewhere (filtering is automatic)

## Benefits

✅ **Cleaner diagrams**: Focuses attention on domain model
✅ **Reduced visual complexity**: ~50-70% fewer entity boxes and links
✅ **Better mental model**: Files/Users feel like types, not entities
✅ **Consistent UX**: Properties tab shows all field types uniformly
✅ **Maintainable**: Single source of truth (`METADATA_SYSTEM_TABLES`)

## Related Files

- `src/app/constants/system-types.ts` - Shared system types constant
- `src/app/pages/schema-editor-poc/schema-editor-poc.page.ts` - Diagram filtering
- `src/app/components/schema-inspector-panel/schema-inspector-panel.component.ts` - Inspector filtering
- `src/app/components/schema-inspector-panel/schema-inspector-panel.component.html` - Properties tab UI

## Future Considerations

- Could extend to other infrastructure tables (e.g., `audit_log`, `notifications`)
- Might need user toggle: "Show system types" checkbox
- Could apply same pattern to junction tables (show M:M as properties instead of entities)
