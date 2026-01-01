# Package Name Resolution Architecture

## Overview

This document describes the unified package name resolution architecture used by the `pack` and `install` commands.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Package Name Resolution                       │
│              (package-name-resolution.ts)                        │
└─────────────────────────────────────────────────────────────────┘
                               ▲
                               │
                    ┌──────────┴───────────┐
                    │                      │
        ┌───────────▼──────────┐  ┌───────▼──────────┐
        │   Pack Command       │  │  Install Command  │
        │  (pack-pipeline.ts)  │  │ (package-input.ts)│
        └──────────────────────┘  └───────────────────┘
```

## Before: Separate Resolution Logic

### Pack Command (Old)
```
pack-pipeline.ts
    ↓
resolvePackageSource()
    ↓
readWorkspaceIndex()
    ↓
Looks up in .openpackage/index.yml only
    ↓
❌ Requires package to be installed first
```

### Install Command (Old)
```
package-input.ts
    ↓
findPackageInMutableDirectories()
    ↓
Searches: workspace → global → registry
    ↓
✅ Version comparison logic
```

**Problem**: Code duplication, inconsistent behavior

## After: Unified Resolution Logic

### Shared Resolution Module

```
package-name-resolution.ts
├── resolvePackageByName()          # Main entry point
│   ├── checkCwdPackage()           # Check current directory
│   ├── checkWorkspacePackage()     # Check .openpackage/packages/
│   ├── checkGlobalPackage()        # Check ~/.openpackage/packages/
│   ├── checkRegistryPackage()      # Check ~/.openpackage/registry/
│   ├── selectBestCandidate()       # Version-aware selection
│   └── determineSelectionReason()  # Explain selection
```

### Pack Command (New)
```
pack-pipeline.ts
    ↓
resolvePackageByName({
  checkCwd: true,        ← CWD priority
  searchWorkspace: true,
  searchGlobal: true,
  searchRegistry: false  ← Skip immutable
})
    ↓
✅ Can pack without installing
✅ Version-aware selection
```

### Install Command (New)
```
package-input.ts
    ↓
resolvePackageByName({
  checkCwd: false,       ← No CWD priority
  searchWorkspace: true,
  searchGlobal: true,
  searchRegistry: true   ← Include registry
})
    ↓
✅ Same resolution logic
✅ Different configuration
```

## Resolution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ resolvePackageByName({ cwd, packageName, options })         │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Check CWD (optional)  │ ← if checkCwd=true
           └────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Check Workspace       │ ← if searchWorkspace=true
           │  .openpackage/packages │
           └────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Check Global          │ ← if searchGlobal=true
           │  ~/.openpackage/packages│
           └────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Check Registry        │ ← if searchRegistry=true
           │  ~/.openpackage/registry│
           └────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Collect Candidates    │
           └────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Select Best           │
           │  (version-aware)       │
           └────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │  Return Result         │
           │  { path, version, ... }│
           └────────────────────────┘
```

## Selection Logic

When multiple candidates are found:

```
Priority Rules:
1. CWD (if checked and name matches)     ← Pack only
   └─ ALWAYS WINS if present

2. Workspace (.openpackage/packages/)    ← Both commands
   └─ ALWAYS WINS among remaining

3. Version Comparison (global vs registry)
   ├─ Higher version WINS
   └─ Same version → prefer Global (mutable)
```

## Example Resolution Scenarios

### Scenario 1: Pack from CWD
```
Input:
  cwd: /projects/my-package
  packageName: my-package
  checkCwd: true

Resolution:
  ✓ CWD: my-package@3.0.0 (match!)
  ✓ Workspace: my-package@2.0.0
  
Selection: CWD@3.0.0 (CWD priority)
```

