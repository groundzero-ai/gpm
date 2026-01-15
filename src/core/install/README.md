# Installation Module

This directory contains the core installation system for OpenPackage.

## Directory Structure

### `unified/`
Unified installation pipeline and context management.

- `context.ts` - Installation context type and types
- `context-builders.ts` - Functions to build contexts for different scenarios
- `context-helpers.ts` - Helper functions for working with contexts
- `pipeline.ts` - Main unified pipeline orchestration
- `phases/` - Individual pipeline phases:
  - `load-package.ts` - Load package from source
  - `resolve-dependencies.ts` - Resolve and pull dependencies
  - `conflicts.ts` - Handle file conflicts
  - `execute.ts` - Execute installation using flows
  - `manifest.ts` - Update openpackage.yml
  - `report.ts` - Report results to user

### `sources/`
Source loaders for different package types.

- `base.ts` - Base interfaces and types
- `registry-source.ts` - Load from registry
- `path-source.ts` - Load from local path (directory or tarball)
- `git-source.ts` - Load from git repository
- `workspace-source.ts` - Load from workspace index (apply mode)
- `loader-factory.ts` - Factory for creating loaders
- `index.ts` - Public exports

### `operations/`
Core operations used by the pipeline.

- `root-files.ts` - Root file handling (unified)
- `conflict-handler.ts` - Conflict detection and resolution
- `index.ts` - Public exports

### `helpers/`
Helper utilities specific to installation.

- `file-discovery.ts` - Discover and categorize package files
- `index.ts` - Public exports

### Other Files
- `install-flow.ts` - Legacy install flow (to be migrated)
- `remote-flow.ts` - Remote package pulling
- `dry-run.ts` - Dry run mode handling
- `file-updater.ts` - File update utilities
- Various loaders and utilities

## Architecture

The installation system follows a unified pipeline architecture:

```
1. Load Package (via source loaders)
   ├─ Registry Source
   ├─ Path Source
   ├─ Git Source
   └─ Workspace Source (apply)

2. Resolve Dependencies (install mode only)
   └─ Pull missing packages from remote

3. Process Conflicts
   └─ Detect conflicts and prompt user

4. Execute Installation
   └─ Use flow-based installer to write files

5. Update Manifest (install mode only)
   └─ Update openpackage.yml

6. Report Results
   └─ Display success/failure to user
```

### Key Concepts

**Installation Context**: A unified context object that carries all state through the pipeline phases. Contains package source, options, platforms, mode, etc.

**Source Loaders**: Pluggable loaders that abstract away the differences between package sources (registry, path, git, workspace). All loaders implement the `PackageSourceLoader` interface.

**Phases**: Independent pipeline phases that can be composed and executed conditionally based on context mode.

**Modes**: Two modes supported:
- `install` - Full installation with dependencies and manifest updates
- `apply` - Apply changes from workspace index without dependencies/manifest

## Usage

### Command Layer

Commands use context builders and invoke the unified pipeline:

```typescript
import { buildRegistryInstallContext } from './unified/context-builders.js';
import { runUnifiedInstallPipeline } from './unified/pipeline.js';

// Build context
const context = await buildRegistryInstallContext({
  cwd,
  packageSpec: 'package-name@1.0.0',
  options,
  platforms
});

// Run pipeline
const result = await runUnifiedInstallPipeline(context);
```

### Adding a New Source Type

1. Create a new source loader in `sources/`
2. Implement the `PackageSourceLoader` interface
3. Register in `loader-factory.ts`
4. Add context builder in `context-builders.ts`

```typescript
// sources/my-source.ts
export class MySourceLoader implements PackageSourceLoader {
  canHandle(source: PackageSource): boolean {
    return source.type === 'my-type';
  }
  
  async load(source: PackageSource): Promise<LoadedPackage> {
    // Implementation
  }
  
  getDisplayName(source: PackageSource): string {
    return `my-source:${source.specifier}`;
  }
}

// Register in loader-factory.ts
registerSourceLoader(new MySourceLoader());
```

## Testing

Each module has corresponding tests:

- `tests/core/install/` - Integration tests for install flows
- `tests/core/flows/` - Flow system tests
- Unit tests co-located with implementation

Run tests:
```bash
npm test                    # All tests
npm run test:install        # Install tests only
```

## Migration Notes

This module is the result of a major refactoring (Phase 1-6):

- **Phase 1-2**: Created unified context and source abstraction
- **Phase 3**: Unified root file operations
- **Phase 4**: Created unified pipeline
- **Phase 5**: Simplified command layer
- **Phase 6**: Cleanup and organization

Legacy code is gradually being migrated to the new unified pipeline. See `plans/install-apply-refactor/` for details.

## Related Documentation

- [Install Command Spec](../../specs/install/)
- [Apply Command Spec](../../specs/apply/)
- [Platform Flows](../../specs/platforms/)
- [Refactoring Plan](../../plans/install-apply-refactor/)
