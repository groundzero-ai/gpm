# Platform Directory Layout

## Overview

Each platform defines how files are organized on disk through its **root directory**, optional **root file**, and transformation **flows**. This document explains the physical file organization for platforms.

## Root Directories

Every platform has a **root directory** where platform-specific files live.

### Built-in Root Directories

| Platform | Root Directory | Description |
|----------|----------------|-------------|
| Cursor | `.cursor` | Cursor editor configuration |
| Claude | `.claude` | Claude Code configuration |
| Windsurf | `.windsurf` | Windsurf IDE configuration |
| Gemini | `.gemini` | Google Gemini Code configuration |
| Kilo | `.kilo` | Kilo Code configuration |
| Cline | `.cline` | Cline configuration |
| Roo-Code | `.roo` | Roo-Code configuration |
| Void | `.void` | Void configuration |
| Aide | `.aide` | Aide configuration |
| Zed | `.zed` | Zed editor configuration |
| Codex | `.codex` | Codex configuration |
| OpenCode | `.opencode` | OpenCode configuration |
| Factory | `.factory` | Factory configuration |

### Custom Root Directories

Override in configuration:

```jsonc
{
  "cursor": {
    "rootDir": ".cursor-custom"
  }
}
```

**Use cases:**
- Monorepo with multiple workspaces
- Testing different configurations
- Legacy directory structures

## Root Files

Some platforms define a **root file** at the project root (not inside platform directory).

### Built-in Root Files

| Platform | Root File | Purpose |
|----------|-----------|---------|
| Claude | `CLAUDE.md` | Claude instructions/context |
| Gemini | `GEMINI.md` | Gemini configuration |
| Qwen | `QWEN.md` | Qwen instructions |
| Warp | `WARP.md` | Warp configuration |

### Universal Root File

**`AGENTS.md`** is universal (not platform-specific):

```bash
project/
├── AGENTS.md      # Universal, all platforms
├── CLAUDE.md      # Claude-specific
└── .cursor/
```

**Typically defined in global flows:**
```jsonc
{
  "global": {
    "flows": [
      { "from": "AGENTS.md", "to": "AGENTS.md" }
    ]
  }
}
```

## Directory Structure Examples

### Cursor

```
workspace/
└── .cursor/
    ├── rules/           # Steering rules (.mdc files)
    ├── commands/        # Command prompts (.md files)
    └── mcp.json         # MCP server configuration
```

**Flows:**
```jsonc
{
  "cursor": {
    "rootDir": ".cursor",
    "flows": [
      { "from": "rules/{name}.md", "to": ".cursor/rules/{name}.mdc" },
      { "from": "commands/{name}.md", "to": ".cursor/commands/{name}.md" },
      { "from": "mcp.jsonc", "to": ".cursor/mcp.json", "merge": "deep" }
    ]
  }
}
```

### Claude

```
workspace/
├── CLAUDE.md        # Root instruction file
└── .claude/
    ├── agents/      # Agent definitions
    ├── skills/      # Skill definitions
    └── commands/    # Command prompts
```

**Flows:**
```jsonc
{
  "claude": {
    "rootDir": ".claude",
    "rootFile": "CLAUDE.md",
    "flows": [
      { "from": "agents/{name}.md", "to": ".claude/agents/{name}.md" },
      { "from": "skills/{name}.md", "to": ".claude/skills/{name}.md" },
      { "from": "commands/{name}.md", "to": ".claude/commands/{name}.md" }
    ]
  }
}
```

### Windsurf

```
workspace/
└── .windsurf/
    ├── rules/       # Cascade rules
    ├── commands/    # Command definitions
    └── config.json  # Configuration
```

### Multi-Platform Setup

```
workspace/
├── AGENTS.md        # Universal
├── CLAUDE.md        # Claude-specific
├── .cursor/
│   ├── rules/
│   └── mcp.json
├── .claude/
│   ├── agents/
│   └── skills/
└── .windsurf/
    └── rules/
```

**All platforms coexist** with independent directories.

