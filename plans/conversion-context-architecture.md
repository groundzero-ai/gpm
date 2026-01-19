# Conversion Context Architecture - Implementation Plan

## Executive Summary

This document outlines the implementation plan for fixing the conditional flow bug by introducing a robust **PackageConversionContext** architecture. This replaces the fragile approach of storing `sourcePlatform` in `_format` with an explicit, immutable context object that threads through the entire conversion pipeline.

**Problem**: Conditional flows in `claude-plugin` imports (e.g., `"when": { "$eq": ["$$platform", "claude"] }`) are not respected because the target platform information is lost during conversion.

**Root Cause**: Package format metadata is stored in mutable `_format` field, which doesn't survive temp directory serialization and requires manual propagation through multiple stages.

**Solution**: Introduce `PackageConversionContext` as a first-class concept that explicitly tracks original format (immutable) and current state (mutable) through the entire pipeline.

---

## Core Architecture

### New Type: PackageConversionContext

```typescript
interface PackageConversionContext {
  // Identity (immutable once set)
  readonly originalFormat: FormatIdentity;
  
  // Current state (mutable)
  currentFormat: FormatState;
  
  // Conversion history (audit trail)
  conversionHistory: ConversionRecord[];
  
  // Current operation target
  targetPlatform?: Platform;
}

interface FormatIdentity {
  readonly type: 'universal' | 'platform-specific';
  readonly platform?: Platform;
  readonly detectedAt: Date;
  readonly confidence: number;
}

interface FormatState {
  type: 'universal' | 'platform-specific';
  platform?: Platform;
}

interface ConversionRecord {
  from: FormatState;
  to: FormatState;
  targetPlatform: Platform;
  timestamp: Date;
}
```

### Design Principles

1. **Separate Identity from State**
   - `originalFormat` = What the package originally was (immutable)
   - `currentFormat` = What format it's currently in (mutable)

2. **Explicit Context Threading**
   - Context passed explicitly as parameter to all relevant functions
   - No hiding critical information in mutable structures

3. **Single Source of Truth**
   - `originalFormat.platform` is the canonical source for `$$source` variable
   - No fallback chains or guessing

4. **Fail Fast with Validation**
   - Validate context at creation and transitions
   - Detect inconsistencies immediately

5. **Audit Trail**
   - Track complete conversion history
   - Debug exactly what happened and when

---

## Implementation Phases

### Phase 1: Type Definitions and Core Infrastructure

**Goal**: Introduce new types without breaking existing code.

**Tasks**:
1. Create `src/types/conversion-context.ts` with all new type definitions
2. Export from `src/types/index.ts`
3. Create `src/core/conversion-context/` directory for utilities:
   - `creation.ts` - Functions to create context from packages
   - `validation.ts` - Functions to validate context integrity
   - `serialization.ts` - JSON serialization/deserialization
   - `history.ts` - Utilities for working with conversion history

**Deliverables**:
- Type definitions with full JSDoc
- Unit tests for serialization/deserialization
- Validation function tests

**Breaking Changes**: None (additive only)

---

### Phase 2: Context Creation at Entry Points

**Goal**: Create context alongside packages at detection/loading time.

**Tasks**:
1. Update `plugin-transformer.ts`:
   - Change `transformPluginToPackage()` return type to include context
   - Create context with `originalFormat.platform = 'claude-plugin'`

2. Update `format-detector.ts`:
   - Add function `detectPackageFormatWithContext()` that returns both format and context
   - Keep existing `detectPackageFormat()` for backward compatibility

3. Update `flow-based-installer.ts`:
   - Modify `detectPackageFormatFromDirectory()` to create context
   - Store context alongside format detection

4. Update all package loaders:
   - Git source loader
   - Path source loader
   - Registry source loader
   - Each should create context when loading package

**Deliverables**:
- All entry points create `PackageConversionContext`
- Tests verify context creation
- Context fields correctly populated

**Breaking Changes**: None (new return types are additive, old functions still work)

---

### Phase 3: Thread Context Through Conversion Pipeline

**Goal**: Pass context explicitly through all conversion-related functions.

