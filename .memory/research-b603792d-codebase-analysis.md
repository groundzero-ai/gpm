# Research: OpenPackage Codebase Analysis

**Date:** 2026-01-16  
**Hash ID:** b603792d  
**Methodology:** CodeMapper AST analysis + structural inspection

## Summary

OpenPackage is a sophisticated TypeScript-based universal package manager for AI coding tools. The codebase is well-structured with 379 files (295 TypeScript, 84 Markdown) containing 5,599 symbols across ~2.5MB of code. The architecture follows a layered pipeline pattern with strong separation between commands, core logic, and utilities.

---

## Codebase Statistics

### Language Distribution
- **TypeScript:** 295 files (primary implementation)
- **Markdown:** 84 files (extensive documentation)
- **Total Files:** 379
- **Total Symbols:** 5,599
- **Total Size:** ~2.5 MB

### Symbol Breakdown
- **Functions:** 2,283 (primary implementation unit)
- **Classes:** 30 (object-oriented components)
- **Methods:** 140 (class methods)
- **Enums:** 2
- **Interfaces:** Extensive (TypeScript-first approach)
- **Markdown Headings:** 1,761
- **Code Blocks:** 1,003

---

## Architecture Overview

### Layered Structure

```
┌─────────────────────────────────────┐
│     CLI Commands (18 commands)      │
│   ./src/commands/*.ts                │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│      Core Pipelines                  │
│   ./src/core/*/                      │
│   - install, uninstall, save, apply  │
│   - push, pull, pack                 │
│   - add, remove, set                 │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│   Flow-Based Transformation Engine   │
│   ./src/core/flows/                  │
│   - map-pipeline (7 operations)      │
│   - platform conversion              │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│      Utilities & Types               │
│   ./src/utils/*.ts                   │
│   ./src/types/*.ts                   │
└──────────────────────────────────────┘
```

### Key Architectural Patterns

1. **Pipeline Pattern:** All major operations implemented as pipelines
2. **Flow-Based Transformation:** Declarative file transformations
3. **Platform Abstraction:** Universal format converts to platform-specific
4. **Source Resolution:** Multiple package sources (registry, git, local, global)
5. **Workspace Management:** Multi-scope package tracking

---

## Core Commands (18 Total)

### Package Lifecycle Commands

1. **new** - Create new packages
2. **save** - Save workspace changes to package source
3. **pack** - Package for distribution
4. **push** - Upload to registry
5. **pull** - Download from registry

### Installation & Management

6. **install** - Install packages to workspace
7. **uninstall** - Remove packages from workspace
8. **apply** - Apply installed packages
9. **add** - Add files to package
10. **remove** - Remove files from package

### Discovery & Information

11. **list** - List available packages
12. **show** - Display package details
13. **status** - Show workspace status

### Configuration

14. **set** - Update package metadata
15. **configure** - Configure OpenPackage

### Authentication

16. **login** - Authenticate with registry
17. **logout** - Clear credentials

### Utility

18. **delete** - Delete packages

---

## Data Flow Patterns

### 1. Install Flow (Registry → Workspace)

```
User Command
    ↓
install-pipeline.ts
    ↓
source-resolution/ ──→ resolve-registry-version.ts
    ↓                  (version selection)
flows/map-pipeline/ ──→ Platform transformation
    ↓                   (universal → platform)
platform-mapper.ts ──→ Target path resolution
    ↓
File Installation ──→ workspace files + index
    ↓
Dependency Resolution (recursive)
```

### 2. Save Flow (Workspace → Source)

```
User Command
    ↓
save-pipeline.ts
    ↓
File Discovery ──→ root-save-candidates.ts
    ↓             (workspace file scanning)
Versioning ──→ save-versioning.ts
    ↓          (WIP version generation)
Flow Application ──→ Reverse transformation
    ↓                 (platform → universal)
Source Update ──→ Write to package directory
    ↓
package.yml Update
```

### 3. Pack & Push Flow (Source → Registry)

```
User Command
    ↓
pack-pipeline.ts
    ↓
Source Resolution ──→ Local/Global package lookup
    ↓
Versioning ──→ Stable version computation
    ↓
Tarball Creation ──→ tarball.ts
    ↓
push-pipeline.ts (if push)
    ↓
Registry Upload ──→ HTTP multipart upload
```

### 4. Flow-Based Transformation

