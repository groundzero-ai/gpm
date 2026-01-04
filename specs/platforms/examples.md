# Platform Examples

Practical examples and common patterns for platform flows.

## Quick Start

### Zero Configuration Installation

Built-in flows work out of the box:

```bash
# Install package - flows execute automatically
opkg install @username/cursor-rules
```

**What happens:**
1. CLI detects platforms (`.cursor`, `.claude`, etc.)
2. Loads built-in flow configurations
3. Transforms universal content to platform-specific formats
4. Writes files to workspace

**No configuration needed** for standard use cases.

## Simple Patterns

### Pattern 1: File Copy with Extension Change

```jsonc
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

**Package content:**
```
rules/
├── typescript.md
└── python.md
```

**Result in workspace:**
```
.cursor/rules/
├── typescript.mdc
└── python.mdc
```

### Pattern 2: Format Conversion

```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "config.yaml",
        "to": ".cursor/config.json"
      }
    ]
  }
}
```

**Package: config.yaml**
```yaml
theme: dark
fontSize: 14
tabSize: 2
```

**Workspace: .cursor/config.json**
```json
{
  "theme": "dark",
  "fontSize": 14,
  "tabSize": 2
}
```

### Pattern 3: Simple Key Remapping

```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "settings.jsonc",
        "to": ".cursor/settings.json",
        "map": {
          "theme": "workbench.colorTheme",
          "fontSize": "editor.fontSize"
        }
      }
    ]
  }
}
```

**Package: settings.jsonc**
```json
{
  "theme": "dark",
  "fontSize": 14
}
```

**Workspace: .cursor/settings.json**
```json
{
  "workbench": {
    "colorTheme": "dark"
  },
  "editor": {
    "fontSize": 14
  }
}
```

## Multi-Package Composition

### Pattern 4: Merge Multiple Packages

**Setup:**
```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "mcp.jsonc",
        "to": ".cursor/mcp.json",
        "merge": "deep"
      }
    ]
  }
}
```

**Package A: mcp.jsonc**
```json
{
  "servers": {
    "database": {
      "command": "mcp-db",
      "args": ["--port", "5432"]
    }
  }
}
```

**Package B: mcp.jsonc**
```json
{
  "servers": {
    "api": {
      "command": "mcp-api",
      "args": ["--host", "localhost"]
    }
  }
}
```

**Result: .cursor/mcp.json**
```json
{
  "servers": {
    "database": {
      "command": "mcp-db",
      "args": ["--port", "5432"]
    },
    "api": {
      "command": "mcp-api",
      "args": ["--host", "localhost"]
    }
  }
}
```

### Pattern 5: Namespace Isolation

**Setup:**
```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "mcp.jsonc",
        "to": ".cursor/mcp.json",
        "namespace": true,
        "merge": "deep"
      }
    ]
  }
}
```

**Package A (@user/db-tools): mcp.jsonc**
```json
{
  "servers": {
    "db": { "command": "mcp-db" }
  }
}
```

**Package B (@user/api-tools): mcp.jsonc**
```json
{
  "servers": {
    "api": { "command": "mcp-api" }
  }
}
```

**Result: .cursor/mcp.json**
```json
{
  "packages": {
    "@user/db-tools": {
      "servers": {
        "db": { "command": "mcp-db" }
      }
    },
    "@user/api-tools": {
      "servers": {
        "api": { "command": "mcp-api" }
      }
    }
  }
}
```

## Advanced Transformations

### Pattern 6: Markdown Frontmatter Transform

```jsonc
{
  "claude": {
    "flows": [
      {
        "from": "agents/{name}.md",
        "to": ".claude/agents/{name}.md",
        "map": {
          "role": "type",
          "model": {
            "values": {
              "anthropic/claude-sonnet-4.5": "claude-sonnet-4.5",
              "openai/gpt-4": "gpt-4"
            }
          }
        }
      }
    ]
  }
}
```

**Package: agents/reviewer.md**
```markdown
---
role: assistant
model: anthropic/claude-sonnet-4.5
temperature: 0.7
---
# Code Reviewer

