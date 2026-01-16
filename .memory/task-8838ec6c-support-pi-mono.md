# Task: Support Pi-Mono

**Source:** GitHub Issue #13  
**URL:** https://github.com/enulus/OpenPackage/issues/13  
**Status:** Ready to Implement  
**Created:** 2026-01-16  
**Priority:** Medium  
**Hash ID:** 8838ec6c  
**Estimated Effort:** 1-2 hours

## Description

Add support for Pi-Mono (https://github.com/badlogic/pi-mono) platform integration.

## Research Complete ✅

See [research-132f0c28-pi-mono-implementation-analysis.md](research-132f0c28-pi-mono-implementation-analysis.md) for detailed analysis.

**Key Findings:**
- Pi-Mono is very similar to Codex CLI platform (already supported)
- Uses `.pi/agent/prompts/` for commands and `.pi/agent/skills/` for skills
- Can be implemented by adding platform definition to `platforms.jsonc`
- No code changes needed - existing flow engine handles everything
- Estimated implementation: 1-2 hours including tests and docs

## Implementation Plan

### Phase 1: Add Platform Definition (15 min)

**File:** `platforms.jsonc`

Add new platform entry:

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

**Notes:**
- `AGENTS.md` handled by global flow (already configured)
- Rules and Agents not supported (Pi-Mono doesn't use them)
- Pattern matches Codex CLI structure

### Phase 2: Create Test Package (10 min)

Create `test-packages/pi-mono-test/`:

```
pi-mono-test/
├── openpackage.yml
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

### Phase 3: Test Installation (10 min)

```bash
# Test 1: Fresh install with --platform flag
mkdir test-workspace && cd test-workspace
opkg install ../test-packages/pi-mono-test --platform pimono

# Verify files:
# - .pi/AGENTS.md (from global flow)
# - .pi/agent/prompts/commit.md
# - .pi/agent/prompts/deploy.md
# - .pi/agent/skills/devtools/testing/SKILL.md
# - .pi/agent/skills/devtools/testing/scripts/test.sh

# Test 2: Auto-detection
mkdir test-workspace-2 && cd test-workspace-2
mkdir -p .pi/agent/{prompts,skills}
opkg install ../test-packages/pi-mono-test

# Should prompt to select pimono platform or auto-select if only platform
```

### Phase 4: Test Save Workflow (10 min)

```bash
# Modify installed files
echo "# Updated command" >> .pi/agent/prompts/commit.md
echo "# New command" > .pi/agent/prompts/new-command.md

# Save changes back to package
opkg save pi-mono-test

# Verify universal package updated:
# - commands/commit.md contains "# Updated command"
# - commands/new-command.md exists
```

### Phase 5: Test Multi-Platform (5 min)

```bash
# Install same package to multiple platforms
opkg install test-packages/pi-mono-test --platform pimono
opkg install test-packages/pi-mono-test --platform claude

# Verify both .pi/ and .claude/ have correct files
```

### Phase 6: Documentation (15 min)

1. **README.md** - Add Pi-Mono to supported platforms list
   
2. **docs/platforms.md** (or create if doesn't exist)
   ```markdown
   ## Pi-Mono
   
   Pi-Mono uses a simple directory structure:
   - Commands: `.pi/agent/prompts/*.md`
   - Skills: `.pi/agent/skills/**/*`
   - Agents: `AGENTS.md` (root level)
   
   ### Installation
   
   ```bash
   opkg install my-package --platform pimono
   # or with auto-detection
   opkg install my-package  # auto-detects .pi directory
   ```
   
   ### Package Structure
   
   Packages for Pi-Mono follow universal format:
   - `commands/` → `.pi/agent/prompts/`
   - `skills/` → `.pi/agent/skills/`
   - `AGENTS.md` → `AGENTS.md`
   ```

3. **Update platform compatibility matrix** wherever it exists

## Success Criteria

- [x] Research completed and documented
- [ ] Platform definition added to `platforms.jsonc`
- [ ] Test package created
- [ ] Fresh install works with `--platform pimono`
- [ ] Auto-detection works when `.pi/` exists
- [ ] Save workflow captures changes correctly
- [ ] Multi-platform installation works
- [ ] Documentation updated
- [ ] All tests pass
- [ ] PR created for upstream

## Technical Notes

### Directory Mapping

| Universal Format | Pi-Mono Location | Handler |
|-----------------|------------------|---------|
| `AGENTS.md` | `AGENTS.md` | Global flow |
| `commands/**/*.md` | `.pi/agent/prompts/**/*.md` | Export flow |
| `skills/**/*` | `.pi/agent/skills/**/*` | Export flow |
| `rules/**/*.md` | ❌ Not supported | Skipped |
| `agents/**/*.md` | ❌ Not supported | Skipped |

### Flow Engine Behavior

From research analysis:
- Export flows: Package → Workspace (used by `install`, `apply`)
- Import flows: Workspace → Package (used by `save`)
- Global flows: Applied to all platforms automatically
- Unmapped paths: Silently skipped (rules/agents won't error)

### Edge Cases Handled

1. **Nested commands**: Pattern `commands/**/*.md` preserves nesting in prompts
2. **User-level install**: Will install to `./.pi/` (project scope) - global scope needs Issue #7
3. **Rules/Agents**: Silently skipped since Pi-Mono doesn't support them
4. **AGENTS.md**: Handled by global flow, no platform-specific config needed

## Dependencies

- Existing flow engine (`src/core/flows/`)
- Platform system (`src/core/platforms.ts`)
- Test utilities (for integration tests)

## Related Issues

- Issue #7: Scope flags (--user, --global) - would enable `~/.pi/` installation
- Issue #13: This issue

## References

- [Implementation Analysis](research-132f0c28-pi-mono-implementation-analysis.md)
- [Codebase Analysis](research-b603792d-codebase-analysis.md)
- [Data Flow Diagrams](research-886fcfc8-data-flow-diagram.md)
- Pi-Mono GitHub: https://github.com/badlogic/pi-mono

## Next Actions

1. Review this plan with human
2. Proceed with Phase 1: Add platform definition
3. Execute test phases 2-5
4. Update documentation (Phase 6)
5. Create PR for upstream repository