## Flow-Based Organization

Unlike older systems with static subdirectory mappings, the platform system uses **declarative flows** to define how content is organized.

### Traditional (Old) Approach

```jsonc
// ❌ Old: static subdirs mapping
{
  "cursor": {
    "subdirs": [
      {
        "universalDir": "rules",
        "platformDir": "rules",
        "exts": [".mdc", ".md"]
      }
    ]
  }
}
```

**Limitations:**
- Static file copying only
- No format conversion
- No key remapping
- No multi-package composition

### Flow-Based (Current) Approach

```jsonc
// ✅ New: declarative flows
{
  "cursor": {
    "flows": [
      {
        "from": "rules/{name}.md",
        "to": ".cursor/rules/{name}.mdc"
      }
    ]
  }
}
```

**Advantages:**
- Format conversion (YAML → JSON)
- Key remapping
- Multi-target flows
- Conditional execution
- Merge strategies

## File Extensions

Extensions are handled by **flow patterns**, not static lists.

### Extension Transformation

**Example: Cursor rules**
```jsonc
{
  "from": "rules/{name}.md",
  "to": ".cursor/rules/{name}.mdc"
}
```

**Transformation:**
```
rules/typescript.md → .cursor/rules/typescript.mdc
rules/python.md     → .cursor/rules/python.mdc
```

### Format Conversion

**Example: YAML to JSON**
```jsonc
{
  "from": "settings.yaml",
  "to": ".cursor/settings.json"
}
```

**Transformation:**
```yaml
# settings.yaml
theme: dark
fontSize: 14
```

```json
// .cursor/settings.json
{
  "theme": "dark",
  "fontSize": 14
}
```

### No Extension Restriction

Flows can target **any extension**:

```jsonc
{
  "from": "config.yaml",
  "to": ".cursor/config.toml"  // YAML → TOML
}
```

## Universal Package Structure

Packages use a **platform-agnostic structure** defined by their content:

```
@user/package/
├── rules/               # Universal rules directory
│   ├── typescript.md
│   └── python.md
├── commands/            # Universal commands directory
│   └── code-review.md
├── agents/              # Universal agents directory
│   └── reviewer.md
├── mcp.jsonc            # Universal MCP config
├── settings.jsonc       # Universal settings
└── package.yml          # Package metadata
```

**No platform-specific content in packages.** Flows handle transformation.

## Path Resolution

### Source Paths (in Package)

Relative to **package root**:

```jsonc
{
  "from": "rules/typescript.md"  // package/rules/typescript.md
}
```

### Target Paths (in Workspace)

Relative to **workspace root**:

```jsonc
{
  "to": ".cursor/rules/typescript.mdc"  // workspace/.cursor/rules/typescript.mdc
}
```

### Pattern Placeholders

Captured from source pattern:

```jsonc
{
  "from": "rules/{name}.md",          // Captures 'name'
  "to": ".cursor/rules/{name}.mdc"    // Reuses 'name'
}
```

**Example:**
```
rules/typescript.md → {name} = "typescript"
.cursor/rules/typescript.mdc
```

## Directory Creation

Directories are **created automatically** when flows execute.

### Automatic Creation

```jsonc
{
  "from": "rules/typescript.md",
  "to": ".cursor/rules/typescript.mdc"
}
```

**Behavior:**
1. Check if `.cursor/rules/` exists
2. If not, create directory (and parents)
3. Write file

### Nested Directories

```jsonc
{
  "from": "agents/reviewer.md",
  "to": ".cursor/custom/agents/reviewer.md"
}
```

**Creates:**
```
.cursor/
└── custom/
    └── agents/
        └── reviewer.md
```

### Atomic Operations

- Uses temporary files
- Atomic rename
- Rollback on error

## Multi-Package Directory Handling

When multiple packages install to same platform:

### Separate Subdirectories

```
Package A:
  rules/typescript.md → .cursor/rules/typescript.mdc

Package B:
  rules/python.md → .cursor/rules/python.mdc

Result:
  .cursor/rules/
    ├── typescript.mdc  (from A)
    └── python.mdc      (from B)
```