Help review code for quality and security.
```

**Workspace: .claude/agents/reviewer.md**
```markdown
---
type: assistant
model: claude-sonnet-4.5
temperature: 0.7
---
# Code Reviewer

Help review code for quality and security.
```

**Note:** Body unchanged, only frontmatter transformed.

### Pattern 7: Content Embedding

```jsonc
{
  "opencode": {
    "flows": [
      {
        "from": "mcp.jsonc",
        "to": ".opencode/opencode.json",
        "embed": "mcp",
        "merge": "deep"
      }
    ]
  }
}
```

**Package: mcp.jsonc**
```json
{
  "servers": {
    "db": { "command": "mcp-db" }
  }
}
```

**Workspace: .opencode/opencode.json (existing)**
```json
{
  "version": "1.0",
  "other": "config"
}
```

**Result: .opencode/opencode.json**
```json
{
  "version": "1.0",
  "other": "config",
  "mcp": {
    "servers": {
      "db": { "command": "mcp-db" }
    }
  }
}
```

### Pattern 8: TOML Sections

```jsonc
{
  "codex": {
    "flows": [
      {
        "from": "mcp.jsonc",
        "to": ".codex/config.toml",
        "path": "$.servers",
        "section": "mcp_servers",
        "merge": "deep"
      }
    ]
  }
}
```

**Package: mcp.jsonc**
```json
{
  "servers": {
    "db": {
      "command": "mcp-db",
      "args": ["--port", "5432"]
    }
  }
}
```

**Workspace: .codex/config.toml**
```toml
[general]
version = "1.0"

