
<p align="center">
  <a href="https://github.com/enulus/OpenPackage">
    <picture>
      <source srcset="assets/openpackage_ascii_dark.png" media="(prefers-color-scheme: dark)">
      <source srcset="assets/openpackage_ascii_light.png" media="(prefers-color-scheme: light)">
      <img src="assets/openpackage_ascii_light.png" alt="OpenPackage logo" height="64">
    </picture>
  </a>
</p>

<p align="center">Organized agentic coding for teams.</p>
<p align="center">
<a href="https://www.npmjs.com/package/opkg " target="blank">
  <img src="https://img.shields.io/npm/v/opkg?style=flat-square" alt="Npm package for OpenPackage">
</a>
<a href="./LICENSE">
  <img alt="License: Apache-2.0" src="https://img.shields.io/github/license/enulus/openpackage?style=flat-square" />
</a>
<a href="https://discord.gg/W5H54HZ8Fm" target="blank">
  <img src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white&style=flat-square" alt="OpenPackage Discord">
</a>
<br /><br />
</p>

<p align="center">
  Follow <a href="https://x.com/hyericlee">@hyericlee on X</a> for updates · Join the <a href="https://discord.gg/W5H54HZ8Fm">OpenPackage Discord</a> for help and questions.
</p>

# OpenPackage

**OpenPackage is the centralized hub for organizing your specs and configs for agentic coding, giving you consistent context and workflows between sessions, projects, and teams.**

## Why OpenPackage?

Modern AI coding tools are powerful, but lack organization, reusability, and efficiency.
- Specs across individuals and codebases, diverging, unversioned, and incohesive.
- Rules, commands, and subagents scattered across multiple projects.
- Familiar workflows rebuilt for each project, incompatible between AI coding platforms.

OpenPackage organizes your specs and AI coding configs into reusable packages that can be accessed by any session, any project, and any coding platform.

## How it works

At it's core, OpenPackage is a lightweight CLI tool for creating versioned, AI coding platform agnostic packages, each contaning sets of specs and coding config files for simplified installs, uninstalls, and distribution.  

**No API keys required. No MCP installation.** 

1. Declare a package
2. Add specs and AI coding config files
3. Sync to multiple codebases

## Quick start

### Install

npm
```bash
npm install -g opkg 
```

### Create a package

```bash title="Terminal"
opkg init # Initialize the workspace as a package, or
opkg init <package> # Initialize a package under cwd `.openpackage/packages`
```  

> [!NOTE]  
> You can also use command `openpackage` instead of `opkg`

### Add/update/remove package files

Directly update the files (at cwd or in `.openpackage/packages/`) and perform `opkg save`.  
You can also use the add command to add workspace files to a package.

```bash title="Terminal"
opkg add <package> <path-to-dir-or-file>
```  

