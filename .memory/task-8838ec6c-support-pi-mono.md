# Task: Support Pi-Mono

**Source:** GitHub Issue #13  
**URL:** https://github.com/enulus/OpenPackage/issues/13  
**Status:** Open  
**Created:** 2026-01-16  
**Priority:** TBD  
**Hash ID:** 8838ec6c

## Description

Add support for Pi-Mono (https://github.com/badlogic/pi-mono) platform integration.

## Details

Pi-Mono uses the following structure:
- **Directory:** `~/.pi` or `./.pi`
- **Root file:** `AGENTS.md`
- **Rules:** n/a
- **Commands:** `~/.pi/agent/prompts/*.md`
- **Agents:** (requires extension) - `~/.pi/agent/agents/*.md`
- **Skills:** `~/.pi/agent/skills/**/*.md`
- **MCP:** https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/

## Objectives

- [ ] Research Pi-Mono platform structure and conventions
- [ ] Implement Pi-Mono platform adapter
- [ ] Add Pi-Mono to supported platforms list
- [ ] Test installation and saving workflows with Pi-Mono
- [ ] Update documentation with Pi-Mono examples

## Notes

- Agents require extension support (but largely pointless according to issue)
- Need to understand how Skills are structured in `~/.pi/agent/skills/**/*.md`
- Commands are stored in `~/.pi/agent/prompts/*.md`

## Dependencies

- Understanding of Pi-Mono platform conventions
- Existing platform adapter patterns in codebase

## Expected Outcome

OpenPackage can install and manage packages for Pi-Mono platform, supporting its unique directory structure and file conventions.