[mcp_servers.db]
command = "mcp-db"
args = ["--port", "5432"]
```

### Pattern 9: Multi-Target with Different Formats

```jsonc
{
  "from": "mcp.jsonc",
  "to": {
    ".cursor/mcp.json": {
      "namespace": true,
      "merge": "deep"
    },
    ".opencode/opencode.json": {
      "embed": "mcp",
      "merge": "deep"
    },
    ".codex/config.toml": {
      "path": "$.servers",
      "section": "mcp_servers",
      "merge": "deep"
    }
  }
}
```

**Single source file** → **Three different formats/structures**

## Conditional Flows

### Pattern 10: Platform-Specific Flow

```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "cursor-specific.jsonc",
        "to": ".cursor/config.json",
        "when": { "platform": "cursor" }
      }
    ]
  }
}
```

Executes only when Cursor is detected.

### Pattern 11: Development vs Production

```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "config-dev.yaml",
        "to": ".cursor/config.json",
        "when": {
          "key": "env",
          "equals": "development"
        }
      },
      {
        "from": "config-prod.yaml",
        "to": ".cursor/config.json",
        "when": {
          "key": "env",
          "equals": "production"
        }
      }
    ]
  }
}
```

### Pattern 12: Multi-Platform Conditional

```jsonc
{
  "flows": [
    {
      "from": "shared-config.yaml",
      "to": ".ai/config.json",
      "when": {
        "or": [
          { "platform": "cursor" },
          { "platform": "claude" },
          { "platform": "windsurf" }
        ]
      }
    }
  ]
}
```

Executes if **any** of the platforms are detected.

## Complete Platform Configurations

### Example 1: Cursor Configuration

```jsonc
{
  "cursor": {
    "name": "Cursor",
    "rootDir": ".cursor",
    "aliases": ["cursorcli"],
    "flows": [
      // Rules with extension change
      {
        "from": "rules/{name}.md",
        "to": ".cursor/rules/{name}.mdc"
      },
      
      // Commands (no change)
      {
        "from": "commands/{name}.md",
        "to": ".cursor/commands/{name}.md"
      },
      
      // MCP with namespacing
      {
        "from": "mcp.jsonc",
        "to": ".cursor/mcp.json",
        "namespace": true,
        "merge": "deep"
      },
      
      // Settings with key remapping
      {
        "from": "settings.jsonc",
        "to": ".cursor/settings.json",
        "map": {
          "theme": "workbench.colorTheme",
          "ai.*": "cursor.*"
        },
        "merge": "deep"
      }
    ]
  }
}
```

### Example 2: Claude Configuration

```jsonc
{
  "claude": {
    "name": "Claude Code",
    "rootDir": ".claude",
    "rootFile": "CLAUDE.md",
    "aliases": ["claudecode"],
    "flows": [
      // Root file
      {
        "from": "CLAUDE.md",
        "to": "CLAUDE.md"
      },
      
      // Rules
      {
        "from": "rules/{name}.md",
        "to": ".claude/rules/{name}.md"
      },
      
      // Agents with frontmatter transform
      {
        "from": "agents/{name}.md",
        "to": ".claude/agents/{name}.md",
        "map": {
          "role": "type",
          "model": {
            "values": {
              "anthropic/claude-sonnet-4.5": "claude-sonnet-4.5"
            }
          }
        }
      },
      
      // Skills
      {
        "from": "skills/{name}.md",
        "to": ".claude/skills/{name}.md"
      }
    ]
  }
}
```

### Example 3: Multi-Platform Package

```jsonc
{
  "global": {
    "flows": [
      // Universal files
      { "from": "AGENTS.md", "to": "AGENTS.md" },
      { "from": "README.md", "to": "README.md" }
    ]
  },
  
  "cursor": {
    "name": "Cursor",
    "rootDir": ".cursor",
    "flows": [
      { "from": "rules/{name}.md", "to": ".cursor/rules/{name}.mdc" },
      {
        "from": "mcp.jsonc",
        "to": ".cursor/mcp.json",
        "namespace": true,
        "merge": "deep"
      }
    ]
  },
  
  "claude": {
    "name": "Claude Code",
    "rootDir": ".claude",
    "rootFile": "CLAUDE.md",
    "flows": [
      { "from": "CLAUDE.md", "to": "CLAUDE.md" },
      { "from": "rules/{name}.md", "to": ".claude/rules/{name}.md" },
      { "from": "agents/{name}.md", "to": ".claude/agents/{name}.md" }
    ]
  },
  
  "windsurf": {
    "name": "Windsurf",
    "rootDir": ".windsurf",
    "flows": [
      { "from": "rules/{name}.md", "to": ".windsurf/rules/{name}.md" }
    ]
  }
}
```

## Custom Platform Examples

### Example 4: Add Custom Platform

```jsonc
// workspace/.openpackage/platforms.jsonc
{
  "my-ai-platform": {
    "name": "My AI Platform",
    "rootDir": ".myai",
    "rootFile": "MYAI.md",
    "flows": [
      // Rules → prompts
      {
        "from": "rules/{name}.md",
        "to": ".myai/prompts/{name}.md"
      },
      
      // Agents → assistants with format conversion
      {
        "from": "agents/{name}.md",
        "to": ".myai/assistants/{name}.yaml"
      },
      
      // Config with custom structure
      {
        "from": "mcp.jsonc",
        "to": ".myai/config/mcp.yaml",
        "path": "$.servers",
        "merge": "deep"
      }
    ]
  }
}
```

### Example 5: Override Built-in Platform

```jsonc
// workspace/.openpackage/platforms.jsonc
{
  "cursor": {
    "flows": [
      // Custom directory structure
      {
        "from": "rules/{name}.md",
        "to": ".cursor/custom-rules/{name}.mdc"
      },
      
      // Additional transform
      {
        "from": "custom/{name}.jsonc",
        "to": ".cursor/custom/{name}.json",
        "pick": ["public"],
        "merge": "deep"
      }
    ]
  }
}
```

### Example 6: Disable Platforms

```jsonc
// workspace/.openpackage/platforms.jsonc
{
  // Disable unused platforms for performance
  "windsurf": { "enabled": false },
  "cline": { "enabled": false },
  "roo-code": { "enabled": false },
  "void": { "enabled": false }
}
```

## Testing and Validation

### Test with Dry-Run

```bash
# Preview what would happen
opkg install @user/package --dry-run
```

**Output:**
```
Would create:
  .cursor/rules/typescript.mdc
  .cursor/rules/python.mdc
  .cursor/mcp.json (merged)
  
