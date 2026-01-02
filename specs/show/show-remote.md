# Show Remote Support

Specification for remote package metadata display in the `show` command.

## Overview

Remote support allows users to inspect packages from the remote registry without downloading them. This is useful for:
- **Discovery**: Browse available packages before installing
- **Verification**: Check package details before committing to download
- **Comparison**: See what's available remotely vs locally
- **Access Check**: Verify authentication and permissions

## Design Goals

1. **Fast by Default**: Metadata-only fetching (2-5 KB, ~200-500ms)
2. **Bandwidth Efficient**: Don't download tarballs unless requested
3. **Optional Completeness**: Allow full download for file list if needed
4. **Clear UX**: Indicate source (local vs remote) and limitations
5. **Consistent API**: Reuse existing remote-pull infrastructure

## Command Syntax

```bash
# Default: Local search first, fall back to remote if not found
opkg show <package>

# Force remote lookup (skip local search)
opkg show <package> --remote

# Remote with full download (for complete info)
opkg show <package> --remote --download

# Authentication options
opkg show <package> --remote --profile <profile>
opkg show <package> --remote --api-key <key>
```

## Behavior Modes

### Mode 1: Default (Local-First)

```bash
opkg show my-package
```

**Flow**:
1. Search local sources (CWD → Workspace → Global → Registry)
2. If found: Display local package info (current behavior)
3. If not found: Display message and try remote
4. If remote found: Display remote metadata
5. If remote not found: Error

**Output Example**:
```
⚠️  Package 'my-package' not found locally
💡 Checking remote registry...

✓ Package: my-package
✓ Version: 1.2.3
✓ Source: remote registry (https://registry.openpackage.dev)
✓ Type: immutable (remote)
✓ Description: Example package
✓ Keywords: example, demo
✓ Private: No
✓ Tarball Size: 2.45 MB
✓ Created: 2025-12-01 10:30:00
✓ Updated: 2025-12-15 14:20:00
✓ Available Versions (15):
  • 1.2.3 (current)
  • 1.2.2
  • 1.2.1
  • ...
✓ Download Access: Yes

💡 To install this package locally, run:
   opkg install my-package@1.2.3
```

**Note**: File list not available (metadata only).

### Mode 2: Remote-Only

```bash
opkg show my-package --remote
```

**Flow**:
1. Skip local search entirely
2. Fetch remote metadata
3. Display remote package info

**Use Case**: 
- Check latest remote version even if local copy exists
- Verify what's published vs what's local
- Check remote availability before pushing

### Mode 3: Remote with Download

```bash
opkg show my-package --remote --download
```

**Flow**:
1. Fetch remote metadata
2. Download tarball to temp directory
3. Extract and display complete info (including file list)
4. Clean up temp files

**Output Includes**:
- All metadata fields
- Complete file list
- Dependencies from manifest
- All fields that local show displays

**Use Case**:
- Need to see file list before installing
- Inspect package structure remotely
- Verify contents match expectations

## Remote Metadata Structure

Based on `/packages/pull/by-name/{name}` endpoint:

### Available in Metadata Response

✅ **Package Info**:
- `name`: Package name
- `description`: Description text
- `keywords`: Array of keywords
- `isPrivate`: Privacy flag
- `createdAt`: Package creation timestamp
- `updatedAt`: Last update timestamp

✅ **Version Info**:
- `version`: Version number
- `tarballSize`: Size in bytes
- `createdAt`: Version creation timestamp
- `updatedAt`: Version update timestamp

✅ **Availability**:
- `availableVersions`: Array of version strings
- `downloadUrl`: Present if user has access
- `downloads`: Array of download info

### NOT Available in Metadata

❌ **File List**: Not included in metadata response
❌ **File Contents**: Not included in metadata response
❌ **Dependencies**: Only in manifest inside tarball
❌ **Full openpackage.yml**: Only in tarball

## Display Format

### Metadata-Only Display

```
✓ Package: <name>
✓ Version: <version>
✓ Source: remote registry (<registry-url>)
✓ Type: immutable (remote)
✓ Description: <description>
✓ Keywords: <keywords>
✓ Private: <Yes/No>
✓ Tarball Size: <size in MB>
✓ Created: <formatted-timestamp>
✓ Updated: <formatted-timestamp>
✓ Available Versions (<count>):
  • <version> (current)
  • <version>
  • ...
✓ Download Access: <Yes/No>

⚠️  File list not available (metadata only)
💡 Use --download flag to see complete package details
💡 To install this package locally, run:
   opkg install <name>@<version>
```

### With Download Display

Same as local show, plus:
```
✓ Source: remote registry (downloaded)
```

All fields from local show are available.

## Implementation Architecture

### Module: `src/core/show/show-remote.ts` (New)

```typescript
/**
 * Remote package display for show command
 */

export interface ShowRemoteOptions {
  download?: boolean;
  profile?: string;
  apiKey?: string;
}

/**
 * Show package from remote registry
 * 
 * @param packageName - Package name
 * @param version - Optional version
 * @param options - Remote options
 */
export async function showRemotePackage(
  packageName: string,
  version: string | undefined,
  options: ShowRemoteOptions
): Promise<CommandResult>

/**
 * Display remote metadata-only information
 */
function displayRemoteMetadata(
  response: PullPackageResponse,
  registryUrl: string
): void

/**
 * Download and display complete remote package info
 */
async function showRemoteWithDownload(
  metadata: RemotePackageMetadataSuccess,
  options: ShowRemoteOptions
): Promise<CommandResult>
```

### Integration Points

