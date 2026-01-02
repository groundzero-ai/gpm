# Show Command

`opkg show` displays detailed information about packages from any source (local or remote). It provides a unified way to inspect package metadata, files, dependencies, and source information.

## Purpose & Direction
- **Inspection Only**: Read-only command; shows package details without modifying anything
- **Multi-Source**: Supports package names, paths, git URLs, tarballs
- **Local-First**: Searches local sources first (CWD → Workspace → Global → Registry)
- **Future-Ready**: Designed to support remote metadata fetching

## Command Syntax

```bash
opkg show <package>
```

Where `<package>` can be:
- Package name: `my-package`, `my-package@1.2.3`, `@scope/package`
- Path: `.`, `./path/to/package`, `/absolute/path`, `.openpackage/packages/pkg`
- Git URL: `git:https://github.com/user/repo.git#ref`, `github:user/repo#tag`
- Tarball: `./package.tgz`, `/path/to/package.tar.gz`

## Flow

### Local Package Show Flow

1. **Input Classification** (via `classifyPackageInput()`)
   - Detect input type: registry name, path, git URL, or tarball
   - Parse git specs, check path patterns, validate tarballs

2. **Package Resolution** (via `resolvePackageForShow()`)
   - **For names**: Use unified resolution (CWD → Workspace → Global → Registry)
   - **For paths**: Validate and resolve to absolute path
   - **For git URLs**: Clone repository to temp location
   - **For tarballs**: Validate tarball exists and is readable

3. **Information Collection** (via `collectPackageInfo()`)
   - Load `openpackage.yml` manifest
   - Discover all package files (filtered for junk)
   - Detect partial packages (from manifest flag or missing files)
   - Determine source mutability based on location

4. **Display Output** (via `displayPackageInfo()`)
   - Package metadata (name, version, description, etc.)
   - Source information (type, path, mutability)
   - Dependencies (packages and dev-packages)
   - File list (sorted, tree-style display)
   - Resolution info (if multiple candidates found)

## Resolution Priority

For package names, uses the same resolution strategy as `pack`:

```
Priority Order:
1. CWD (current directory, if name matches)
2. Workspace packages (.openpackage/packages/)
3. Global packages (~/.openpackage/packages/)
4. Local registry (~/.openpackage/registry/)
```

### Multi-Candidate Selection Rules

When multiple sources have the package:

1. **CWD match**: Always wins if checked and name matches
2. **Workspace override**: Always wins among non-CWD sources
3. **Version comparison**: Between global and registry, highest version wins
4. **Tie-breaker**: Same version prefers global (mutable) over registry (immutable)

### Resolution Information Display

When multiple candidates exist, show displays:
```
Resolved from multiple sources:
  ✓ workspace packages: 2.0.0
    global packages: 1.5.0
    local registry: 1.8.0
Selection reason: workspace packages always override
```

## Source Type Detection

| Location | Type | Mutable | Label |
|----------|------|---------|-------|
| Current directory (matching name) | `cwd` | Yes | "current directory" |
| `.openpackage/packages/` (workspace) | `workspace` | Yes | "workspace packages" |
| `~/.openpackage/packages/` (global) | `global` | Yes | "global packages" |
| `~/.openpackage/registry/` | `registry` | No | "local registry" |
| Git repository | `git` | No | "git repository" |
| Tarball file | `tarball` | No | "tarball" |
| Other path | `path` | Yes | "path" |

Mutability determines if the package can be modified via `save`/`add` commands.

## Display Format

### Standard Output

```
✓ Package: my-package
✓ Version: 1.2.3
✓ Source: workspace packages (.openpackage/packages/my-package)
✓ Type: mutable
✓ Description: Example package for demonstration
✓ Keywords: example, test, demo
✓ Author: John Doe
✓ License: MIT
✓ Homepage: https://example.com
✓ Repository: git - https://github.com/user/my-package.git
✓ Private: No
✓ Imported Packages (2):
  • dependency-one@^1.0.0 (compatible with 1.0.0 (^1.0.0))
  • dependency-two@~2.1.0 (compatible with 2.1.x (~2.1.0))
✓ Imported Dev Packages (1):
  • dev-tool@^3.0.0 (compatible with 3.0.0 (^3.0.0))
✓ Files: 15
   ├── commands/example.md
   ├── commands/helper.md
   ├── openpackage.yml
   ├── README.md
   ├── rules/code-style.md
   ├── ...
```

### Partial Package Indicator

```
✓ Partial: Yes
```

Shows when package is incomplete (e.g., partial pull from remote).

### Unversioned Packages

For packages without a version field:
```
✓ Package: dev-package
✓ Source: workspace packages (.openpackage/packages/dev-package)
✓ Type: mutable
✓ Description: Development version
```

Version line is omitted entirely.

## Examples

### Show by Package Name

```bash
opkg show my-package
```

Searches all local sources and displays the best match.

### Show Specific Version

```bash
opkg show my-package@1.2.3
```

Resolves to the specific version from registry or available sources.

### Show by Path

```bash
# Current directory
opkg show .

# Relative path
opkg show ./packages/shared-utils

# Workspace package path
opkg show .openpackage/packages/my-package

# Absolute path
opkg show /Users/me/projects/my-package
```

### Show from Git

