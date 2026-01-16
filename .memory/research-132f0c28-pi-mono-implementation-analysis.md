# Research: Pi-Mono Platform Implementation Analysis

**Hash ID:** 132f0c28  
**Created:** 2026-01-16  
**Related Task:** [task-8838ec6c-support-pi-mono.md](task-8838ec6c-support-pi-mono.md)  
**Status:** Complete

## Executive Summary

Pi-Mono platform can be integrated into OpenPackage using the existing platform flow system. The implementation requires adding a new platform definition to `platforms.jsonc` with appropriate export/import flows that map between universal package format and Pi-Mono's directory structure.

**Confidence Level:** 9/10 - Architecture is well-understood, pattern is clear

---

## Pi-Mono Platform Structure

### Directory Layout
```
~/.pi/                      # User-level (global)
./.pi/                      # Project-level (local)
├── AGENTS.md              # Root agent configuration
├── agent/
│   ├── prompts/           # Commands (slash commands)
│   │   └── *.md
│   └── skills/            # Skills (nested structure)
│       └── category/
│           └── skill-name/
│               ├── SKILL.md
│               └── scripts/
```

### File Types Mapping

| Universal Format | Pi-Mono Location | Notes |
|-----------------|------------------|-------|
| `AGENTS.md` | `AGENTS.md` | Root configuration (global flow) |
| `commands/**/*.md` | `.pi/agent/prompts/*.md` | Flat structure, no nesting |
| `skills/**/*` | `.pi/agent/skills/**/*` | Nested structure preserved |
| `rules/**/*.md` | ❌ Not supported | Pi-Mono doesn't have rules |
| `agents/**/*.md` | ❌ Not supported | Requires extension (not worth it per issue) |

---

## Implementation Strategy

### 1. Add Platform Definition to `platforms.jsonc`

Based on existing patterns (Claude, Codex, etc.), Pi-Mono needs:

```jsonc
"pimono": {
  "name": "Pi-Mono",
  "rootDir": ".pi",
  "rootFile": "AGENTS.md",
  "aliases": ["pi-mono", "pi"],
  "description": "Pi-Mono AI coding assistant framework",
  "export": [
    {
      "from": "commands/**/*.md",
      "to": ".pi/agent/prompts/**/*.md"
    },
    {
      "from": "skills/**/*",
      "to": ".pi/agent/skills/**/*"
    }
  ],
  "import": [
    {
      "from": ".pi/agent/prompts/**/*.md",
      "to": "commands/**/*.md"
    },
    {
      "from": ".pi/agent/skills/**/*",
      "to": "skills/**/*"
    }
  ]
}
```

### 2. Global Flow Already Handles AGENTS.md

The existing global flow in `platforms.jsonc` automatically handles `AGENTS.md`:

```jsonc
"global": {
  "export": [
    {
      "from": "AGENTS.md",
      "to": "AGENTS.md",
      "when": { "exists": "AGENTS.md" },
      "merge": "composite"
    }
  ],
  "import": [
    {
      "from": "AGENTS.md",
      "to": "AGENTS.md",
      "merge": "composite"
    }
  ]
}
```

This means `AGENTS.md` will automatically work for Pi-Mono without additional configuration.

---

## How It Works

### Architecture Overview

From [research-b603792d-codebase-analysis.md](research-b603792d-codebase-analysis.md):

1. **Platform System** (`src/core/platforms.ts`) - Loads and validates platform definitions
2. **Flow Engine** (`src/core/flows/`) - Transforms between universal ↔ platform-specific
3. **Install Pipeline** - Applies export flows (package → workspace)
4. **Save Pipeline** - Applies import flows (workspace → package)

### Install Flow (Package → Pi-Mono Workspace)