> [!TIP]  
> Learn how to compose packages by reading the [packages doc](https://openpackage.dev/docs/packages) from our official docs.

Use `save` or `pack` to save the set of dirs and files as a package to your local registry for reuse and distribution.

```bash title="Terminal"
opkg save [package] # Prerelease/unversioned
opkg pack [package] # Stable releases
```  

> [!TIP]  
> Packages are saved to your local machine at `~/.openpackage/registry/`.

### List local packages
```bash title="Terminal"
opkg list
```  
Shows all packages currently saved to the local registry.  

### Show local package details
```bash title="Terminal"
opkg show <package>
```  
Outputs the details of the package and lists all included files.

### Install packages
```bash title="Terminal"
opkg install <package>
```  
Adds all files under the specified package to the codebase at cwd.

### Uninstall packages
```bash title="Terminal"
opkg uninstall <package>
```  
Removes all files for the specified package from the codebase at cwd.

### Upload packages (push)
```bash title="Terminal"
opkg push <package>
```  

### Download packages (pull)
```bash title="Terminal"
opkg pull <package>
```  

### Authenticate CLI
```bash title="Terminal"
opkg login
```  

> [!TIP]  
> Create an account at [openpackage.dev](https://openpackage.dev) to manage packages remotely.

## Use Cases

### Reuse files across multiple codebases
Reuse rules, slash commands, and more across multiple codebases.

#### Single file
```bash title="Terminal"
# In current codebase
opkg save f specs/nextjs.md
# In another codebase
opkg install f/specs/nextjs.md
```  

#### Multiple files via package
```bash title="Terminal"
# In current codebase
opkg save essentials
# In another codebase
opkg install essentials
```  

### Sync files across multiple platforms
Automatically sync your rules, slash commands, and more across multiple platform.
```bash title="Terminal"
# Current codebase has .cursor, .claude, .opencode directories
opkg save essentials .cursor/commands/essentials
# OpenPackage CLI automatically generates/syncs the same command files across all platforms.

# Before save:
# .cursor/commands/essentials/cleanup.md

# After save:
# .cursor/commands/essentials/cleanup.md
# .claude/commands/essentials/cleanup.md
# .opencode/command/essentials/cleanup.md
```  

### Modular management of files
Create domain specific packages for modular reuse.
```bash title="Terminal"
# Create typescript package
opkg save typescript .cursor/rules/typescript

# Create scalable-nextjs package
opkg save scalable-nextjs .cursor/rules/nextjs

# Create scalable-nestjs package
opkg save scalable-nestjs .cursor/rules/nestjs

# Create mongodb package
opkg save mongodb .cursor/rules/mongodb

# In your NextJS codebase
opkg install typescript
opkg install scalable-nextjs

# In your NestJS codebase
opkg install typescript
opkg install scalable-nestjs
opkg install mongodb
```  

> [!TIP]  
> Learn more by heading over to the [official docs](https://openpackage.dev/docs).

## Package Structure

Packages are composed using the following directory structure:

```txt title="Structure"
<package>
├── .openpackage/
│   ├── package.yml # The OpenPackage manifest, required
│   ├── rules/
│   │   └── # Rule files
│   ├── commands/
│   │   └── # Command files (slash commands)
│   ├── agents/
│   │   └── # Agent files (subagents)
│   └── skills/
│       └── # Skill files (Claude Code skills)
├── <dirs-or-files>
│   └── # Any other root dirs or files (Ex: specs/, docs/, tests/, etc.)
├── README.md # Metadata files (LICENSE.md, CONTRIBUTING.md, etc.)
└── AGENTS.md # Platform root file
```

There are two ways to compose packages:
- In a project workspace: `opkg init <package>` will create a package in `.openpackage/packages/<packages>/`
- In a dedicated package codebase: `opkg init` will create a package at cwd (similar to npm, pypi, etc.)

> [!TIP]  
> Learn more about packages from the [packages doc](https://openpackage.dev/docs/packages) from our official docs.

## Supported Platforms

OpenPackage performs installation and platform sync of files for supported AI coding platforms outlined by the table below.  

| Platform | Directory | Root file | Rules | Commands | Agents | Skills |
| --- | --- | --- | --- | --- | --- | --- |
| Antigravity | .agent/ | | rules/ | workflows/ | | |
| Augment Code | .augment/ | | rules/ | commands/ | | |
| Claude Code | .claude/ | CLAUDE.md | rules/ | commands/ | agents/ | skills/ |
| Codex | .codex/ | AGENTS.md | | prompts/ | | |
| Cursor | .cursor/ | AGENTS.md | rules/ | commands/ | | |
| Factory | .factory/ | AGENTS.md | | commands/ | droids/ | |
| Kilo Code | .kilocode/ | AGENTS.md | rules/ | workflows/ | | |
| Kiro | .kiro/ | | steering/ | | | |
| OpenCode | .opencode/ | AGENTS.md | | command/ | agent/ | |
| Qwen Code | .qwen/ | QWEN.md | | | agents/ | |
| Roo | .roo/ | AGENTS.md | | commands/ | | |
| Warp | .warp/ | WARP.md | | | |
| Windsurf | .windsurf/ | | rules/ | | | |

The built-in `platforms.jsonc` defines supported platforms, but can be overridden by user configs:
- Global: `~/.openpackage/platforms.jsonc` (`.json`)
- Workspace: `<cwd>/.openpackage/platforms.jsonc` (`.json`)

Deep-merged (local > global > built-in) for per-project customization.

## Contributing

We would love your help building the future of package management for agentic coding.  

Feel free to create [PRs](https://github.com/enulus/OpenPackage/pulls) and [Github issues](https://github.com/enulus/OpenPackage/issues) for:
- Bugs
- Feature requests
- Support for new platforms
- Missing standard behavior
- Documentation

## Links

- [Official Website and Registry](https://openpackage.dev)
- [Documentation](https://openpackage.dev/docs)
- [Discord](https://discord.gg/W5H54HZ8Fm)
- [Creator X (Twitter)](https://x.com/hyericlee)
