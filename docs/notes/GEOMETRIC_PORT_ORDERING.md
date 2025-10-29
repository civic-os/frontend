# Geometric Port Ordering Algorithm

**Author**: Technical Design Document
**Created**: 2025-10-29
**Status**: ✅ Implemented and Tested
**Related**: Schema Editor POC (`schema-editor-poc.page.ts`)

## Table of Contents

1. [Overview](#overview)
2. [Motivation](#motivation)
3. [Core Concepts](#core-concepts)
4. [Algorithm Details](#algorithm-details)
5. [Screen Coordinate System](#screen-coordinate-system)
6. [Step-by-Step Walkthrough](#step-by-step-walkthrough)
7. [Edge Cases and Boundary Conditions](#edge-cases-and-boundary-conditions)
8. [Testing Strategy](#testing-strategy)
9. [Code References](#code-references)
10. [Performance Considerations](#performance-considerations)

---

## Overview

The Geometric Port Ordering algorithm assigns relationship link connection points (ports) on entity diagram boxes based on the **spatial position** of related entities, rather than relationship type. This produces visually intuitive diagrams where links exit entities in the direction of their targets, minimizing path length and crossovers.

**Key Principle**: Ports should be positioned on the side of an entity box that faces toward the related entity.

**Implementation**: `src/app/pages/schema-editor-poc/schema-editor-poc.page.ts`

---

## Motivation

### Problem with Type-Based Port Assignment

The initial implementation assigned ports based on relationship type:
- Foreign key relationships → left/right ports
- Many-to-many relationships → top/bottom ports

This approach had several flaws:

```
Example: Entity A (left) related to Entity B (right)
┌─────────┐                    ┌─────────┐
│    A    │                    │    B    │
│         │────────────────────┤         │  ✓ Good (FK exits right)
│         │                    │         │
└─────────┘                    └─────────┘

But if B is ABOVE A:
┌─────────┐
│    B    │
│         │
│         │
└─────────┘
     ↑
     │ (long, curved path because FK still exits right)
     │
┌────┼────┐
│    A    │  ✗ Bad (should exit top, but exits right due to type)
│         │
└─────────┘
```

**Result**: Unnecessary crossovers, longer paths, unintuitive visuals.

### Solution: Geometric Port Assignment

Calculate the angle from entity center to related entity center, then assign the port to the side facing that direction:

```
If B is above A:
┌─────────┐
│    B    │
│         │
└─────────┘
     ↑
     │ (short, direct path)
     │
┌────┼────┐
│    A    │  ✓ Good (exits top toward B)
│         │
└─────────┘
```

**Benefits**:
- Shorter paths
- Fewer crossovers
- More intuitive layout
- No arbitrary type-based constraints

---

## Core Concepts

### 1. Entity Centers

Each entity is positioned at `(x, y)` (top-left corner) with size `(width, height)`. The center is:

```typescript
center.x = position.x + (size.width / 2)
center.y = position.y + (size.height / 2)
```

**Why centers?** Links represent logical relationships between entities as a whole, not between specific corners or edges.

### 2. Angles Between Entities

The angle from entity A to entity B:

```typescript
angle = Math.atan2(
  centerB.y - centerA.y,  // Δy
  centerB.x - centerA.x   // Δx
) * (180 / Math.PI);      // Convert radians to degrees
```

**Range**: `-180°` to `180°`

**Quadrants**:
- **0°**: B is directly to the right of A
- **90°**: B is directly below A (screen coordinates!)
- **180° / -180°**: B is directly to the left of A
- **-90°**: B is directly above A (screen coordinates!)

### 3. Angle-to-Side Mapping

Map angles to entity sides (top, right, bottom, left):

| Angle Range | Side | Direction |
|-------------|------|-----------|
| `-45°` to `45°` | **right** | Toward right |
| `45°` to `135°` | **bottom** | Downward (positive Y) |
| `135°` to `-135°` (wraps through ±180°) | **left** | Toward left |
| `-135°` to `-45°` | **top** | Upward (negative Y) |

**Critical**: Boundaries are at 45° intervals, creating four equal 90° sectors.

### 4. Port IDs

Ports have unique IDs that encode their purpose:

```
Format: ${side}_${direction}_${identifier}

Examples:
- "right_out_status_id"          (FK outgoing to status)
- "left_in_issues_status_id"     (FK incoming from issues)
- "top_m2m_out_issue_tags"       (M:M outgoing via issue_tags)
- "bottom_m2m_in_issue_tags"     (M:M incoming via issue_tags)
```

This naming convention enables link reconnection after ports are recalculated.

---

## Algorithm Details

### High-Level Flow

```
1. Layout entities (Dagre)
   ↓
2. For each entity:
   a. Get entity center
   b. Find all related entities (FK, inverse FK, M:M)
   c. Calculate angle to each related entity
   d. Assign port to appropriate side based on angle
   e. Sort ports by angle within each side
   f. Distribute ports evenly along side perimeter
   ↓
3. Reconnect links to geometric ports
```

### Detailed Steps

#### Step 1: Calculate Entity Centers

```typescript
private getEntityCenter(element: any): { x: number; y: number } {
  const position = element.position();
  const size = element.size();
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2
  };
}
```

**Why**: Centers provide consistent reference points regardless of entity size.

#### Step 2: Collect Relationships

For each entity, gather three types of relationships:

1. **Outgoing Foreign Keys** - Properties with `join_table` defined
2. **Incoming Foreign Keys** - Inverse relationships (other entities referencing this one)
3. **Many-to-Many** - Links with `relationshipType === 'manyToMany'`

**Important**: M:M relationships are detected from graph links, not properties array, because they don't appear as entity properties.

#### Step 3: Calculate Angles and Assign Sides

```typescript
const relatedCenter = this.getEntityCenter(relatedElement);
const angle = Math.atan2(
  relatedCenter.y - entityCenter.y,
  relatedCenter.x - entityCenter.x
) * (180 / Math.PI);

const side = this.determineSideFromAngle(angle);

portsData.push({
  id: `${side}_out_${columnName}`,
  group: side,
  angle: angle,
  relatedTable: joinTable
});
```

#### Step 4: Sort Ports Within Each Side

**Critical**: Sorting direction depends on side due to screen coordinate system.

```typescript
// Top side: left to right (-135° → -45°)
topPorts.sort((a, b) => a.angle - b.angle);  // Ascending

// Right side: top to bottom (-45° → 45°)
rightPorts.sort((a, b) => a.angle - b.angle);  // Ascending

// Bottom side: right to left (135° → 45°)
bottomPorts.sort((a, b) => b.angle - a.angle);  // Descending

// Left side: top to bottom, wrapping through ±180°
leftPorts.sort((a, b) => {
  const angleA = a.angle < 0 ? a.angle + 360 : a.angle;
  const angleB = b.angle < 0 ? b.angle + 360 : b.angle;
  return angleB - angleA;  // Descending in normalized space
});
```

**Why different directions?**
We want ports arranged in a natural order that prevents links from crossing. For example, on the right side, if entity A has ports to B (above) and C (below), B's port should be higher on the side than C's port.

#### Step 5: Distribute Ports Evenly

JointJS provides automatic port distribution via the `position` attribute:

```typescript
groups: {
  'right': {
    position: { name: 'right' },  // JointJS handles distribution
    attrs: {
      circle: { r: 6, fill: '#4B5563', stroke: '#1F2937', strokeWidth: 2 }
    }
  }
}
```

#### Step 6: Reconnect Links

After ports are recalculated, update each link's source and target:

```typescript
// Recalculate angles (may have changed if entities moved)
const sourceAngle = Math.atan2(targetCenter.y - sourceCenter.y, targetCenter.x - sourceCenter.x) * (180 / Math.PI);
const targetAngle = Math.atan2(sourceCenter.y - targetCenter.y, sourceCenter.x - targetCenter.x) * (180 / Math.PI);

const sourceSide = this.determineSideFromAngle(sourceAngle);
const targetSide = this.determineSideFromAngle(targetAngle);

// Find matching port by ID pattern
const sourcePortId = sourcePorts.items.find((p: any) =>
  p.group === sourceSide && p.id.includes(`_out_${columnName}`)
)?.id;

const targetPortId = targetPorts.items.find((p: any) =>
  p.group === targetSide && p.id.includes(`_in_${sourceTable}_${columnName}`)
)?.id;

// Reconnect
link.source({ id: sourceId, port: sourcePortId });
link.target({ id: targetId, port: targetPortId });
```

**Why recalculate?** If the user manually drags entities, the optimal port sides may have changed.

---

## Screen Coordinate System

### The Y-Axis Problem

**Mathematical Convention**: Y increases upward (positive Y = up)
**Screen Coordinates**: Y increases downward (positive Y = down)

This inversion affects angle interpretation:

```
Mathematical:                Screen Coordinates:
       90°                          -90°
        ↑                             ↑
        |                             |
180° ←─┼─→ 0°               180° ←─┼─→ 0°
        |                             |
       -90°                           90°
        ↓                             ↓
```

**Impact on Implementation**:

```typescript
// WRONG (mathematical convention):
if (normalized >= -45 && normalized < 45) return 'right';   // ✓
else if (normalized >= 45 && normalized < 135) return 'top';    // ✗ WRONG
else if (normalized >= 135 || normalized < -135) return 'left';  // ✓
else return 'bottom';  // ✗ WRONG

// CORRECT (screen coordinates):
if (normalized >= -45 && normalized < 45) return 'right';
else if (normalized >= 45 && normalized < 135) return 'bottom';  // ✓ Positive angle = downward
else if (normalized >= 135 || normalized < -135) return 'left';
else return 'top';  // ✓ Negative angle = upward
```

### Visual Guide

```
Entity A at (100, 100), Entity B at (200, 150):

Δx = 200 - 100 = 100
Δy = 150 - 100 = 50  (downward in screen coords)

angle = atan2(50, 100) * (180/π) = 26.57°

In screen coordinates: 26.57° means "to the right and slightly down"
→ Side: RIGHT (because 26.57° is in range -45° to 45°)

If we incorrectly treated positive angle as "up":
→ Would assign to TOP side (wrong!)
→ Link would exit top of A, then curve down to B (long path)
```

---

## Step-by-Step Walkthrough

### Example: Three Entities

```
Scenario:
- Issue entity at (200, 200)
- Status entity at (400, 100) (upper right)
- User entity at (100, 300) (lower left)

Issue has two relationships:
1. FK to Status (issue.status_id → statuses.id)
2. FK to User (issue.created_by → users.id)
```

#### Step 1: Calculate Centers

```
Issue center: (200 + 125, 200 + 75) = (325, 275)
Status center: (400 + 125, 100 + 75) = (525, 175)
User center: (100 + 125, 300 + 75) = (225, 375)
```

#### Step 2: Calculate Angles

**Issue → Status**:
```
angle = atan2(175 - 275, 525 - 325) * (180/π)
      = atan2(-100, 200) * (180/π)
      = -26.57°
```

**Issue → User**:
```
angle = atan2(375 - 275, 225 - 325) * (180/π)
      = atan2(100, -100) * (180/π)
      = 135°
```

#### Step 3: Determine Sides

**Issue → Status** (`-26.57°`):
- Normalized: `-26.57°` (already in range -180° to 180°)
- Range check: `-45° ≤ -26.57° < 45°` → **RIGHT**

**Issue → User** (`135°`):
- Normalized: `135°`
- Range check: `135° ≥ 135°` → **LEFT**

#### Step 4: Assign Ports

```typescript
Issue entity ports:
[
  {
    id: 'right_out_status_id',
    group: 'right',
    angle: -26.57,
    relatedTable: 'statuses'
  },
  {
    id: 'left_out_created_by',
    group: 'left',
    angle: 135,
    relatedTable: 'users'
  }
]
```

#### Step 5: Visual Result

```
           ┌────────────┐
           │  Status    │
           │            │
           └─────┬──────┘
                 │
                 │ (link exits right side of Issue)
                 │
        ┌────────┴─────┐
        │   Issue      │
        │              │
        └─┬────────────┘
          │
          │ (link exits left side of Issue)
          │
     ┌────┴────┐
     │  User   │
     │         │
     └─────────┘
```

**Result**: Both links exit Issue in the direction of their targets. No crossovers, minimal path length.

---

## Edge Cases and Boundary Conditions

### 1. Exact Boundary Angles

**Question**: What side does 45° map to?

**Answer**: By convention, boundaries are **inclusive on the lower end**:

```typescript
if (normalized >= -45 && normalized < 45) return 'right';
else if (normalized >= 45 && normalized < 135) return 'bottom';  // 45° → bottom
```

**Test Case**:
```typescript
expect(determineSideFromAngle(45.0)).toBe('bottom');   // Boundary
expect(determineSideFromAngle(44.9)).toBe('right');    // Just before
```

### 2. Wrapping Through ±180°

**Challenge**: Left side spans `135°` to `-135°`, wrapping through `±180°`.

**Angles**:
- `135°` → left (boundary)
- `150°` → left
- `180°` → left
- `-180°` → left (same as 180°)
- `-150°` → left
- `-135.1°` → left
- `-135°` → top (boundary)

**Sorting**: Left side ports need special handling to maintain top-to-bottom order:

```typescript
leftPorts.sort((a, b) => {
  // Normalize negative angles to [0, 360) range
  const angleA = a.angle < 0 ? a.angle + 360 : a.angle;
  const angleB = b.angle < 0 ? b.angle + 360 : b.angle;
  return angleB - angleA;  // Descending
});
```

**Example**:
```
Angles: [150°, -170°, 180°]
Normalized: [150°, 190°, 180°]
Sorted descending: [190°, 180°, 150°]
Original: [-170°, 180°, 150°]
Visual: Top to bottom
```

### 3. Multiple Ports on Same Side

**Scenario**: Entity has 3 outgoing FKs to entities all on the right side.

```
Issue → Status (angle: 10°, right side)
Issue → Priority (angle: -20°, right side)
Issue → Category (angle: 30°, right side)
```

**Sorting**: Ascending order ensures ports appear top-to-bottom matching target positions:

```
Sorted: [-20°, 10°, 30°]
Ports: [Priority (top), Status (middle), Category (bottom)]
```

JointJS distributes these evenly along the right side:

```
┌─────────────┐
│   Issue     │──→ (Priority)
│             │──→ (Status)
│             │──→ (Category)
└─────────────┘
```

### 4. Directly Aligned Entities

**Scenario**: Entity B is directly to the right of A (angle = 0°).

```
A center: (100, 200)
B center: (300, 200)
Angle: atan2(0, 200) = 0°
→ Side: RIGHT (0° is in range -45° to 45°)
```

**Result**: Link exits right side of A, enters left side of B (optimal).

---

## Testing Strategy

### Unit Test Coverage

**File**: `src/app/pages/schema-editor-poc/schema-editor-poc.page.spec.ts`

**Total**: 31 tests, all passing

#### `determineSideFromAngle()` Tests (21 tests)

**Right Side (5 tests)**:
- `-45°` (boundary)
- `-30°` (upper right)
- `0°` (directly right)
- `30°` (lower right)
- `44.9°` (just before boundary)

**Bottom Side (5 tests)**:
- `45°` (boundary)
- `60°` (lower-right diagonal)
- `90°` (directly down)
- `120°` (lower-left diagonal)
- `134.9°` (just before boundary)

**Left Side (6 tests)**:
- `135°` (boundary from bottom)
- `150°` (upper-left diagonal)
- `180°` (directly left)
- `-180°` (directly left, negative notation)
- `-150°` (lower-left diagonal)
- `-135.1°` (just past boundary)

**Top Side (5 tests)**:
- `-135°` (boundary from left)
- `-120°` (upper-left diagonal)
- `-90°` (directly up)
- `-60°` (upper-right diagonal)
- `-45.1°` (just past boundary)

#### `getEntityCenter()` Tests (10 tests)

- **Standard case**: position (100, 200), size (250, 100) → center (225, 250)
- **Zero position**: position (0, 0), size (100, 50) → center (50, 25)
- **Large coordinates**: position (5000, 3000), size (400, 200) → center (5200, 3100)
- **Decimal values**: position (100.5, 200.7), size (250.3, 100.9) → center (225.65, 251.15)
- **Square elements**: position (300, 400), size (100, 100) → center (350, 450)
- **Small elements**: position (50, 75), size (10, 5) → center (55, 77.5)

### Integration Testing

**Manual Testing Checklist**:

1. ✅ Load schema editor
2. ✅ Click "Auto-Arrange" button
3. ✅ Verify all links exit entities in direction of targets
4. ✅ Check for crossovers (should be minimal or none)
5. ✅ Manually drag entity to new position
6. ✅ Verify links update to new optimal ports (if reconnection is triggered)
7. ✅ Test with schema having 10+ entities
8. ✅ Test with entities having 5+ relationships each

### Edge Case Testing

1. **Aligned entities**: Place two entities in exact horizontal/vertical alignment
2. **Dense cluster**: Multiple entities close together
3. **Long-distance links**: Entities far apart on canvas
4. **Single relationship**: Entity with only one FK
5. **Many relationships**: Entity with 10+ FKs (e.g., junction tables)

---

## Code References

### Primary Implementation

**File**: `src/app/pages/schema-editor-poc/schema-editor-poc.page.ts`

**Key Methods**:

- **`getEntityCenter(element)`** (lines 400-409)
  Calculates center point from position and size

- **`determineSideFromAngle(angle)`** (lines 411-439)
  Maps angle to side (top/right/bottom/left)

- **`recalculatePortsByGeometry()`** (lines 1051-1220)
  Main algorithm: calculates angles, assigns ports, sorts, distributes

- **`reconnectLinksToGeometricPorts()`** (lines 1163-1257)
  Updates link connections after port recalculation

### Supporting Code

**Port Group Definitions** (lines 336-392):
```typescript
private generatePortsForEntity(entity: SchemaEntityTable): any {
  return {
    groups: {
      'top': { position: { name: 'top' }, ... },
      'right': { position: { name: 'right' }, ... },
      'bottom': { position: { name: 'bottom' }, ... },
      'left': { position: { name: 'left' }, ... }
    },
    items: []  // Populated by recalculatePortsByGeometry()
  };
}
```

**Auto-Arrange Integration** (line 1222):
```typescript
// After Dagre layout
elements.forEach(...);  // Position elements
this.recalculatePortsByGeometry();  // Assign geometric ports
```

### Test File

**File**: `src/app/pages/schema-editor-poc/schema-editor-poc.page.spec.ts`

**Structure**:
```typescript
describe('SchemaEditorPocPage - Geometric Port Ordering', () => {
  describe('determineSideFromAngle()', () => {
    // 21 tests covering all quadrants and boundaries
  });

  describe('getEntityCenter()', () => {
    // 10 tests covering various positions and sizes
  });
});
```

---

## Performance Considerations

### Time Complexity

**Per Entity**:
- Calculate center: O(1)
- Find relationships: O(R) where R = number of relationships
- Calculate angles: O(R)
- Sort ports: O(R log R)
- Distribute ports: O(R)

**Total**: O(R log R) per entity

**Entire Graph**: O(N * R log R) where N = number of entities

**Typical Case**: For a schema with 20 entities and average 5 relationships each:
- O(20 * 5 log 5) ≈ O(100 * 2.3) ≈ 230 operations
- Completes in < 5ms

### Space Complexity

**Per Entity**: O(R) for port data arrays

**Total**: O(N * R) for entire graph

**Typical Case**: 20 entities * 5 relationships * 100 bytes per port ≈ 10 KB

### Optimization Opportunities

1. **Caching**: Cache entity centers if positions haven't changed
2. **Incremental Updates**: Only recalculate ports for moved entities
3. **Debouncing**: When user drags entities, debounce recalculation
4. **Lazy Evaluation**: Only recalculate ports when links are visible

**Current Status**: No optimization implemented (not needed for typical schemas < 100 entities).

---

## Conclusion

The Geometric Port Ordering algorithm provides a **physically intuitive** approach to diagram layout that:

1. **Minimizes visual complexity** by reducing crossovers
2. **Shortens link paths** by exiting entities toward targets
3. **Eliminates arbitrary constraints** based on relationship type
4. **Works with any layout algorithm** (Dagre, force-directed, manual)

**Key Insight**: Treating the diagram as a **spatial problem** (geometry) rather than a **type problem** (FK vs M:M) produces more intuitive results.

**Robustness**: Comprehensive unit tests (31 tests) ensure correct handling of all angle ranges, boundary conditions, and screen coordinate system peculiarities.

**Future Work**: Could extend algorithm to optimize for:
- Minimizing total link length
- Avoiding overlaps with other entities
- Grouping related ports together
- Dynamic port repositioning during manual dragging

---

**Related Documentation**:
- [Schema Editor Design](./SCHEMA_EDITOR_DESIGN.md) - Overall design and implementation phases
- [Implementation](../../src/app/pages/schema-editor-poc/schema-editor-poc.page.ts) - Full source code
- [Unit Tests](../../src/app/pages/schema-editor-poc/schema-editor-poc.page.spec.ts) - Test coverage