```bash
# Full git URL
opkg show git:https://github.com/user/repo.git

# With branch/tag/commit
opkg show git:https://github.com/user/repo.git#main
opkg show git:https://github.com/user/repo.git#v1.0.0

# GitHub shorthand
opkg show github:user/repo
opkg show github:user/repo#develop
```

### Show from Tarball

```bash
opkg show ./downloaded-package.tgz
opkg show /path/to/package.tar.gz
```

## Options

Currently, show command has no options. Future options may include:

- `--remote`: Fetch from remote registry (skip local search)
- `--json`: Output in JSON format for scripting
- `--tree`: Display dependency tree
- `--files-only`: Show only file list
- `--download`: Download remote package for complete info (with remote support)

## Errors

### Package Not Found

```
Error: Package 'my-package' not found locally
```

Occurs when no local source has the package.

**Future**: Will suggest checking remote registry.

### Invalid Path

```
Error: Path './invalid' exists but is not a valid OpenPackage directory. 
Valid packages must contain openpackage.yml
```

Occurs when path doesn't contain a valid package.

### Git Clone Failure

```
Error: Git repository does not contain a valid OpenPackage (missing openpackage.yml)
```

Occurs when git URL doesn't point to a valid OpenPackage repository.

### Validation Error

```
Error: Failed to load package manifest from: /path/to/package
```

Occurs when `openpackage.yml` is malformed or missing.

## Integration Points

### Reuses Existing Infrastructure

- **Package Input Classification**: `classifyPackageInput()` from `package-input.ts`
- **Unified Resolution**: `resolvePackageByName()` from `package-name-resolution.ts`
- **Git Loading**: `loadPackageFromGit()` from `install/git-package-loader.ts`
- **Package Validation**: `isValidPackageDirectory()` from `package-context.ts`
- **File Discovery**: `packageManager.loadPackage()` from `package.ts`
- **Path Formatting**: `formatPathForDisplay()` from `formatters.ts`
- **Version Utilities**: `formatVersionLabel()`, `describeVersionRange()`, `isUnversionedVersion()`

### Used By

Currently standalone; future uses may include:
- Interactive package selector (before install)
- Package comparison tools
- Documentation generators

## Implementation Modules

Located in `src/core/show/`:

```
show/
├── show-types.ts           # Type definitions
├── package-resolver.ts     # Resolution logic (230 lines)
├── show-output.ts          # Display formatting (170 lines)
└── show-pipeline.ts        # Orchestration (115 lines)
```

### Module Responsibilities

**show-types.ts**
- Type definitions for show domain
- `ShowSourceType`, `ShowPackageSource`, `ShowPackageInfo`, `ShowResolutionInfo`

**package-resolver.ts**
- Main: `resolvePackageForShow(packageInput, cwd)`
- Handles all input types and resolution strategies
- Determines source type and mutability
- Converts resolution info to show-specific format

**show-output.ts**
- Main: `displayPackageInfo(info, cwd)`
- Helper: `displayResolutionInfo(info)`
- All console output formatting
- Dependency and file list display

**show-pipeline.ts**
- Main: `runShowPipeline(packageInput, cwd)`
- Orchestrates: resolve → collect → display
- Error handling and result packaging
- Returns `CommandResult`

## Testing

Test suite: `tests/show-command.test.ts`

Covers:
- ✅ Show workspace package by name
- ✅ Show package by relative path
- ✅ Show package from CWD
- ✅ Show registry package
- ✅ Show with version specifier
- ✅ Error handling for non-existent packages

## Future Enhancements

### Remote Support (Planned)

See [Show Remote Support](./show-remote.md) for detailed spec.

**Summary**:
- Metadata-only fetching by default (fast, lightweight)
- Optional `--download` flag for complete info
- Auto-fallback: local not found → try remote
- Clear indication of source (local vs remote)

**Example**:
```bash
opkg show community-package --remote
# Fetches metadata from remote registry (2-5 KB)
# Displays: name, version, size, timestamps, available versions
# Note: File list not available (metadata only)

opkg show community-package --remote --download
# Downloads full tarball to temp
# Displays: complete info including file list
# Cleans up temp files after display
```

### Additional Features (Future)

- **JSON Output**: `--json` for scripting and tooling integration
- **Comparison Mode**: `--compare` to show local vs remote differences
- **Dependency Tree**: `--tree` to visualize full dependency graph
- **File Preview**: `--preview <file>` to show file contents
- **Batch Show**: `opkg show pkg1 pkg2 pkg3` to show multiple packages

## Design Principles

1. **Read-Only**: Never modifies packages or system state
2. **Consistent**: Uses same resolution as pack (vs install which differs)
3. **Informative**: Shows source, mutability, and resolution details
4. **Fast**: Local operations are immediate
5. **Extensible**: Clean architecture for future features
6. **User-Friendly**: Clear output and helpful error messages

## Related Commands

- **pack**: Creates immutable snapshot; show can inspect before/after
- **install**: Materializes packages; show can inspect what's installed
- **status**: Compares workspace vs source; show displays source details
- **list**: Shows all packages; show displays one in detail

## Cross-References

- [Package Name Resolution](../pack/package-name-resolution.md) - Resolution strategy
- [Package Sources](../package-sources.md) - Source types and mutability
- [Commands Overview](../commands-overview.md) - All commands
- [CLI Options](../cli-options.md) - Global options
