# Pack Command

`opkg pack` creates an immutable versioned snapshot from a mutable package source, copying to the local registry. It promotes dev work to distributable form, tying into save's WIP versioning.

## Purpose & Direction
- **Source → Registry**: Full dir copy to `~/.openpackage/registry/<name>/<version>/`.
- Preconditions: Mutable source (packages/ dir).
- Key: Makes package immutable; enables install/apply from registry path.

## Flow
1. Resolve package source path (from context or arg):
   - **Input Types**: Package name, absolute path, relative path
   - **Path Detection**: Inputs starting with `/`, `./`, `../`, or `~` are treated as paths
   - **Package Name Resolution** (for non-path inputs):
     - Priority: CWD → Workspace packages → Global packages
     - Skips registry (already immutable) and remote (not relevant)
     - See [Package Name Resolution](./package-name-resolution.md) for details
2. Read `openpackage.yml.version` → Target stable `S` (no bump).
3. Copy entire package root (payload rules) to registry/<name>/<S>/ (overwrite if exists).
4. Update workspace index `workspace.version = S`; refresh file mappings.
5. Clean this workspace's WIP versions for the package.
6. Idempotent: Re-pack same → same content.

## Versioning
- Uses exact `openpackage.yml.version` as stable.
- After pack, next `save` bumps to patch line for new WIP.
- See [Save Versioning](save/save-versioning.md).

## Options
- `--output <path>`: Copy directly to `<path>` (bypasses registry structure; `<path>` becomes root).
- `--dry-run`: Simulate without write.
- Global: `--cwd`, etc. (see [CLI Options](../cli-options.md)).

## Examples

### Pack from Current Directory
```bash
cd ~/projects/my-package
opkg pack                    # Packs CWD (no name needed)
opkg pack my-package         # Also packs CWD (name matches)
```

### Pack from Workspace or Global Packages
```bash
cd ~/my-workspace
opkg pack shared-component   # Finds in .openpackage/packages/ or ~/.openpackage/packages/
```

### Pack from Absolute Path
```bash
opkg pack /Users/user/projects/my-package    # Pack from absolute path
opkg pack ~/projects/my-package              # Pack from home directory path
```

### Pack from Relative Path
```bash
cd ~/workspace
opkg pack ./packages/shared-component        # Pack from relative path
opkg pack ../sibling-project                 # Pack from parent directory
```

Output: Shows created path, version, and source location.

## Errors
- **Package not found**: "Package 'X' not found. Searched: current directory, workspace packages, and global packages."
- **Invalid version**: Semver checks require valid semver in openpackage.yml
- **Missing manifest**: "openpackage.yml not found at [path]"
- **Invalid path**: "Path 'X' exists but is not a valid OpenPackage directory. Valid packages must contain openpackage.yml"
- **Tarball input**: "Pack command does not support tarball inputs. To pack from a tarball, first extract it to a directory."
- **Git input**: "Pack command does not support git inputs. To pack from a git repository, first clone it to a directory."

## Integration
- Called after iterative `save` (WIP → stable promotion).
- Payload excludes metadata (see [Registry Payload](../package/registry-payload-and-copy.md)).
- Enables `install <name>@<ver>` from new snapshot.

For impl: [Pack Pipeline](../core/pack/pack-pipeline.ts). Related: [Registry](registry.md), [Commands Overview](commands-overview.md).