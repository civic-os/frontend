# JointJS Integration Guide

This document provides a comprehensive guide to integrating JointJS (MIT-licensed diagramming library) into Angular applications for building visual editors and interactive diagrams.

## Reference Implementation

**Schema Editor** (`/schema-editor`) - Demonstrates best practices for JointJS integration in Angular. This implementation is accessible to all users (anonymous and authenticated) and serves as a reference for building visual diagramming features.

## Key Integration Patterns

### 1. JointJS Initialization

**Location**: `schema-editor.page.ts:298-334`

Initialize graph and paper in `ngAfterViewInit()`:

```typescript
this.graph = new dia.Graph({}, { cellNamespace: shapes });
this.paper = new dia.Paper({
  el: this.canvasContainer.nativeElement,
  model: this.graph,
  interactive: { linkMove: false },
  cellViewNamespace: shapes
});
```

**Best Practices**:
- Store graph/paper references as component properties
- Clean up in `ngOnDestroy()` to prevent memory leaks

### 2. Geometric Port Ordering

**Service**: `GeometricPortCalculatorService`

**Problem**: Type-based port assignment (FK→left/right, M:M→top/bottom) caused crossovers

**Solution**: Angle-based geometric algorithm that assigns ports based on spatial relationships

**Architecture**:
- Pure geometric calculations extracted to service for testability and reusability
- **Algorithm**: Calculate angle between entity centers using `Math.atan2()`, map to sides (top/right/bottom/left), sort by angle within each side
- **Screen Coordinates**: Account for Y-axis inversion (positive Y = downward in screen coords)
- **Benefits**: Shorter paths, fewer crossovers, more intuitive layout

**Testing**: 46 comprehensive unit tests in `geometric-port-calculator.service.spec.ts` validate all geometry functions

**TypeScript Interfaces**: Dedicated types in `schema-diagram.interface.ts`:
- `Point` - X/Y coordinates
- `Size` - Width/height dimensions
- `Side` - Top/right/bottom/left enumeration
- `PortData` - Port metadata with positions
- `PortConfiguration` - Complete port configuration

### 3. Port-Based Routing with Body Magnet

**Location**: `schema-editor.page.ts:508`

**Challenge**: Perpendicular anchors with small ports (2×20px) can cause incorrect edge detection

**Solution**: Set `magnet: true` on the **body** element, not just the ports

```typescript
attrs: {
  body: {
    magnet: true  // Enable body as magnet for better edge detection
  }
}
```

**Why it works**: JointJS intelligently uses the body element's bbox (250×100px) for anchor edge detection when both body and ports have magnet enabled

**Benefit**: No library patching required, clean configuration-based solution

### 4. Link Routing Stability - Batching Pattern

**Location**: `schema-editor.page.ts`

**Critical Rule**: Always batch related graph operations to prevent router recalculation race conditions

**Pattern**:
```typescript
this.graph.startBatch('name');
/* operations */
this.graph.stopBatch('name');
```

**Explicit Recalculation**: Metro router doesn't auto-recalculate on visual changes - call `link.router(router)` explicitly

**Use Cases**:
- Highlight/unhighlight operations
- Port reconnection
- Bulk updates

**Helper Methods**: Duplicated logic extracted to:
- `updateLinkRouterFromGeometry()` - Updates router based on spatial relationships
- `applyLinkVisualStyle()` - Applies visual styling

**Example**:
```typescript
this.graph.startBatch('highlight');

// Clear all existing highlights
this.graph.getElements().forEach(el => el.attr('body/stroke', normalColor));

// Apply new highlights and update router directions
connectedLinks.forEach(link => {
  this.updateLinkRouterFromGeometry(link);  // Updates router based on spatial relationships
  this.applyLinkVisualStyle(link, 3, colors.primary);  // Applies visual styling
});

this.graph.stopBatch('highlight');  // Router recalculates once after batch
```

### 5. Metro Router Configuration

**Location**: `schema-editor.page.ts:585-655`

```typescript
router: {
  name: 'metro',  // Allows diagonal segments for natural routing
  args: {
    maximumLoops: 2000,
    maxAllowedDirectionChange: 90,  // Only right-angle turns
    startDirections: ['left', 'right', 'top', 'bottom'],
    endDirections: ['left', 'right', 'top', 'bottom']
  }
}
```

**Port-Based Routing**: Links use `port` for connection + `anchor: { name: 'perpendicular' }` for edge attachment

**Why Metro over Manhattan**: Metro handles small port bboxes better with diagonal segments

### 6. Auto-Layout Integration

**Location**: `schema-editor.page.ts:1039-1222`

Use Dagre hierarchical layout algorithm for automatic positioning:

**Pattern**:
```
layout → recalculatePortsByGeometry() → reconnectLinksToGeometricPorts()
```

This ensures ports are correctly positioned after layout completes.

### 7. Theme Integration

**Location**: `schema-editor.page.ts:270-296`

Use DaisyUI CSS variables for theme-aware styling:
- `var(--base-100)` - Base background color
- `var(--primary)` - Primary accent color
- Automatically adapts to light/dark theme changes

**Pattern**: Matches `GeoPointMapComponent` theme handling approach

### 8. System Types as Property Types

**Constants**: `src/app/constants/system-types.ts`

**Design Decision**: Metadata tables (Files, Users) are:
- Filtered from diagram as entity boxes
- Shown instead as property types with icons in inspector Properties tab (📄 File, 👤 User)

**Benefits**:
- Reduces visual clutter by 50-70%
- Focuses on domain relationships
- **Namespace-safe**: `isSystemType()` function handles schema-qualified names to prevent collisions

**Rationale**: See `docs/notes/SYSTEM_TYPES_AS_PROPERTY_TYPES.md` for architectural decision

### 9. Inspector Panel Integration

**Components**: `components/schema-inspector-panel/`

**Tabs**:
- **Properties Tab**: Shows all columns with type badges, visibility flags, system type special rendering
- **Relations Tab**: Shows belongs_to, has_many, and many_to_many relationships (filtered by system types)
- **Validations Tab**: Displays validation rules with human-readable descriptions and icons

**Navigation**: Click relationship chip to navigate to related entity

## When to Use This Pattern

- Building visual editors (workflow designers, state machines, data flows)
- Creating interactive diagrams (network topology, org charts)
- Schema visualization and manipulation
- Any feature requiring draggable, connectable visual elements

## Documentation

### Design & Implementation
- **Design**: `docs/notes/SCHEMA_EDITOR_DESIGN.md` - Complete implementation plan (Phase 1-4)
- **Algorithm**: `docs/notes/GEOMETRIC_PORT_ORDERING.md` - Detailed geometric port ordering explanation
- **Routing**: `docs/notes/SCHEMA_EDITOR_ROUTING_STABILITY.md` - Link routing fixes and batching patterns

### Troubleshooting
- **Troubleshooting**: `docs/notes/JOINTJS_TROUBLESHOOTING_LESSONS.md` - **Read this first** when debugging JointJS issues

### Code & Tests
- **Code**: `src/app/pages/schema-editor/schema-editor.page.ts`
- **Tests**: `src/app/pages/schema-editor/schema-editor.page.spec.ts` (51 passing tests)

## JointJS Resources

- **License**: MIT License (Compatible with AGPL-3.0-or-later)
- **Documentation**: https://resources.jointjs.com/docs/jointjs
- **Examples**: https://www.jointjs.com/demos/er-diagrams (ER diagram example)