Reuses existing infrastructure:
- `fetchRemotePackageMetadata()` from `remote-pull.ts`
- `downloadPackageTarball()` from `remote-pull.ts`
- `extractPackageFromTarball()` from `tarball.ts`
- `authManager` for authentication
- `createHttpClient()` for HTTP requests

### Flow Diagram

```
show-pipeline.ts
    ↓
[Local search enabled?]
    ├─ Yes → Try local resolution
    │   ├─ Found → Display local
    │   └─ Not found → Fall back to remote
    └─ No (--remote flag) → Skip to remote

[Remote fetch]
    ↓
fetchRemotePackageMetadata()
    ↓
[--download flag?]
    ├─ Yes → Download tarball to temp
    │   ├─ Extract files
    │   ├─ Display complete info
    │   └─ Cleanup temp
    └─ No → Display metadata only
```

## Error Handling

### Network Errors

```
Error: Network error while fetching package 'my-package': fetch failed
```

User-friendly message for connectivity issues.

### Not Found

```
Error: Package 'my-package' not found in remote registry
```

Clear 404 handling.

### Access Denied

```
Error: Access denied to package 'my-package'. You may need to login or use a different profile.
```

Handles 401/403 with authentication hints.

### Authentication Required

```
Error: Remote registry requires authentication. Run:
   opkg login
```

Prompts user to authenticate.

## Performance Considerations

### Metadata-Only (Default)

| Metric | Value |
|--------|-------|
| Network I/O | 2-5 KB |
| Latency | 200-500ms |
| Disk I/O | None |
| Memory | Minimal (~1 MB) |

Fast enough for interactive use.

### With Download

| Metric | Value |
|--------|-------|
| Network I/O | 100 KB - 10 MB+ (tarball size) |
| Latency | 1-10s+ (depends on size) |
| Disk I/O | Write to temp, then delete |
| Memory | Tarball size + extraction (~2-3x) |

Slower but provides complete information.

## User Experience

### Discovery Workflow

```bash
# 1. Check if package exists remotely
opkg show new-tool --remote

# 2. See if it has what I need (metadata only)
# → Check description, keywords, size

# 3. Need more details? Download for file list
opkg show new-tool --remote --download

# 4. Satisfied? Install it
opkg install new-tool
```

### Comparison Workflow

```bash
# Check local version
opkg show my-package

# Check remote version
opkg show my-package --remote

# Compare output manually or with diff
```

## Future Enhancements

### JSON Output Mode

```bash
opkg show my-package --remote --json > metadata.json
```

Enables scripting and tool integration.

### Comparison Mode

```bash
opkg show my-package --compare
```

Automatically shows local vs remote side-by-side.

### Batch Show

```bash
opkg show pkg1 pkg2 pkg3 --remote
```

Show multiple packages in one command.

### Cache Metadata

Cache remote metadata responses for faster repeated queries:
- Cache duration: 5-15 minutes
- Cache location: `~/.openpackage/cache/metadata/`
- Invalidation: Manual or time-based

## Testing Strategy

### Unit Tests
- Remote metadata fetching
- Error handling (not found, access denied, network)
- Display formatting (metadata-only)
- Download and display (with temp cleanup)

### Integration Tests
- End-to-end remote show
- Authentication scenarios
- Fallback from local to remote
- Download mode with extraction

### Manual Testing
- Various package types (public, private, scoped)
- Different registry configurations
- Network failure scenarios
- Large packages (download mode)

## Security Considerations

1. **Authentication**: Uses existing auth infrastructure (profiles, API keys)
2. **HTTPS Only**: All remote requests over HTTPS
3. **No Arbitrary Downloads**: Only downloads from configured registry
4. **Temp File Cleanup**: Always cleanup temp files, even on error
5. **Input Validation**: Validate package names before remote fetch

## Rollout Plan

### Phase 1: Metadata-Only (Recommended First)
- Implement `--remote` flag
- Metadata-only display
- Auto-fallback from local to remote
- Basic error handling

### Phase 2: Download Support
- Implement `--download` flag
- Temp file management
- Complete display with file list

### Phase 3: Enhancements
- JSON output mode
- Comparison mode
- Metadata caching

## Related Specs

- [Show Command](./README.md) - Main show command spec
- [Install Behavior](../install/install-behavior.md) - Remote resolution patterns
- [Registry](../registry.md) - Registry structure
- [Package Sources](../package-sources.md) - Source types

## Examples

### Public Package

```bash
opkg show lodash --remote

✓ Package: lodash
✓ Version: 4.17.21
✓ Source: remote registry (https://registry.openpackage.dev)
✓ Type: immutable (remote)
✓ Description: Lodash modular utilities
✓ Keywords: modules, stdlib, util
✓ Private: No
✓ Tarball Size: 1.2 MB
✓ Created: 2024-01-15 09:00:00
✓ Updated: 2024-06-20 14:30:00
✓ Available Versions (50):
  • 4.17.21 (current)
  • 4.17.20
  • ...
✓ Download Access: Yes
```

### Private Package (With Auth)

```bash
opkg show @company/internal-tool --remote --profile work

✓ Package: @company/internal-tool
✓ Version: 2.1.0
✓ Source: remote registry (https://registry.openpackage.dev)
✓ Type: immutable (remote)
✓ Private: Yes
✓ Tarball Size: 512 KB
✓ Download Access: Yes
```

### Package Not Found

```bash
opkg show non-existent --remote

Error: Package 'non-existent' not found in remote registry
```

### Network Error

```bash
opkg show my-package --remote

Error: Network error while fetching package 'my-package': fetch failed
```

Retry or check connection.