Would skip:
  .windsurf/ (not detected)
```

### Validate Configuration

```bash
# Check configuration validity
opkg validate platforms --strict
```

**Output:**
```
✓ Configuration valid
✓ All flows valid
✓ All transforms found
✓ No circular dependencies
```

### Debug Flow Execution

```bash
# Enable debug logging
DEBUG=opkg:flows opkg install @user/package
```

**Output:**
```
[flows] Executing flow: rules/{name}.md → .cursor/rules/{name}.mdc
[flows] Matched: rules/typescript.md
[flows] Transform: extension .md → .mdc
[flows] Write: .cursor/rules/typescript.mdc
```

## Common Use Cases

### Use Case 1: Company-Wide Standards

**Global override for all projects:**

```jsonc
// ~/.openpackage/platforms.jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "rules/{name}.md",
        "to": ".cursor/company-rules/{name}.mdc"
      }
    ]
  }
}
```

### Use Case 2: Monorepo Setup

**Workspace-specific paths:**

```jsonc
// monorepo/.openpackage/platforms.jsonc
{
  "cursor": {
    "rootDir": ".cursor-workspace",
    "flows": [
      {
        "from": "rules/{name}.md",
        "to": ".cursor-workspace/shared-rules/{name}.mdc"
      }
    ]
  }
}
```

### Use Case 3: Development vs Production

**Environment-specific configs:**

```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "config.dev.yaml",
        "to": ".cursor/config.json",
        "when": { "key": "env", "equals": "development" },
        "merge": "deep"
      },
      {
        "from": "config.prod.yaml",
        "to": ".cursor/config.json",
        "when": { "key": "env", "equals": "production" },
        "merge": "replace"
      }
    ]
  }
}
```

### Use Case 4: Plugin System

**Compose plugins from multiple packages:**

```jsonc
{
  "cursor": {
    "flows": [
      {
        "from": "plugin.jsonc",
        "to": ".cursor/plugins.json",
        "namespace": true,
        "merge": "deep"
      }
    ]
  }
}
```

**Result:**
```json
{
  "packages": {
    "@user/plugin-a": { /* plugin A config */ },
    "@user/plugin-b": { /* plugin B config */ },
    "@user/plugin-c": { /* plugin C config */ }
  }
}
```

## Best Practices

### 1. Start Simple

Begin with basic flows:
```jsonc
{
  "from": "rules/{name}.md",
  "to": ".cursor/rules/{name}.md"
}
```

Add complexity as needed.

### 2. Use Merge for Composition

Enable multi-package workflows:
```jsonc
{
  "merge": "deep"
}
```

### 3. Namespace for Safety

Prevent conflicts:
```jsonc
{
  "namespace": true,
  "merge": "deep"
}
```

### 4. Test Incrementally

Test each flow individually:
```bash
opkg install @user/package --dry-run
```

### 5. Document Custom Flows

Add comments explaining intent:
```jsonc
{
  // Transform MCP config for multi-package composition
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "namespace": true,
  "merge": "deep"
}
```

## Next Steps

- **Learn flow syntax:** [Flows](./flows.md)
- **View flow options:** [Flow Reference](./flow-reference.md)
- **Configure platforms:** [Configuration](./configuration.md)
- **Debug issues:** [Troubleshooting](./troubleshooting.md)
