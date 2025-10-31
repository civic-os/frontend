# JointJS Troubleshooting: Lessons Learned

**Date**: 2025-10-30
**Context**: Schema Editor port-based routing investigation

## What Happened

Spent significant time investigating link routing issues, created a JointJS library patch, reproduction files, and submission guide - only to discover the solution was a simple configuration change: setting `magnet: true` on the body element.

## Critical Mistakes

1. **Assumed library bug before checking configuration**
   - Jumped to modifying library code instead of exhausting configuration options
   - Should have compared working vs non-working configurations first

2. **Never verified the patch was actually applied**
   - Created patch file, but never confirmed it was executing
   - The patch checked for `joint-port-body` class that never existed in our markup
   - Simple console.log in the patched function would have revealed this immediately

3. **Didn't read documentation thoroughly**
   - JointJS `magnet` property behavior on body vs ports likely documented
   - Should have searched for "magnet body port anchor" in JointJS docs/forums first

4. **Overcomplicated the solution**
   - Library patching is a last resort, not a first approach
   - Configuration changes are always preferable to code modification

## Better Approach for Next Time

### 1. Exhaust Configuration First (30-60 min)
- Try all relevant configuration options
- Read library documentation for the specific feature
- Search GitHub issues/Stack Overflow for similar problems
- Compare working examples to your code

### 2. Create Minimal Reproduction EARLY (15 min)
- Build simplest possible case that demonstrates the issue
- If it works in minimal case but not your app → **configuration difference**
- If it fails in minimal case → might actually be a library bug

### 3. Verify Assumptions with Logging
- If you think code isn't executing → add console.log to prove it
- If you think a value is wrong → log it and verify
- If you create a patch → add logging to confirm it's actually running

### 4. Check the Obvious First
```
Is the problem in:
☐ My configuration? (80% of issues)
☐ My understanding of the library? (15% of issues)
☐ The library itself? (5% of issues)
```

### 5. Debug Systematically
- What changed? (code, library version, configuration)
- What works? (reproduction, examples, other use cases)
- What's different? (compare configurations side-by-side)

## JointJS-Specific Tips

1. **Magnet Property Behavior**
   - `magnet: true` on body = use body bbox for anchor calculations
   - `magnet: true` on ports only = use tiny port bbox (causes edge detection issues)
   - **Both can be true** - JointJS intelligently picks the right one

2. **Port vs Anchor vs ConnectionPoint**
   - `port`: Visual element for connection (can be small)
   - `anchor`: Where link attaches to element (uses bbox for calculations)
   - `connectionPoint`: Where link visually intersects boundary
   - Don't confuse these three - they have different purposes

3. **Router vs Anchor Directions**
   - Anchors determine WHERE link connects
   - Router directions determine HOW path is calculated
   - Both must be configured correctly for desired routing

4. **Batching is Critical**
   - Always use `graph.startBatch()` / `graph.stopBatch()` for multiple operations
   - Prevents multiple router recalculations
   - Single most common cause of routing glitches

## The Actual Solution

```typescript
// In element attrs configuration:
attrs: {
  body: {
    magnet: true,  // ← This was the entire solution!
    // ... other attrs
  }
}
```

That's it. No library patching needed.

## Takeaway

**Configuration mistakes look like library bugs.** Always assume it's your configuration first, and only consider library modifications after exhausting all configuration options and creating minimal reproductions.
