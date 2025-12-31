### Save Pipeline Specs

This directory contains specifications for the **`save` behavior** in the model:

- `opkg save`: **Workspace → Source** (sync workspace edits back to a mutable package source)

These docs are **behavioral**: they describe features and logic, not specific modules or functions.

Key integration: Save ops use effective cwd (shell or --cwd; see [../../cli-options.md]) for workspace/package detection.

---

#### Pipeline Flow

`save` executes in this order:

1. **Read workspace index** → Load `.openpackage/openpackage.index.yml` and find mappings for the package
2. **Resolve package source** → Determine the source-of-truth path (`path:`/`git:`/registry) for the package
3. **Enforce mutability** → `save` must fail for immutable sources (registry paths)
4. **Build candidates from mappings** → Collect workspace candidates for the mapped file/dir keys
5. **Parity checking** → Auto-skip candidates that already match source (universal or platform-specific)
6. **Conflict resolution** → For remaining candidates, choose which workspace candidate becomes universal and which become platform-specific
7. **Write back to source** → Update the package source tree with resolved content

---

#### Files

| File | Topic |
|------|-------|
| `save-modes-inputs.md` | Overview, inputs, modes, and flags |
| `save-versioning.md` | WIP prerelease scheme, save/pack computation, invariants |
| `save-conflict-resolution.md` | Conflict resolution rules and platform-specific selection |
| `save-frontmatter-overrides.md` | Markdown frontmatter extraction and YAML overrides (when applicable) |
| `save-registry-sync.md` | Save-to-source specifics: mutability, mapping-driven writes, and error cases |

---

#### Related Documents

- [Commands Overview](../commands-overview.md) – High-level `save` vs. `pack` split and flows.
- `save-versioning.md` – WIP prerelease scheme, computation, and pack promotion.
- `../package/package-index-yml.md` – Unified workspace index schema used by `save`.
- [Package Sources](../package-sources.md) – Mutability enforcement during resolution.
