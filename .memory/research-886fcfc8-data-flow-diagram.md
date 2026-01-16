# Research: OpenPackage Data Flow State Machine

**Date:** 2026-01-16  
**Hash ID:** 886fcfc8  
**Type:** ASCII State Machine Diagram

## Summary

Visual representation of data flow through the OpenPackage system, showing how packages transition through different states and the operations that trigger state changes.

---

## Complete State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPENPACKAGE STATE MACHINE                             │
│                                                                              │
│  States: [CREATED] [WORKSPACE] [PACKED] [PUBLISHED] [INSTALLED] [APPLIED]  │
│  Sources: Registry, Git, Local Path, Global Path                            │
└─────────────────────────────────────────────────────────────────────────────┘

                           ╔═══════════════╗
                           ║ opkg new      ║
                           ║ <name>        ║
                           ╚═══════╤═══════╝
                                   │
                                   ↓
                           ┌───────────────┐
                           │   [CREATED]   │◄─────────────┐
                           │  Empty Shell  │              │
                           └───────┬───────┘              │
                                   │                      │
                      ╔════════════↓════════════╗         │
                      ║ Developer adds files    ║         │
                      ║ in universal/* dirs     ║         │
                      ╚════════════╤════════════╝         │
                                   │                      │
                                   ↓                      │
                    ╔══════════════════════════╗          │
                    ║ opkg save <name>         ║          │
                    ║ [Versioning System]      ║          │
                    ║ - WIP: base62 timestamp  ║          │
                    ║ - Stable: semver         ║          │
                    ╚═══════════╤══════════════╝          │
                                │                         │
                                ↓                         │
                    ┌───────────────────────┐             │
                    │   [WORKSPACE]         │             │
                    │   Mutable Source      │             │
        ┌───────────┤   Location:           │             │
        │           │   • .openpackage/     │             │
        │           │   • ~/.../global/     │             │
        │           └───────┬───────────────┘             │
        │                   │                             │
        │                   │                             │
        │  ╔════════════════↓════════════╗                │
        │  ║ opkg add <file>             ║                │
        │  ║ opkg remove <file>          ║                │
        │  ║ opkg set <field>=<value>    ║                │
        │  ╚════════════════╤════════════╝                │
        │                   │                             │
        └───────────────────┘                             │
                            │                             │
              ╔═════════════↓═════════════╗               │
              ║ opkg pack <name>          ║               │
              ║ [Tarball Creation]        ║               │
              ║ - Validate manifest       ║               │
              ║ - Bundle files            ║               │
              ║ - Generate .tgz           ║               │
              ╚═════════════╤═════════════╝               │
                            │                             │
                            ↓                             │
                  ┌─────────────────┐                     │
                  │    [PACKED]     │                     │
                  │  .tgz Archive   │                     │
                  └─────────┬───────┘                     │
                            │                             │
              ╔═════════════↓═════════════╗               │
              ║ opkg push <name>@<ver>    ║               │
              ║ [Registry Upload]         ║               │
              ║ - Authenticate            ║               │
              ║ - Upload tarball          ║               │
              ║ - Publish metadata        ║               │
              ╚═════════════╤═════════════╝               │
                            │                             │
                            ↓                             │
                  ┌─────────────────┐                     │
                  │   [PUBLISHED]   │                     │
                  │  Immutable      │                     │
                  │  Registry       │                     │
                  └─────────┬───────┘                     │
                            │                             │
                            │                             │
          ┌─────────────────┼─────────────────┬───────────┘
          │                 │                 │
          │  ╔══════════════↓══════════╗      │
          │  ║ opkg pull <name>@<ver>  ║      │
          │  ║ [Download Only]         ║      │
          │  ║ - Fetch from registry   ║      │
          │  ║ - Extract to workspace  ║      │
          │  ║ - No installation       ║      │
          │  ╚══════════════╤══════════╝      │
          │                 │                 │
          └─────────────────┘                 │
                            │                 │
          ╔═════════════════↓═════════════════↓═══════════════════╗
          ║ opkg install <name>@<ver>                             ║
          ║ [Multi-Source Resolution]                             ║
          ║                                                        ║
          ║  Priority:                                             ║
          ║  1. Explicit path (--path)                            ║
          ║  2. Workspace (.openpackage/)                         ║
          ║  3. Global (~/.openpackage/global/)                   ║
          ║  4. Git (github:user/repo)                            ║
          ║  5. Registry (remote)                                 ║
          ║                                                        ║
          ║  Process:                                              ║
          ║  → Resolve source                                      ║
          ║  → Select version (semver)                             ║
          ║  → Resolve dependencies (recursive)                    ║
          ║  → Apply platform flows                                ║
          ║  → Install files to workspace                          ║
          ║  → Update workspace index                              ║
          ╚═════════════════╤══════════════════════════════════════╝
                            │
                            ↓
                  ┌─────────────────┐
                  │   [INSTALLED]   │
                  │  In Workspace   │
                  │  Index Tracked  │
                  └─────────┬───────┘
                            │
              ╔═════════════↓═════════════╗
              ║ opkg apply <name>         ║
              ║ [Activation]              ║
              ║ - Copy to target dirs     ║
              ║ - Merge root files        ║
              ║ - Apply transforms        ║
              ╚═════════════╤═════════════╝
                            │
                            ↓
                  ┌─────────────────┐
                  │    [APPLIED]    │
                  │  Active in      │
                  │  Platform       │
                  └─────────────────┘
                            │
                            │
              ╔═════════════↓═════════════╗
              ║ opkg uninstall <name>     ║
              ║ [Removal]                 ║
              ║ - Remove files            ║
              ║ - Clean merged keys       ║
              ║ - Update index            ║
              ╚═════════════╤═════════════╝
                            │
                            ↓
                  ┌─────────────────┐
                  │   [REMOVED]     │
                  │  Clean State    │
                  └─────────────────┘
```

---

## Flow Transformation Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                       FLOW-BASED TRANSFORMATION                         │
│                                                                         │
│  Universal Format → Platform-Specific Format                            │
└────────────────────────────────────────────────────────────────────────┘

Input File (Universal)
    │
    │  package/universal/rules/my-rule.md
    │
    ↓
┌─────────────────────┐
│  Format Detection   │
│  - YAML             │
│  - JSON             │
│  - JSONC            │
│  - TOML             │
│  - Markdown         │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Platform Lookup    │
│  platforms.jsonc    │
│  → flows config     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Map Pipeline Execution                                      │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   $set       │   │   $rename    │   │   $unset     │   │
│  │ Set fields   │→→ │ Rename keys  │→→ │ Remove keys  │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│         ↓                   ↓                   ↓          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   $switch    │   │  $pipeline   │   │   $copy      │   │
│  │ Pattern swap │→→ │ Multi-step   │→→ │ Duplicate    │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│         ↓                                                   │
│  ┌──────────────┐                                          │
│  │   $pipe      │                                          │
│  │ Registry ops │                                          │
│  └──────────────┘                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
                   ┌─────────────────┐
                   │ Format Convert  │
                   │ YAML → JSON     │
                   │ JSON → TOML     │
                   └────────┬────────┘
                            │
                            ↓
                   ┌─────────────────┐
                   │  Path Mapping   │
                   │  → Target dir   │
                   │  → Target name  │
                   └────────┬────────┘
                            │
                            ↓
              Output File (Platform-Specific)
                 claude/rules/my-rule.md
```

---

## Version Resolution Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                       VERSION RESOLUTION SYSTEM                         │
└────────────────────────────────────────────────────────────────────────┘

User Input: "opkg install my-package@^1.0.0"
    │
    ↓
┌─────────────────────────────────────────────────────────┐
│  Parse Constraint                                        │
│  • Exact: 1.0.0                                          │
│  • Caret: ^1.0.0 (minor/patch updates)                  │
│  • Tilde: ~1.0.0 (patch updates only)                   │
│  • Range: >=1.0.0 <2.0.0                                │
│  • Latest: * or "latest"                                │
│  • WIP: 1.0.0-wip.XYZ                                   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ↓
         ┌───────────────────┴───────────────────┐
         │                                       │
         ↓                                       ↓
┌─────────────────┐                    ┌─────────────────┐
│ Local Sources   │                    │ Remote Registry │
│                 │                    │                 │
│ • Workspace     │                    │ • List versions │
│ • Global        │                    │ • Filter by     │
│ • Git cache     │                    │   constraint    │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         └───────────────┬──────────────────────┘
                         │
                         ↓
              ┌────────────────────┐
              │  Merge & Sort      │
              │  • Deduplicate     │
              │  • Semver sort     │
              │  • Stable first    │
              └─────────┬──────────┘
                        │
                        ↓
              ┌────────────────────┐
              │  Apply Policy      │
              │  • Stable preferred│
              │  • Pre-release opt │
              │  • Latest wins     │
              └─────────┬──────────┘
                        │
                        ↓
              ┌────────────────────┐
              │  Select Best Match │
              │  → version         │
              │  → source          │
              └─────────┬──────────┘
                        │
                        ↓
                Install version from source
```

---

## Dependency Resolution Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                       DEPENDENCY RESOLUTION                             │
└────────────────────────────────────────────────────────────────────────┘

opkg install my-app
    │
    ↓
Read: .openpackage/my-app/openpackage.yml
    │
    │  dependencies:
    │    ui-components: ^2.0.0
    │    utils: github:org/utils
    │    theme: file:../shared/theme
    │
    ↓
┌────────────────────────────────────────────┐
│  Build Dependency Tree                     │
│                                            │
│       my-app@1.0.0                         │
│       ├── ui-components@^2.0.0             │
│       │   └── icons@~1.5.0                 │
│       ├── utils@github:org/utils           │
│       └── theme@file:../shared/theme       │
│           └── colors@1.2.0                 │
└────────────────┬───────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────┐
│  Resolve Each Dependency (Recursive)       │
│                                            │
│  For each dep:                             │
│    1. Classify source type                 │
│    2. Resolve version/ref                  │
│    3. Check for conflicts                  │
│    4. Fetch package                        │
│    5. Read its dependencies                │
│    6. Repeat recursively                   │
└────────────────┬───────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────┐
│  Flatten & Deduplicate                     │
│                                            │
│  Conflict Resolution:                      │
│    • Same package, different versions      │
│    • Choose highest compatible             │
│    • Error on incompatible ranges          │
└────────────────┬───────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────┐
│  Install Order                             │
│                                            │
│  Bottom-up (dependencies first):           │
│    1. icons@1.5.0                          │
│    2. colors@1.2.0                         │
│    3. ui-components@2.1.0                  │
│    4. utils@git-sha                        │
│    5. theme@local                          │
│    6. my-app@1.0.0                         │
└────────────────┬───────────────────────────┘
                 │
                 ↓
        All packages installed!
```

---

## Workspace Index Management

```
┌────────────────────────────────────────────────────────────────────────┐
│                    WORKSPACE INDEX TRACKING                             │
│                                                                         │
│  File: .openpackage/openpackage.index.yml                              │
└────────────────────────────────────────────────────────────────────────┘

On Install:
    │
    ↓
┌──────────────────────────────────┐
│  Track Package Files             │
│                                  │
│  packages:                       │
│    my-package@1.0.0:             │
│      files:                      │
│        "claude/rules/x.md": ...  │
│        "cursor/rules/x.md": ...  │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Track Merged File Keys          │
│                                  │
│  For root files like:            │
│    .cursorrules (merged)         │
│                                  │
│  keys:                           │
│    ".cursorrules":               │
│      - "pkg-a@1.0.0"             │
│      - "pkg-b@2.0.0"             │
│                                  │
│  Enables surgical removal!       │
└────────────┬─────────────────────┘
             │
             ↓
On Uninstall:
    │
    ↓
┌──────────────────────────────────┐
│  Remove Package Files            │
│                                  │
│  1. Read index entry             │
│  2. Delete each tracked file     │
│  3. For merged files:            │
│     - Load file                  │
│     - Remove package keys        │
│     - Write back                 │
│  4. Clean empty directories      │
│  5. Update index                 │
└──────────────────────────────────┘
```

---

## Platform Detection & Selection

```
┌────────────────────────────────────────────────────────────────────────┐
│                       PLATFORM DETECTION                                │
└────────────────────────────────────────────────────────────────────────┘

On opkg install (no --platform flag):
    │
    ↓
┌──────────────────────────────────┐
│  Scan Workspace                  │
│                                  │
│  Look for:                       │
│    • .claude/                    │
│    • .cursor/                    │
│    • .windsurf/                  │
│    • .cline/                     │
│    • etc.                        │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Detect Platform(s)              │
│                                  │
│  Found: ["claude", "cursor"]     │
└────────────┬─────────────────────┘
             │
             ↓
    ┌────────┴─────────┐
    │                  │
    ↓                  ↓
Multiple?          Single?
    │                  │
    ↓                  ↓
┌─────────┐      ┌──────────┐
│ Prompt  │      │ Auto-    │
│ User to │      │ select   │
│ Choose  │      │ platform │
└─────────┘      └──────────┘
    │                  │
    └────────┬─────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Apply Platform Flows            │
│                                  │
│  Load: platforms.jsonc           │
│  Execute: transform pipeline     │
│  Install: to platform dirs       │
└──────────────────────────────────┘
```

---

## Git Source Caching

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GIT CACHE SYSTEM                               │
└────────────────────────────────────────────────────────────────────────┘

opkg install github:user/repo#branch:subdir
    │
    ↓
┌──────────────────────────────────┐
│  Parse Git URL                   │
│                                  │
│  • Remote: github.com/user/repo  │
│  • Ref: branch                   │
│  • Subdir: subdir                │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Generate Cache Key              │
│                                  │
│  Hash = sha256(normalized_url)   │
│  Path = ~/.../cache/git/<hash>   │
└────────────┬─────────────────────┘
             │
             ↓
      ┌──────┴──────┐
      │             │
      ↓             ↓
Cache Hit?      Cache Miss?
      │             │
      ↓             ↓
┌──────────┐   ┌─────────────┐
│ Read     │   │ Clone Repo  │
│ Cached   │   │ Shallow:    │
│ Metadata │   │ depth=1     │
└────┬─────┘   └──────┬──────┘
     │                │
     │                ↓
     │         ┌─────────────┐
     │         │ Save        │
     │         │ Metadata    │
     │         │ • url       │
     │         │ • ref       │
     │         │ • sha       │
     │         │ • time      │
     │         └──────┬──────┘
     │                │
     └────────┬───────┘
              │
              ↓
┌──────────────────────────────────┐
│  Extract Subdir (if specified)   │
│                                  │
│  Copy: cache/git/hash/subdir/    │
│  To:   .openpackage/<pkg>/       │
└──────────────────────────────────┘
              │
              ↓
         Proceed with install
```

---

## Root File Merging Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                       ROOT FILE MERGING                                 │
│                                                                         │
│  Example: Multiple packages contribute to .cursorrules                  │
└────────────────────────────────────────────────────────────────────────┘

Package A: .cursorrules content
Package B: .cursorrules content
    │
    ↓
┌──────────────────────────────────┐
│  Merge Strategy Selection        │
│                                  │
│  Options:                        │
│  • merge (default): combine      │
│  • replace: last wins            │
│  • skip: don't overwrite         │
└────────────┬─────────────────────┘
             │
             ↓  (merge selected)
┌──────────────────────────────────┐
│  Read Existing .cursorrules      │
│                                  │
│  Current keys tracked:           │
│    pkg-base@1.0.0                │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Append New Content              │
│                                  │
│  From pkg-a@2.0.0:               │
│    Add rules X, Y, Z             │
│                                  │
│  Track: "pkg-a@2.0.0" added      │
│  keys: ["ruleX", "ruleY", ...]   │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Write Merged File               │
│                                  │
│  .cursorrules now contains:      │
│    • Base rules (pkg-base)       │
│    • New rules (pkg-a)           │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Update Index                    │
│                                  │
│  keys:                           │
│    ".cursorrules":               │
│      - "pkg-base@1.0.0"          │
│      - "pkg-a@2.0.0"             │
└──────────────────────────────────┘
             │
             ↓
On Uninstall pkg-a:
    │
    ↓
┌──────────────────────────────────┐
│  Surgical Removal                │
│                                  │
│  1. Load .cursorrules            │
│  2. Remove keys from pkg-a       │
│  3. Keep keys from pkg-base      │
│  4. Write back                   │
│  5. Update index                 │
└──────────────────────────────────┘
```

---

## Error Handling Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING                                  │
└────────────────────────────────────────────────────────────────────────┘

Any Operation
    │
    ↓
┌──────────────────────────────────┐
│  Try Operation                   │
└────────────┬─────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ↓             ↓
  Success?      Error?
      │             │
      ↓             ↓
┌──────────┐   ┌─────────────────────┐
│ Return   │   │ Classify Error      │
│ Result   │   │                     │
└──────────┘   │ • Network error     │
               │ • Auth error        │
               │ • Validation error  │
               │ • Conflict error    │
               │ • Not found error   │
               │ • Permission error  │
               └──────┬──────────────┘
                      │
                      ↓
               ┌─────────────────────┐
               │ Format Error Message│
               │                     │
               │ Include:            │
               │ • What failed       │
               │ • Why it failed     │
               │ • How to fix        │
               └──────┬──────────────┘
                      │
                      ↓
               ┌─────────────────────┐
               │ Rollback if Needed  │
               │                     │
               │ • Restore files     │
               │ • Clean temp data   │
               │ • Revert index      │
               └──────┬──────────────┘
                      │
                      ↓
               ┌─────────────────────┐
               │ Exit with Code      │
               │                     │
               │ 0 = success         │
               │ 1 = error           │
               └─────────────────────┘
```

---

## References

- Related Research: [Codebase Analysis](research-b603792d-codebase-analysis.md)
- Specifications: `./specs/architecture.md`
- Flow Documentation: `./specs/platforms/map-pipeline.md`