**Tasks**:
1. Update `PlatformConverter`:
   - Add `context` parameter to `convert()`
   - Return `{ convertedPackage, updatedContext }` instead of just result
   - Update `executeStage()` to use context for flow variables
   - Update `executePipeline()` to track conversion history

2. Update `ConversionInstallStrategy`:
   - Accept context parameter
   - Pass context to `PlatformConverter.convert()`
   - Thread updated context through to `FlowBasedInstallStrategy`

3. Update `FlowBasedInstallStrategy`:
   - Add optional `context` parameter
   - Use context in `buildFlowContext()` if available
   - Fall back to old behavior if context not provided

4. Update `BaseStrategy`:
   - Modify `buildFlowContext()` to accept optional context
   - Use `context.originalFormat.platform` for `$$source` variable
   - Use `context.targetPlatform` for `$$platform` variable

**Deliverables**:
- Context threaded through entire conversion pipeline
- Flow variables correctly populated from context
- Tests verify context updates during conversion

**Breaking Changes**: None (context is optional parameter)

---

### Phase 4: Temp Directory Persistence

**Goal**: Serialize context when writing to temp directories, deserialize when reading.

**Tasks**:
1. Create temp directory utilities:
   - `writeTempPackageWithContext()` - Write files + context
   - `readTempPackageWithContext()` - Read files + context
   - Context stored in `.opkg-conversion-context.json`

2. Update `ConversionInstallStrategy`:
   - Use new utilities in `installConvertedPackage()`
   - Serialize context before writing to temp
   - Deserialize context after reading from temp

3. Add validation:
   - Verify context matches package after deserialization
   - Detect corruption or tampering

**Deliverables**:
- Context survives temp directory round-trip
- Integration tests verify persistence
- Validation catches mismatches

**Breaking Changes**: None (temp directory is internal implementation detail)

---

### Phase 5: Update FlowInstallContext

**Goal**: Make context a first-class part of install context.

**Tasks**:
1. Update `FlowInstallContext` type:
   - Add `conversionContext?: PackageConversionContext` field
   - Document when it should be provided

2. Update `installPackageByIndexWithFlows()`:
   - Create or receive context at function entry
   - Pass context to `installPackageWithFlows()`

3. Update all strategy selectors:
   - Pass context to selected strategy
   - Ensure context is available for conditional logic

**Deliverables**:
- `FlowInstallContext` includes conversion context
- All install paths have context available
- Tests verify context presence

**Breaking Changes**: Minimal (new optional field)

---

### Phase 6: Validation and Error Handling

**Goal**: Add comprehensive validation at all transition points.

**Tasks**:
1. Create validation functions:
   - `validateContextMatchesPackage()` - Verify context and package agree
   - `validateContextTransition()` - Verify conversion updates are valid
   - `validateContextHistory()` - Verify history is internally consistent

2. Add validation calls:
   - After context creation
   - Before/after conversion
   - After deserialization from temp directory

3. Improve error messages:
   - Include context state in error messages
   - Show conversion history in debug logs
   - Provide actionable suggestions

**Deliverables**:
- Validation catches all context inconsistencies
- Clear error messages with context
- Tests for all validation scenarios

**Breaking Changes**: None (validation only)

---

### Phase 7: Migration of Existing Code

**Goal**: Make context required and remove old fallback chains.

**Tasks**:
1. Make `conversionContext` required in `FlowInstallContext`
2. Remove fallback chains in `buildFlowContext()`
3. Remove `sourcePlatform` from `PackageFormat._format`
4. Update all call sites to provide context
5. Remove old backward-compatibility shims

**Deliverables**:
- Context is required throughout pipeline
- No fallback chains remain
- All tests pass with new architecture

**Breaking Changes**: Yes (context now required)

**Migration Guide Required**: Document changes for external consumers

---

### Phase 9: Legacy Code Removal and Cleanup

**Goal**: Remove all legacy, unused, dead, and dangling code related to old conversion approach.

**Tasks**:

1. **Remove legacy format tracking in Package type**:
   - Remove `sourcePlatform` field from `PackageFormat` type (if not used elsewhere)
   - Remove `_format` field from `Package` type if fully replaced by context
   - Clean up any references to these fields