```
┌────────────────────────────────────────┐
│ Universal Package Structure            │
│                                        │
│  package/                              │
│  ├── AGENTS.md                         │
│  ├── commands/                         │
│  │   └── commit.md                     │
│  └── skills/                           │
│      └── devtools/                     │
│          └── playwright/               │
│              └── SKILL.md              │
└────────────────────────────────────────┘
                  │
                  │ opkg install pkg --platform pimono
                  ↓
┌────────────────────────────────────────┐
│ Flow Engine Applies Export Flows      │
│                                        │
│  1. Global: AGENTS.md → AGENTS.md      │
│  2. Pi-Mono: commands/** → prompts/**  │
│  3. Pi-Mono: skills/** → skills/**     │
└────────────────────────────────────────┘
                  │
                  ↓
┌────────────────────────────────────────┐
│ Pi-Mono Workspace Structure            │
│                                        │
│  .pi/                                  │
│  ├── AGENTS.md                         │
│  ├── agent/                            │
│  │   ├── prompts/                      │
│  │   │   └── commit.md                 │
│  │   └── skills/                       │
│  │       └── devtools/                 │
│  │           └── playwright/           │
│  │               └── SKILL.md          │
└────────────────────────────────────────┘
```

### Save Flow (Pi-Mono Workspace → Package)

```
┌────────────────────────────────────────┐
│ Pi-Mono Workspace (Modified)           │
│                                        │
│  .pi/agent/prompts/my-command.md       │
│  .pi/agent/skills/my-skill/SKILL.md    │
└────────────────────────────────────────┘
                  │
                  │ opkg save my-package
                  ↓
┌────────────────────────────────────────┐
│ Flow Engine Applies Import Flows      │
│                                        │
│  1. Pi-Mono: prompts/** → commands/**  │
│  2. Pi-Mono: skills/** → skills/**     │
│  3. Global: AGENTS.md → AGENTS.md      │
└────────────────────────────────────────┘
                  │
                  ↓
┌────────────────────────────────────────┐
│ Universal Package (Updated)            │
│                                        │
│  package/                              │
│  ├── commands/my-command.md            │
│  └── skills/my-skill/SKILL.md          │
└────────────────────────────────────────┘
```

---

## Platform Detection

From [research-886fcfc8-data-flow-diagram.md](research-886fcfc8-data-flow-diagram.md):

When running `opkg install` without `--platform`, the system:

1. **Scans workspace** for platform directories (`.claude/`, `.cursor/`, `.pi/`, etc.)
2. **Detects platforms** based on `rootDir` from `platforms.jsonc`
3. **Auto-selects** if single platform found
4. **Prompts user** if multiple platforms detected

With Pi-Mono's `rootDir: ".pi"`, detection will work automatically.

---

## Existing Similar Platforms

### Codex CLI (Most Similar)

```jsonc
"codex": {
  "name": "Codex CLI",
  "rootDir": ".codex",
  "rootFile": "AGENTS.md",
  "aliases": ["codexcli"],
  "export": [
    {
      "from": "commands/**/*.md",
      "to": ".codex/prompts/**/*.md"
    },
    {
      "from": "skills/**/*",
      "to": ".codex/skills/**/*"
    }
  ]
}
```

**Similarities to Pi-Mono:**
- ✅ Has `AGENTS.md` root file
- ✅ Commands → prompts mapping
- ✅ Skills → skills mapping
- ✅ No rules support

Pi-Mono is almost identical to Codex, just with different directory structure.

---

## Implementation Checklist

Based on task objectives from [task-8838ec6c-support-pi-mono.md](task-8838ec6c-support-pi-mono.md):

### ✅ Research Complete

- [x] Analyzed Pi-Mono directory structure
- [x] Identified file type mappings
- [x] Reviewed existing platform patterns
- [x] Found similar platform (Codex CLI)
- [x] Confirmed feasibility with existing architecture

### 📝 Implementation Steps

1. **Add Platform Definition** (5 min)
   - Add `pimono` entry to `platforms.jsonc`
   - Include export and import flows
   - Add aliases: `["pi-mono", "pi"]`
   - Set `rootDir: ".pi"` and `rootFile: "AGENTS.md"`

2. **Test Installation** (10 min)
   - Create test package with commands and skills
   - Run `opkg install test-pkg --platform pimono`
   - Verify files appear in `.pi/agent/prompts/` and `.pi/agent/skills/`
   - Verify `AGENTS.md` is copied to root

3. **Test Saving** (10 min)
   - Modify files in `.pi/agent/` structure
   - Run `opkg save test-pkg`
   - Verify changes captured in universal format

4. **Test Detection** (5 min)
   - Create workspace with `.pi/` directory
   - Run `opkg install` without `--platform`
   - Verify Pi-Mono is detected automatically