**No conflicts** - different filenames.

### Same File with Merge

```
Package A:
  mcp.jsonc → .cursor/mcp.json (merge: deep)

Package B:
  mcp.jsonc → .cursor/mcp.json (merge: deep)

Result:
  .cursor/mcp.json (merged content from A + B)
```

**Merge strategy** handles composition.

### Same File with Namespacing

```
Package A:
  mcp.jsonc → .cursor/mcp.json (namespace: true, merge: deep)

Package B:
  mcp.jsonc → .cursor/mcp.json (namespace: true, merge: deep)

Result:
  .cursor/mcp.json
  {
    "packages": {
      "@user/package-a": { /* A's content */ },
      "@user/package-b": { /* B's content */ }
    }
  }
```

**Namespace isolation** prevents conflicts.

## Workspace vs Package Paths

### Package Paths (Universal)

```
@user/package/
├── rules/           # Standard name
├── agents/          # Standard name
└── mcp.jsonc        # Standard name
```

### Workspace Paths (Platform-Specific)

```
workspace/
├── .cursor/
│   ├── rules/       # Cursor convention
│   └── mcp.json     # Cursor format
└── .claude/
    ├── agents/      # Claude convention
    └── config.json  # Claude format
```

**Flows bridge the gap** between universal and platform-specific.

## Custom Directory Structures

### Custom Subdirectories

Define any directory structure via flows:

```jsonc
{
  "my-platform": {
    "rootDir": ".myplatform",
    "flows": [
      { "from": "rules/{name}.md", "to": ".myplatform/prompts/{name}.txt" },
      { "from": "agents/{name}.md", "to": ".myplatform/bots/{name}.yaml" }
    ]
  }
}
```

**Result:**
```
.myplatform/
├── prompts/     # Custom location for rules
└── bots/        # Custom location for agents
```

### Deep Nesting

```jsonc
{
  "from": "config.yaml",
  "to": ".platform/configs/user/settings.json"
}
```

**Creates:**
```
.platform/
└── configs/
    └── user/
        └── settings.json
```

## Best Practices

### 1. Use Standard Directories

Follow built-in conventions when possible:
```
.cursor/rules/
.claude/agents/
.windsurf/rules/
```

### 2. Organize by Content Type

Group related content:
```
.cursor/
├── rules/       # Steering rules
├── commands/    # Commands/workflows
└── mcp.json     # Configuration
```

### 3. Keep Root Clean

Minimize files at project root:
```
project/
├── AGENTS.md        # Universal only
├── CLAUDE.md        # Platform-specific only
└── .cursor/         # Platform directories
```

### 4. Document Custom Layouts

If using custom structure, document:
```jsonc
{
  "my-platform": {
    // Custom layout for XYZ reason
    "rootDir": ".custom",
    "flows": [ /* ... */ ]
  }
}
```

### 5. Test Directory Creation

Verify directories created correctly:
```bash
opkg install @user/package --dry-run
ls -R .cursor/
```

## Troubleshooting

### Files in Wrong Directory

**Check flow targets:**
```jsonc
{
  "to": ".cursor/rules/{name}.mdc"  // Verify path
}
```

**Check placeholder usage:**
```jsonc
{
  "from": "rules/{name}.md",
  "to": ".cursor/rules/{name}.mdc"  // {name} must match
}
```

### Directories Not Created

**Check permissions:**
```bash
ls -la .cursor/
```

**Check flow execution:**
```bash
opkg install @user/package --dry-run
```

### Wrong File Extension

**Check extension in flow:**
```jsonc
{
  "to": ".cursor/rules/{name}.mdc"  // Extension matters
}
```

### Platform Not Detected

**Check root directory:**
```bash
ls -la .cursor
```

**Check detection:**
```bash
opkg status
```

## Next Steps

- **Learn detection:** [Detection](./detection.md)
- **Configure flows:** [Flows](./flows.md)
- **See examples:** [Examples](./examples.md)