2. **Remove legacy option parameters**:
   - Remove `sourcePlatform` from `ConversionOptions` (replaced by context)
   - Remove any other conversion-related options that are now in context
   - Clean up option interfaces

3. **Remove fallback helper functions**:
   - Identify and remove helper functions that were only for fallback chains
   - Remove `detectPackageFormatFromDirectory()` if replaced
   - Remove any "getOrDefault" style helpers for source platform

4. **Remove legacy context building logic**:
   - Remove old `buildFlowContext()` implementations that don't use context
   - Remove conditional branches that check for missing context
   - Remove any "compatibility mode" code paths

5. **Clean up temporary migration code**:
   - Remove `createContextFromPackage()` if no longer needed
   - Remove validation shims that were only for migration
   - Remove any "TODO: remove after migration" comments and their code

6. **Remove unused temp directory helpers**:
   - Remove old `writeTempPackageFiles()` if replaced by `writeTempPackageWithContext()`
   - Remove old `readTempPackage()` if replaced by `readTempPackageWithContext()`
   - Clean up any duplicate helper functions

7. **Remove deprecated strategy code**:
   - Check `ConversionInstallStrategy` for any old conversion logic
   - Remove any commented-out code from refactoring
   - Clean up any "legacy mode" branches

8. **Clean up imports and exports**:
   - Remove unused type exports related to old approach
   - Remove unused imports in files that were refactored
   - Update barrel exports (`index.ts` files) to remove old APIs

9. **Remove dead error handling**:
   - Remove error types that are no longer thrown
   - Remove error messages that reference old concepts
   - Clean up error handling for removed code paths

10. **Update or remove obsolete tests**:
    - Remove tests that test removed functionality
    - Update tests that reference removed concepts
    - Remove test helpers that are no longer used

11. **Audit and remove dead utility functions**:
    - Search for functions with no references
    - Remove utilities that were only for old approach
    - Document why removed in cleanup PR

12. **Clean up type definitions**:
    - Remove unused interfaces related to old conversion
    - Remove type aliases that are no longer referenced
    - Clean up generic parameters that are now unnecessary

**Specific Files to Audit for Removal**:
- `src/core/flows/platform-converter.ts` - Check for old conversion logic
- `src/core/install/strategies/base-strategy.ts` - Remove old buildFlowContext
- `src/core/install/strategies/conversion-strategy.ts` - Clean up old options
- `src/core/install/format-detector.ts` - Remove sourcePlatform if unused
- `src/types/index.ts` - Remove old type exports
- `src/utils/` - Audit all helpers for dead code

**Verification Checklist**:
- [ ] No references to `_format.sourcePlatform` remain (search codebase)
- [ ] No references to old `ConversionOptions.sourcePlatform` remain
- [ ] No fallback chains like `|| currentPackage._format?.sourcePlatform` remain
- [ ] No conditional branches checking for missing context remain
- [ ] All temporary "createContextFromPackage" calls removed
- [ ] TypeScript compiles with no errors
- [ ] All tests pass
- [ ] No unreachable code warnings
- [ ] No unused variable warnings
- [ ] No unused import warnings
- [ ] Run dead code elimination tool (e.g., `ts-prune`)
- [ ] Code coverage shows no uncovered legacy branches

**Tools to Use**:
```bash
# Find unused exports
npx ts-prune

# Find unused code
npx eslint . --rule 'no-unused-vars: error'

# Search for specific legacy patterns
grep -r "sourcePlatform" src/
grep -r "_format" src/
grep -r "createContextFromPackage" src/
grep -r "TODO.*migration" src/
grep -r "DEPRECATED" src/
grep -r "LEGACY" src/

# Check for commented-out code
grep -r "^[[:space:]]*//" src/ | grep -v "///"
```

**Deliverables**:
- Zero references to removed legacy concepts
- Clean, focused codebase with no dead code
- Updated type definitions with no unused types
- All tests passing
- Dead code analysis tool output showing no issues
- Documentation of what was removed and why

**Breaking Changes**: None (only removing unused code)

**Benefits**:
- Reduced maintenance burden
- Faster compilation times
- Easier onboarding (less confusing legacy code)
- Smaller bundle size
- Clearer code intent

---

### Phase 8: Testing and Documentation

**Goal**: Comprehensive testing and documentation of new architecture.