```
Input File
    ↓
Format Detection ──→ YAML/JSON/JSONC/TOML
    ↓
Map Pipeline ──→ 7 Core Operations:
    │            • $set (field values)
    │            • $rename (field names)
    │            • $unset (remove fields)
    │            • $switch (pattern replace)
    │            • $pipeline (multi-step)
    │            • $copy (field duplication)
    │            • $pipe (registry transforms)
    ↓
Target File (different format/structure)
```

---

## Key Modules Deep Dive

### Core Pipeline Modules

#### `install-pipeline.ts` (16,251 bytes)
- **Entry:** `runInstallPipeline()`
- **Functions:** 11 major functions
- **Responsibilities:**
  - Package source resolution
  - Version selection
  - Dependency tree building
  - Flow-based installation
  - Workspace index updates
- **Key Logic:** Handles registry, git, local, and global sources

#### `save-pipeline.ts` (9,923 bytes)
- **Entry:** `runSavePipeline()`
- **Responsibilities:**
  - Workspace file discovery
  - Version computation (WIP versions)
  - Reverse flow application
  - Source synchronization
- **Versioning:** Base62 timestamp + workspace hash

#### `platforms.ts` (33,077 bytes - LARGEST)
- **Functions:** 37 functions
- **Critical Module:** Platform definition and management
- **Responsibilities:**
  - Platform registration (Claude, Cursor, etc.)
  - Universal pattern matching
  - Directory path resolution
  - Platform detection
  - Flow configuration management

#### `map-pipeline/` (Flow Engine)
- **`index.ts`:** Pipeline orchestration
- **`operations/`:**
  - `set.ts` - Set field values
  - `rename.ts` - Rename fields
  - `unset.ts` - Remove fields
  - `copy.ts` - Copy with transform
  - `transform.ts` - Complex transformations (18,672 bytes)
- **`context.ts`:** Variable resolution
- **`utils.ts`:** Nested value operations

### Utility Modules

#### Version Management
- `version-generator.ts` - WIP version creation
- `save-versioning.ts` - Version computation
- `version-selection.ts` - Install version selection (12,119 bytes)

#### Git Operations
- `git-clone-registry.ts` - Git cloning with caching
- `git-url-parser.ts` - Git URL parsing
- `git-spec.ts` - Git specification handling

#### Package Operations
- `package-installation.ts` - Installation helpers
- `package-input.ts` - Input classification
- `package-name.ts` - Name validation and parsing
- `tarball.ts` - Tarball creation/extraction

#### Platform Operations
- `platform-mapper.ts` - Universal ↔ Platform mapping
- `root-file-installer.ts` - Root file installation
- `root-file-merger.ts` - Root file merging

---

## State Machine: Package Lifecycle

```
┌──────────────┐
│   CREATED    │ ← opkg new
└──────┬───────┘
       │
       │ (local development)
       ↓
┌──────────────┐
│  WORKSPACE   │ ← opkg save (creates WIP versions)
│  (Mutable)   │
└──────┬───────┘
       │
       │ opkg pack
       ↓
┌──────────────┐
│   PACKED     │ ← .tgz file created
│  (Tarball)   │
└──────┬───────┘
       │
       │ opkg push
       ↓
┌──────────────┐
│  PUBLISHED   │ ← Registry (immutable)
│  (Registry)  │
└──────┬───────┘
       │
       │ opkg install <name>@<version>
       ↓
┌──────────────┐
│  INSTALLED   │ ← Workspace (from registry)
│  (Workspace) │
└──────┬───────┘
       │
       │ opkg apply
       ↓
┌──────────────┐
│   APPLIED    │ ← Files copied to target
│  (Active)    │
└──────────────┘
```

### Source Mutability Matrix

| Source Type | Location | Mutable | Commands Allowed |
|------------|----------|---------|------------------|
| Workspace Path | `.openpackage/` | ✅ Yes | save, add, remove, set |
| Global Path | `~/.openpackage/global/` | ✅ Yes | save, add, remove, set |
| Registry | Remote registry | ❌ No | pull only |
| Git | Remote repository | ❌ No | install only |

---

## User Journeys

### Journey 1: Create & Publish Package

```
Developer starts
    │
    ↓
opkg new my-rules --scope local
    │ (Creates .openpackage/my-rules/)
    ↓
Edit files in .openpackage/my-rules/universal/
    │
    ↓
opkg save my-rules
    │ (Generates WIP version)
    ↓
Test locally
    │
    ↓
opkg set my-rules --ver 1.0.0
    │ (Set stable version)
    ↓
opkg pack my-rules
    │ (Creates tarball)
    ↓
opkg push my-rules@1.0.0
    │ (Uploads to registry)
    ↓
Published! ✓
```

