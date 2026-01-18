### Apply – Behavior

#### 1. Definition

**Apply** (also referred to as platform apply/sync) projects a package’s canonical content into **platform-specific workspace locations** based on detected platforms and platform mapping rules.

Apply may be invoked:

- explicitly via `opkg apply`, or
- as a post-step of `opkg add --apply` (when adding new files before syncing platforms).

---

#### 2. Purpose

- Keep platform-specific working directories (e.g. `.cursor/`, `.opencode/`, etc.) consistent with the package’s canonical content.
- Ensure `openpackage.index.yml` reflects the **paths that actually exist** after apply.

---

#### 3. Operations

Apply distinguishes between:

- **Create / Update**: write new or changed files to platform-specific targets.
- **Delete**: remove stale files that were previously installed by the package but no longer exist in the package snapshot.

Apply runs against the set of platforms detected for the effective cwd.

---

#### 4. Timing

Apply only runs after:

- Package detection and name resolution are complete.
- File mapping/selection has succeeded.
- When invoked as `opkg add --apply`, the add step has completed successfully.

---

#### 5. Root Package Considerations

- Root packages may skip root-level “self mappings” (where a registry key would map to the exact same on-disk path) to avoid redundant index entries and no-op writes.
- Root file syncing (e.g., platform-specific root files) may be skipped for root packages when appropriate to avoid syncing “back into itself”.

Nested packages:

- Always participate fully in apply/sync when apply is requested; their changes are projected out to platform workspaces.

---

#### 6. Workspace-Level Apply

When `opkg apply` is invoked without a package name argument:

**Step 1: Apply workspace package** (if present in index)

- Checks if the workspace package (from `.openpackage/openpackage.yml` name field) exists in `openpackage.index.yml`
- If found, applies workspace files from `.openpackage/` directory to platform locations
- Uses the same flow-based mapping as regular packages (universal subdirectories → platform directories)

**Step 2: Apply all installed packages**

- Iterates through all packages in `openpackage.index.yml` (excluding the workspace package if already applied)
- Applies each package in sorted order by name
- Stops on first failure to prevent incomplete state

**Example:**

Given workspace with:
- `.openpackage/openpackage.yml` with `name: myproject`
- `.openpackage/commands/cleanup.md`
- Installed package `utils@1.0.0`

Running `opkg apply`:
```bash
$ opkg apply
✓ Applying 2 packages

✓ myproject (workspace)
✓ Updated files: 1
   └── .cursor/commands/cleanup.md

✓ utils@1.0.0
✓ Updated files: 3
   ...
```

**Behavior notes:**
- Workspace package is distinguished by `path: "./.openpackage"` in the index
- Execution order: workspace first, then alphabetically by package name
- Each package's apply operation is independent (uses its own platform flows)

---

#### 7. Error Reporting

Failures in apply are surfaced to the user as part of the command result, along with a summary of created/updated/removed paths.

See `conflicts.md` for how apply handles conflicts and interactive prompts.