**Tasks**:
1. Unit tests:
   - Context creation
   - Context serialization/deserialization
   - Context validation
   - History tracking

2. Integration tests:
   - End-to-end conversion with context
   - Multi-platform installation
   - Temp directory round-trips
   - Conditional flow evaluation

3. Documentation:
   - Architecture decision record (ADR)
   - API documentation for new types
   - Migration guide for Phase 7
   - Troubleshooting guide

**Deliverables**:
- 100% test coverage for context code
- Integration tests for all conversion scenarios
- Complete documentation

**Breaking Changes**: None

---

## Timeline Estimates

- **Phase 1**: 2-3 days (types and infrastructure)
- **Phase 2**: 3-4 days (context creation at entry points)
- **Phase 3**: 4-5 days (thread through pipeline)
- **Phase 4**: 2-3 days (temp directory persistence)
- **Phase 5**: 2-3 days (update install context)
- **Phase 6**: 3-4 days (validation and error handling)
- **Phase 7**: 3-4 days (migration and breaking changes)
- **Phase 8**: 3-4 days (testing and documentation)
- **Phase 9**: 2-3 days (legacy code removal and cleanup)

**Total**: 24-33 days (5-7 weeks)

---

## Data Flow Diagrams

### Current Flow (Fragile)
```
Plugin Transformer
  ↓ Package with _format
ConversionInstallStrategy
  ↓ Manually pass sourcePlatform in options
PlatformConverter.convert()
  ↓ Update _format, hope sourcePlatform preserved
Write to temp directory
  ↓ ⚠️ METADATA LOST (must manually propagate)
Read from temp
  ↓ Reconstruct _format from context
FlowBasedInstallStrategy
  ↓ Hope _format.sourcePlatform is correct
Build flow context
  ↓ Use fallback chain to find source
Execute flows
```

### New Flow (Robust)
```
Plugin Transformer
  ↓ Package + ConversionContext (created together)
ConversionInstallStrategy
  ↓ Thread both through explicitly
PlatformConverter.convert()
  ↓ Returns { Package, UpdatedContext }
Write to temp directory
  ↓ Serialize context to .opkg-conversion-context.json
Read from temp
  ↓ Deserialize context + validate
FlowBasedInstallStrategy
  ↓ Receives Package + Context
Build flow context
  ↓ Read directly from context.originalFormat.platform
Execute flows
  ✓ Guaranteed correct values
```

---

## Key Files to Modify

### New Files
- `src/types/conversion-context.ts` - Type definitions
- `src/core/conversion-context/creation.ts` - Context creation
- `src/core/conversion-context/validation.ts` - Validation logic
- `src/core/conversion-context/serialization.ts` - JSON serialization
- `src/core/conversion-context/history.ts` - History utilities
- `src/utils/temp-context-persistence.ts` - Temp directory persistence

### Modified Files
- `src/core/install/plugin-transformer.ts` - Return context
- `src/core/install/format-detector.ts` - Create context on detection
- `src/core/flows/platform-converter.ts` - Accept/return context
- `src/core/install/strategies/conversion-strategy.ts` - Thread context
- `src/core/install/strategies/flow-based-strategy.ts` - Use context
- `src/core/install/strategies/base-strategy.ts` - Build context from context
- `src/core/install/flow-based-installer.ts` - Create/pass context
- `src/utils/flow-index-installer.ts` - Pass context through
- `src/core/install/strategies/types.ts` - Add context field
- `src/core/install/strategies/helpers/temp-directory.ts` - Serialize context

---

## Testing Strategy

### Unit Tests
- Context creation from various package formats
- Serialization/deserialization round-trip
- Validation logic for all error cases
- History tracking and updates
- Immutability enforcement (readonly fields)

### Integration Tests
- Claude plugin → Claude platform (no transform)
- Claude plugin → Cursor platform (with transform)
- Claude plugin → multiple platforms
- Temp directory persistence
- Conversion history accuracy
- Error recovery and validation

### Regression Tests
- All existing installation tests must pass
- Existing packages install correctly
- No performance degradation
- Backward compatibility during migration

---

## Rollback Strategy

### Phase 1-5 (Context Optional)
- Easy rollback: remove new code, context is optional
- Old code path still works