### Scenario 2: Install (no CWD priority)
```
Input:
  cwd: /projects/workspace
  packageName: some-lib
  checkCwd: false

Resolution:
  ✓ Workspace: some-lib@2.0.0
  ✓ Global: some-lib@3.0.0
  ✓ Registry: some-lib@2.5.0
  
Selection: Workspace@2.0.0 (workspace priority)
```

### Scenario 3: Version Comparison
```
Input:
  cwd: /projects/workspace
  packageName: tool
  checkCwd: false

Resolution:
  ✗ Workspace: not found
  ✓ Global: tool@5.0.0
  ✓ Registry: tool@4.0.0
  
Selection: Global@5.0.0 (higher version)
```

### Scenario 4: Same Version Tie-breaker
```
Input:
  cwd: /projects/workspace
  packageName: util
  checkCwd: false

Resolution:
  ✗ Workspace: not found
  ✓ Global: util@1.2.3
  ✓ Registry: util@1.2.3
  
Selection: Global@1.2.3 (prefer mutable)
```

## Configuration Matrix

| Option | Pack | Install | Purpose |
|--------|------|---------|---------|
| `checkCwd` | ✅ true | ❌ false | Pack prioritizes current work |
| `searchWorkspace` | ✅ true | ✅ true | Both check workspace |
| `searchGlobal` | ✅ true | ✅ true | Both check global |
| `searchRegistry` | ❌ false | ✅ true | Pack skips immutable |

## Benefits of Unified Architecture

### Code Quality
- **DRY**: Single implementation
- **Testable**: Pure functions
- **Maintainable**: One place to update
- **Extensible**: Easy to add locations

### User Experience
- **Consistent**: Similar behavior across commands
- **Predictable**: Clear priority rules
- **Flexible**: Works in more scenarios
- **Transparent**: Clear resolution messages

### Developer Experience
- **Simple API**: One function, multiple configs
- **Type-safe**: Full TypeScript support
- **Well-documented**: Inline and external docs
- **Easy to use**: Import and configure

## API Reference

### Main Function

```typescript
resolvePackageByName(options: PackageNameResolutionOptions): 
  Promise<PackageNameResolutionResult>
```

### Input Type

```typescript
interface PackageNameResolutionOptions {
  cwd: string;                  // Current working directory
  packageName: string;          // Package to resolve
  checkCwd?: boolean;           // Check CWD first (pack=true)
  searchWorkspace?: boolean;    // Check workspace packages
  searchGlobal?: boolean;       // Check global packages
  searchRegistry?: boolean;     // Check local registry
}
```

### Output Type

```typescript
interface PackageNameResolutionResult {
  found: boolean;               // Whether package was found
  path?: string;                // Absolute path to package
  version?: string;             // Package version
  sourceType?: PackageSourceType; // Where it was found
  resolutionInfo?: SourceResolutionInfo; // Details
}
```

## Testing Strategy

### Unit Tests
Individual functions tested in isolation:
- `checkCwdPackage()`
- `checkWorkspacePackage()`
- `checkGlobalPackage()`
- `checkRegistryPackage()`
- `selectBestCandidate()`

### Integration Tests
End-to-end scenarios:
- Pack from CWD
- Pack from workspace
- Pack from global
- CWD priority
- Version comparison

### Regression Tests
Ensure no breaking changes:
- Existing pack tests
- Existing install tests
- Install selection tests

## Future Enhancements

### Potential Features
1. **Custom search paths** via config
2. **Resolution caching** for performance
3. **Parallel searches** across locations
4. **Resolution plugins** for extensibility
5. **Verbose tracing** for debugging

### Potential Optimizations
1. **Early exit** on first match (configurable)
2. **Lazy evaluation** of candidates
3. **Memoization** of results
4. **Index-based lookup** for speed

## Related Files

- **Implementation**: `src/utils/package-name-resolution.ts`
- **Pack Usage**: `src/core/pack/pack-pipeline.ts`
- **Install Usage**: `src/utils/package-input.ts`
- **Tests**: `tests/pack-name-resolution.test.ts`
