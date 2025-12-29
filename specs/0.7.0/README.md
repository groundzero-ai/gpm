# OpenPackage CLI 0.7.0 Specification

This directory contains the architectural specifications for OpenPackage CLI v0.7.0, focusing on a simplified, path-based package management model.

## Design Goals

- **Focused**: Each command has one clear purpose
- **Surgical**: Clear separation between mutable sources and immutable snapshots
- **Simple**: Path declarations as the universal source of truth
- **Reliable**: Natural guards against modifying immutable packages

## Documents

| File | Topic |
|------|-------|
| `architecture.md` | High-level design philosophy and data flow |
| `directory-structure.md` | Global and workspace directory layouts |
| `metadata-files.md` | Unified index and manifest structures |
| `package-sources.md` | Mutable vs immutable sources, path-based model |
| `commands.md` | Command semantics: save, add, pack, apply, install |
| `registry.md` | Directory-based versioned storage |
| `scope-management.md` | Workspace vs global packages (deferred) |
| `self-hosted-registries.md` | Future considerations for private registries |

## Key Concepts

### Everything is a Path

All installed packages ultimately resolve to a path. The `path:` field in dependency declarations points to the actual source of truth.

### Mutable vs Immutable

- **Mutable sources**: Package directories that can be edited (`save`, `add` work here)
- **Immutable sources**: Registry directories from `pack` or remote (`save`, `add` fail with clear errors)

### Unified Index

A single `openpackage.index.yml` at the workspace root tracks all installed packages and their file mappings. No per-package metadata directories needed.

### Command Flow

```
Workspace ←──apply/install── Source/Registry
Workspace ──save/add──────→ Source (mutable only)
Source ────pack───────────→ Registry (immutable)
```

## Breaking Changes from Previous Versions

This version introduces breaking changes. No migration path is provided—workspaces should be re-initialized.

- Removed WIP versioning
- Removed workspace hash tracking
- Removed per-package metadata directories
- Unified index replaces per-package index files
- Registry uses directories instead of tarballs