### Phase 6 (Validation)
- Can disable validation if issues found
- Still compatible with old path

### Phase 7 (Context Required)
- **Point of no return**
- Rollback requires reverting to Phase 6 state
- Ensure comprehensive testing before Phase 7

### Emergency Rollback
- Revert to Phase 6 (context optional)
- Disable validation temporarily
- Investigate issues
- Fix and re-deploy Phase 7

---

## Success Criteria

### Functional
- ✅ Conditional flows respect `$$platform` and `$$source` correctly
- ✅ Multi-platform installations work correctly
- ✅ Context survives temp directory round-trips
- ✅ Conversion history is accurate and complete
- ✅ All existing tests pass

### Non-Functional
- ✅ No performance degradation (< 5% overhead)
- ✅ Type safety enforced by TypeScript
- ✅ Clear error messages with context
- ✅ Comprehensive test coverage (> 90%)
- ✅ Complete documentation

### Quality
- ✅ No fallback chains or guessing
- ✅ Immutability enforced by types
- ✅ Explicit data flow (visible in signatures)
- ✅ Single source of truth
- ✅ Fail fast validation

---

## Risks and Mitigations

### Risk 1: Breaking Changes in Phase 7
**Impact**: High - Could break external consumers
**Probability**: Medium
**Mitigation**: 
- Comprehensive testing in Phases 1-6
- Clear migration guide
- Deprecation warnings before Phase 7
- Beta release for testing

### Risk 2: Performance Overhead
**Impact**: Medium - Context serialization/deserialization
**Probability**: Low
**Mitigation**:
- Benchmark before/after
- Context is small (< 1KB)
- Optimize serialization if needed

### Risk 3: Complexity Increase
**Impact**: Medium - More parameters to pass
**Probability**: Medium
**Mitigation**:
- Clear documentation
- Helper functions for common patterns
- Type system guides correct usage

### Risk 4: Incomplete Migration
**Impact**: High - Some code paths without context
**Probability**: Medium
**Mitigation**:
- Comprehensive code review
- Type system catches missing context
- Integration tests cover all paths

---

## Benefits Summary

### Correctness
- ✅ Conditional flows work as designed
- ✅ No information loss through pipeline
- ✅ Guaranteed correct `$$source` and `$$platform` values

### Maintainability
- ✅ Single source of truth
- ✅ Explicit data flow
- ✅ Clear semantics (identity vs state)
- ✅ Easy to understand and debug

### Robustness
- ✅ Immutable by design (TypeScript enforces)
- ✅ Survives serialization/deserialization
- ✅ Fail fast validation
- ✅ Complete audit trail

### Testability
- ✅ Easy to mock context
- ✅ Clear assertions possible
- ✅ Isolated unit tests
- ✅ Deterministic behavior

---

## Appendix: Alternative Approaches Considered

### Alternative 1: Store in Package Metadata
- **Pros**: Survives serialization
- **Cons**: Mixes concerns, pollutes metadata namespace
- **Decision**: Rejected - Context is orthogonal to package metadata

### Alternative 2: Global State/Singleton
- **Pros**: No parameter passing
- **Cons**: Not thread-safe, hard to test, unclear data flow
- **Decision**: Rejected - Violates explicit threading principle

### Alternative 3: Enhance _format Field
- **Pros**: Minimal changes
- **Cons**: Still doesn't survive temp directories, still mutable
- **Decision**: Rejected - Doesn't solve fundamental problem

### Alternative 4: Context-Based Tracking (Chosen)
- **Pros**: Explicit, immutable, survives serialization, type-safe
- **Cons**: More code changes required
- **Decision**: **Accepted** - Most robust solution

---

## References

- Original bug report: Conditional flows not respecting `$$platform`
- Current implementation: `src/core/flows/platform-converter.ts`
- Platforms config: `platforms.jsonc`
- Flow execution: `src/core/flows/flow-executor.ts`

---

## Approval Sign-off

- [ ] Technical review completed
- [ ] Architecture approved
- [ ] Timeline reviewed
- [ ] Resource allocation confirmed
- [ ] Risk mitigation strategies approved

**Date**: _____________
**Approved by**: _____________