### Journey 2: Install & Use Package

```
Developer wants package
    │
    ↓
opkg show <package>
    │ (Preview package details)
    ↓
opkg install <package>@1.0.0
    │ (Downloads from registry)
    │ (Resolves dependencies)
    │ (Applies flows)
    ↓
Files installed to workspace
    │
    ↓
opkg apply <package>
    │ (Activates package)
    ↓
Package active in workspace ✓
```

### Journey 3: Modify Installed Package

```
Developer has installed package
    │
    ↓
opkg save <package> --scope global
    │ (Copy to global workspace)
    ↓
Edit in ~/.openpackage/global/<package>/
    │
    ↓
opkg save <package>
    │ (Save changes)
    ↓
opkg apply <package>
    │ (Re-apply with changes)
    ↓
Modified package active ✓
```

### Journey 4: Multi-Platform Package

```
Package author
    │
    ↓
opkg new universal-package
    │
    ↓
Create universal/rules/*.md files
    │
    ↓
Configure platforms.jsonc
    │ (Define Claude, Cursor flows)
    ↓
opkg save universal-package
    │
    ↓
opkg install universal-package --platform claude
    │ (Flow transforms for Claude)
    ↓
opkg install universal-package --platform cursor
    │ (Flow transforms for Cursor)
    ↓
Works on both platforms! ✓
```

### Journey 5: Git-Based Package

```
Developer discovers package on GitHub
    │
    ↓
opkg install github:user/repo
    │ (Clones to cache)
    │ (Detects manifest)
    │ (Applies flows)
    ↓
opkg install github:user/repo#branch
    │ (Installs specific branch)
    ↓
opkg install github:user/repo:subdir
    │ (Installs subdirectory)
    ↓
Git package installed ✓
```

---

## Platform System

### Universal Format
Packages are stored in **universal format** with platform-agnostic structure:

```
package/
├── universal/
│   ├── rules/
│   ├── commands/
│   ├── skills/
│   └── agents/
└── openpackage.yml
```

### Platform Flows
Flows transform universal → platform-specific:

**Built-in Platforms:**
- Claude (Anthropic CLI)
- Cursor
- Windsurf
- Cline
- Continue
- Roo Code
- Cody

**Flow Operations:**
1. **File Mapping** - Copy to platform directories
2. **Format Conversion** - YAML ↔ JSON ↔ JSONC ↔ TOML
3. **Key Remapping** - Transform object structure
4. **Content Transform** - Modify file contents
5. **Merging** - Combine multiple sources
6. **Conditional** - Platform-specific logic

---

## Dependency System

### Resolution Strategy
```
Package declares dependencies in openpackage.yml:
  dependencies:
    other-package: ^1.0.0
    git-package: github:user/repo
    path-package: file:../local

Install resolves:
  1. Parse constraint (^1.0.0)
  2. Query registry for versions
  3. Select best match (semver)
  4. Install recursively
  5. Build dependency tree
  6. Apply all packages
```

### Dependency Types
- **Registry:** `package-name: ^1.0.0`
- **Git:** `package-name: github:user/repo#ref`
- **Path:** `package-name: file:../path`
- **URL:** `package-name: https://example.com/package.tgz`

---

## Workspace Index System

### `.openpackage/openpackage.index.yml`

Tracks installed packages and their files:

```yaml
packages:
  my-package@1.0.0:
    files:
      "claude/rules/my-rule.md": "universal/rules/my-rule.md"
    keys:
      "claude/.cursorrules":
        - "my-package@1.0.0"
```

**Purpose:**
- Track which files came from which package
- Enable clean uninstall
- Prevent conflicts
- Support partial updates

**Key Tracking:**
For merged files (like root `.cursorrules`), tracks which keys came from which package to enable surgical removal on uninstall.

---

## Testing Infrastructure

### Test Organization (`./tests/`)

- **`commands/`** - CLI command tests
- **`core/add/`** - Add command logic tests
- **`core/apply/`** - Apply pipeline tests
- **`core/flows/`** - Flow transformation tests
- **`core/install/`** - Installation pipeline tests
- **`core/platforms/`** - Platform system tests
- **`core/save/`** - Save pipeline tests
- **`core/uninstall/`** - Uninstall tests
- **`integration/`** - End-to-end tests
- **`fixtures/`** - Test data

