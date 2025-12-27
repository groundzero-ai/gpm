### Save Pipeline Specs

This directory contains specifications for the **save pipeline** that powers both the `save` (WIP) and `pack` (stable) commands.

These docs are **behavioral**: they describe features and logic, not specific modules or functions.

Key integration: Save ops use effective cwd (shell or --cwd; see [../../cli-options.md]) for workspace/package detection.

---

#### Pipeline Flow

The save pipeline executes in this order:

1. **Modes & Inputs** → Determine WIP vs stable mode and parse flags
2. **Package Detection** → Find the target package context
3. **Naming & Scoping** → Resolve final name, handle renames
4. **File Discovery** → Discover candidate files from local and workspace
5. **Conflict Resolution** → Decide which content wins for each path
6. **Frontmatter & Overrides** → Handle markdown metadata and platform overrides
7. **Registry & Apply** → Write to registry, cleanup, and optionally apply/sync to platforms

---

#### Files

| File | Topic |
|------|-------|
| `save-modes-inputs.md` | Overview, WIP vs stable modes, inputs, and flags |
| `save-package-detection.md` | How the pipeline detects which package to operate on |
| `save-naming-scoping.md` | Name resolution, scoping decisions, and workspace renames |
| `save-file-discovery.md` | Candidate sources, first vs subsequent saves, grouping |
| `save-conflict-resolution.md` | Conflict resolution rules and platform-specific selection |
| `save-frontmatter-overrides.md` | Markdown frontmatter extraction and YAML overrides |
| `save-registry-sync.md` | Registry writes and WIP cleanup (see `../apply/` for apply/sync behavior) |

---

#### Related Documents

- `../save-pack.md` – High‑level split between `save` and `pack` commands.
- `../save-pack-versioning.md` – Detailed versioning rules for WIP and stable versions.