5. **Documentation** (15 min)
   - Add Pi-Mono to README.md platform list
   - Create example in docs showing Pi-Mono usage
   - Update platform compatibility matrix

---

## Edge Cases & Considerations

### 1. User vs Project Scope

Pi-Mono supports both:
- `~/.pi/` - User-level (global)
- `./.pi/` - Project-level (local)

**OpenPackage Handling:**
- Current behavior installs to workspace directory (project-level)
- User-level installation would require `--global` flag support (see Issue #7)
- For now, Pi-Mono will install to `./.pi/` (project scope)

### 2. Commands Directory Flattening

**Issue:** Universal format supports nested commands (`commands/git/commit.md`), but Pi-Mono expects flat structure (`.pi/agent/prompts/commit.md`)

**Current Flow Behavior:**
- Pattern `commands/**/*.md` → `.pi/agent/prompts/**/*.md` should preserve nesting
- This is actually fine! Pi-Mono can handle nested structure in prompts

**Recommendation:** Keep nested structure, Pi-Mono will work with it.

### 3. Rules and Agents Not Supported

From GitHub issue: "Rules: n/a" and "Agents: (requires extension) - but largely pointless"

**Solution:** Don't map these. If user tries to install package with rules/agents:
- Rules: Silently skip (no Pi-Mono equivalent)
- Agents: Silently skip (not worth extension support)

This is already handled by flow system - unmapped universal paths are ignored.

---

## Testing Strategy

### Test Package Structure

Create `test-pi-mono-package/`:

```
test-pi-mono-package/
├── openpackage.yml
│   name: test-pi-mono
│   version: 1.0.0
│   platforms: ["pimono"]
├── AGENTS.md
├── commands/
│   ├── commit.md
│   └── deploy.md
└── skills/
    └── devtools/
        └── testing/
            ├── SKILL.md
            └── scripts/
                └── test.sh
```

### Test Scenarios

1. **Fresh Install**
   ```bash
   mkdir test-workspace && cd test-workspace
   opkg install ./test-pi-mono-package --platform pimono
   # Verify: .pi/AGENTS.md, .pi/agent/prompts/*, .pi/agent/skills/*
   ```

2. **Auto-Detection**
   ```bash
   mkdir .pi && mkdir -p .pi/agent/{prompts,skills}
   opkg install ./test-pi-mono-package
   # Should auto-detect pimono platform
   ```

3. **Save Changes**
   ```bash
   echo "# Updated" >> .pi/agent/prompts/commit.md
   opkg save test-pi-mono-package
   # Verify: changes captured in package
   ```

4. **Multi-Platform**
   ```bash
   opkg install ./test-pi-mono-package --platform pimono
   opkg install ./test-pi-mono-package --platform claude
   # Verify: works on both platforms
   ```

---

## Dependencies & References

### Code References

- **Platform Definitions:** `src/core/platforms.ts` - Loads platform configs
- **Flow Engine:** `src/core/flows/` - Transforms universal ↔ platform
- **Config File:** `platforms.jsonc` - Platform definitions
- **Patterns:** `src/core/universal-patterns.ts` - Universal path matching

### Research Documents

- [Codebase Analysis](research-b603792d-codebase-analysis.md) - Architecture overview
- [Data Flow Diagrams](research-886fcfc8-data-flow-diagram.md) - Install/save flows
- [User Journeys](research-dc9cb7d9-user-journeys.md) - End-to-end workflows

### External Resources

- Pi-Mono GitHub: https://github.com/badlogic/pi-mono
- MCP Alternative: https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/

---

## Recommendation

**Proceed with implementation** - This is a straightforward addition:

1. ✅ **Well-understood architecture** - Existing platform system handles this perfectly
2. ✅ **Clear pattern** - Codex CLI is nearly identical reference
3. ✅ **Minimal code changes** - Just add platform definition to `platforms.jsonc`
4. ✅ **No new features needed** - Everything works with existing flow engine
5. ✅ **Low risk** - Non-breaking change, adds new platform support

**Estimated Effort:** 1-2 hours including testing and documentation

**Next Steps:**
1. Create implementation plan
2. Add platform definition
3. Test with real Pi-Mono installation
4. Update documentation
5. Create PR for upstream

