# Knowledge Base: OpenPackage

**Last Updated:** 2026-01-16

## Project Architecture

- **Language:** TypeScript
- **Runtime:** Node.js
- **Package:** `opkg` on npm

## Directory Structure

```
OpenPackage/
├── src/           # Source code
├── bin/           # CLI binaries
├── specs/         # Specifications
├── schemas/       # JSON schemas
├── tests/         # Test suite
├── examples/      # Usage examples
├── assets/        # Static assets
└── platforms.jsonc # Platform configurations
```

## Key Concepts

- **Packages:** Reusable AI coding modules
- **Platforms:** Target AI coding tools (Claude, Cursor, etc.)
- **Specs:** Configuration specifications
- **Rules:** AI behavior guidelines
- **Skills:** Reusable capabilities

## Links

- [GitHub](https://github.com/enulus/openpackage)
- [npm](https://www.npmjs.com/package/opkg)
- [Discord](https://discord.gg/W5H54HZ8Fm)

## Learnings

### Codebase Exploration (2026-01-16)

**Epic:** [Codebase Exploration](epic-c7623917-codebase-exploration.md)

**Key Insights:**

1. **Architecture Pattern:** OpenPackage uses a layered pipeline architecture with clear separation of concerns:
   - Commands layer (CLI interface)
   - Core pipelines (business logic)
   - Flow engine (transformation layer)
   - Utilities (cross-cutting concerns)

2. **Flow-Based Transformation:** The map-pipeline system provides 7 core operations ($set, $rename, $unset, $switch, $pipeline, $copy, $pipe) enabling declarative file transformations between universal and platform-specific formats.

3. **Multi-Source Resolution:** Package sources are resolved in priority order: explicit path > workspace > global > git > registry. This provides flexibility while maintaining predictability.

4. **Version Strategy:** Dual versioning system:
   - WIP versions for development (base62 timestamps)
   - Stable versions for release (semver)
   - Enables rapid iteration while maintaining release discipline

5. **Workspace Index System:** Sophisticated tracking of installed files and merged keys enables:
   - Clean uninstall (no orphaned files)
   - Surgical removal from merged files
   - Conflict detection and resolution

6. **Platform Abstraction:** Universal format + platform flows = write once, deploy everywhere. Currently supports 7 AI coding platforms.

**Research Documents:**
- [Codebase Analysis](research-b603792d-codebase-analysis.md) - Comprehensive architecture documentation
- [Data Flow Diagrams](research-886fcfc8-data-flow-diagram.md) - Visual state machines and flows
- [User Journeys](research-dc9cb7d9-user-journeys.md) - 7 persona-based journey maps

**Tools Used:**
- CodeMapper (`cm`) for AST-based code analysis
- Provided instant insights into codebase structure
- Token-efficient format (`--format ai`) for analysis
