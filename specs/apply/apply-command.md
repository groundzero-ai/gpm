### Apply – Command Contract

#### 1. Overview

`opkg apply` performs a platform apply/sync pass for a package in the **effective cwd** (shell cwd or `--cwd <dir>`).

It is the standalone way to (re)materialize package content into the workspace platforms and update the unified `.openpackage/openpackage.index.yml` mapping.

---

#### 2. Usage

- Apply workspace-level files and all installed packages:
  - `opkg apply`
  - Applies workspace files from `.openpackage/` (if present) first, then applies all packages from the workspace index
- Apply a specific package by name:
  - `opkg apply <package-name>`
  - Can target the workspace package by using its name from `.openpackage/openpackage.yml`

> **Workspace-level apply**: When no package name is specified, `opkg apply` operates on both the workspace package (`.openpackage/` directory) and all installed packages from `openpackage.index.yml`. This ensures project-specific content and dependencies stay in sync with their sources.

> Package resolution follows the same context detection rules as other pipelines: if `<package-name>` matches the root package, apply targets the root package; otherwise it targets a nested package when found.

---

#### 3. Flags

- `--force`
  - Overwrites on conflicts (equivalent to `conflictStrategy=overwrite`).
- `--dry-run`
  - Plans apply/sync operations without writing files or updating the package index.

Global:

- `--cwd <dir>`
  - Changes the effective cwd for package detection and apply targets. See `../cli-options.md`.

---

#### 4. Output

Apply prints:

- A summary header (`Applied <name>@<version> ...`).
- The list of package files considered.
- A platform sync summary (created/updated/removed file paths) when operations occur.

---

#### 5. Related

- `apply-behavior.md` – details of what is created/updated/deleted.
- `conflicts.md` – conflict prompting rules and strategies.
- `index-effects.md` – how `openpackage.index.yml` changes after apply.

