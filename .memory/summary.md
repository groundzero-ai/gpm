# Project Summary: OpenPackage

**Last Updated:** 2026-01-16

## Project Overview

OpenPackage (`opkg`) is a universal package manager for AI coding tools. It enables reusable modules (rules, commands, subagents, skills) that can be installed across any AI coding platform and codebase.

**Version:** 0.7.3  
**License:** Apache-2.0  
**Homepage:** https://openpackage.dev

## Key Features
- Cross-platform AI coding workflow management
- Install & sync pre-built workflows
- Reuse rules, slash commands, and skills across codebases
- Share and compose packages together

## Current Status

🔄 **New Task Added from GitHub**

### Active Tasks

- 🆕 **[Support Pi-Mono](task-8838ec6c-support-pi-mono.md)** (GitHub Issue #13)
  - Add support for Pi-Mono platform integration
  - Status: Ready to start
  - Source: https://github.com/enulus/OpenPackage/issues/13

### Recent Completions

**Epic:** [Codebase Exploration](epic-c7623917-codebase-exploration.md) ✅
- **Phase:** [CodeMapper Analysis](phase-ead5a66d-codemapper-analysis.md) ✅
- **Completed:** 2026-01-16
- **Deliverables:**
  1. Complete codebase analysis with statistics and architecture
  2. ASCII state machine diagrams showing data flows
  3. User journey maps for 7 different personas

### Key Findings

**Codebase Statistics:**
- 379 files (295 TypeScript, 84 Markdown)
- 5,599 symbols (2,283 functions, 30 classes)
- ~2.5 MB of code

**Architecture:**
- Layered pipeline pattern
- Flow-based transformation engine
- Multi-platform support (7 platforms)
- Multiple source types (registry, git, local, global)

**Core Systems:**
1. **Install Pipeline** - Package installation with dependency resolution
2. **Save Pipeline** - Workspace synchronization with versioning
3. **Flow Engine** - Universal ↔ Platform transformation (7 operations)
4. **Platform System** - Multi-platform abstraction layer
5. **Version System** - Semver + WIP versions
6. **Workspace Index** - File and key tracking for clean uninstall

## Active Epic

_None - awaiting direction on Pi-Mono task_

## Active Phases

_None_

## Next Steps

1. Review Pi-Mono task requirements
2. Decide on approach for implementation
3. Available research documents for reference:
   - [Codebase Analysis](research-b603792d-codebase-analysis.md)
   - [Data Flow Diagrams](research-886fcfc8-data-flow-diagram.md)
   - [User Journeys](research-dc9cb7d9-user-journeys.md)

## Knowledge Base

See [knowledge.md](knowledge.md) for detailed project information and learnings.