**Test Coverage Areas:**
- Version selection algorithms
- Flow transformations
- Platform detection
- Conflict resolution
- Git caching
- Tarball operations
- Workspace index management

---

## Key Design Patterns

### 1. Pipeline Pattern
All major operations structured as pipelines with:
- Options interface
- Result interface
- Pipeline function
- Error handling

### 2. Strategy Pattern
- Multiple resolution strategies (registry, git, path)
- Multiple installation strategies (direct, flow-based)
- Multiple merge strategies (merge, replace, skip)

### 3. Builder Pattern
- Flow pipeline builder
- Package configuration builder

### 4. Registry Pattern
- Transform registry (flow operations)
- Platform registry
- Source registry

### 5. Adapter Pattern
- Platform adapters
- Format adapters (YAML/JSON/TOML)

---

## Critical Files (By Size)

1. **platforms.ts** - 33,077 bytes (platform system core)
2. **transform.ts** - 18,672 bytes (pipeline transformations)
3. **map-pipeline.md** - 19,083 bytes (documentation)
4. **install-pipeline.ts** - 16,251 bytes (installation logic)
5. **platform-mapper.ts** - 15,141 bytes (path mapping)
6. **version-selection.ts** - 12,119 bytes (version resolution)
7. **set-pipeline.ts** - 12,406 bytes (metadata updates)
8. **install.ts** - 13,293 bytes (install command)
9. **types/index.ts** - 6,658 bytes (type definitions)
10. **types/platform-flows.ts** - 11,481 bytes (flow types)

---

## Extensibility Points

### 1. Custom Platforms
Add new platforms via `platforms.jsonc`:
```jsonc
{
  "my-platform": {
    "name": "My Platform",
    "subdirs": ["rules", "commands"],
    "flows": { /* ... */ }
  }
}
```

### 2. Custom Transforms
Register domain-specific transforms:
```typescript
registerTomlDomainTransforms(registry)
```

### 3. Custom Source Types
Implement new source resolvers

### 4. Custom Flow Operations
Add new map pipeline operations

---

## Performance Considerations

### Caching Strategy
- **Git Cache:** `~/.openpackage/cache/git/` - Reuse cloned repos
- **CodeMapper Cache:** `.codemapper/` - AST parsing cache
- **Registry Cache:** In-memory for session

### Optimization Patterns
- Lazy loading of platform definitions
- Incremental workspace index updates
- Shallow git clones
- Parallel dependency resolution

---

## Security Features

### Path Safety
- Validates custom paths don't escape boundaries
- Prevents `..` directory traversal
- Checks dangerous paths (system dirs)

### Authentication
- Token-based auth with registry
- Credential storage in keyring
- OAuth device flow support

### Validation
- Package name validation
- Semver validation
- Git URL validation
- Manifest schema validation

---

## Documentation Structure

### Specifications (`./specs/`)
- **`architecture.md`** - High-level architecture
- **`package/`** - Package format specs
- **`platforms/`** - Platform system specs
- **`install/`** - Installation specs
- **`save/`** - Save pipeline specs
- **`push/`** - Registry push specs
- **`auth/`** - Authentication specs

### Examples
- Platform flow examples
- Transform examples
- Multi-package composition

---

## References

### Key Documentation Files
1. `specs/architecture.md` - System architecture
2. `specs/platforms/map-pipeline.md` - Flow system
3. `specs/platforms/examples.md` - Usage examples
4. `specs/package/package-root-layout.md` - Package structure
5. `specs/install/version-resolution.md` - Version algorithm
6. `specs/package-sources.md` - Source types

### Critical Code Paths
1. Install: `commands/install.ts` → `core/install/install-pipeline.ts`
2. Save: `commands/save.ts` → `core/save/save-pipeline.ts`
3. Transform: `core/flows/map-pipeline/`
4. Platform: `core/platforms.ts`

---

## Confidence Ratings

- **Architecture Understanding:** 9/10 - Clear layered structure
- **Data Flow:** 9/10 - Well-defined pipelines
- **State Management:** 8/10 - Workspace index system
- **Platform System:** 9/10 - Comprehensive flow engine
- **Version System:** 8/10 - Complex but documented
- **Testing:** 7/10 - Good coverage, needs more integration tests

---

## Next Steps for Development

1. **Understand:** This research document covers core architecture
2. **Explore:** Use CodeMapper to dive into specific modules
3. **Test:** Run test suite to see system in action
4. **Extend:** Add new platforms or transforms
5. **Document:** Keep specs updated with changes
