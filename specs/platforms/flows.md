# Platform Flows

## What are Flows?

**Flows** are declarative transformation rules that map universal package content to platform-specific formats. They define how files should be transformed, merged, and written during package installation.

**Core concept:** `source → transforms → target`

## Basic Flow Schema

```typescript
interface Flow {
  from: string                    // Source pattern (required)
  to: string | MultiTarget        // Target path (required)
  
  // Optional transformation fields
  pipe?: string[]                 // Transform pipeline
  map?: KeyMap                    // Key mapping/transformation
  pick?: string[]                 // Extract specific keys
  omit?: string[]                 // Exclude keys
  path?: string                   // JSONPath extraction
  embed?: string                  // Embed under key
  section?: string                // TOML/INI section
  when?: Condition                // Conditional execution
  merge?: "deep"|"shallow"|"replace"  // Merge strategy
  namespace?: boolean | string    // Namespace isolation
  handler?: string                // Custom handler
}
```

### Required Fields

#### `from` (string)

Source file pattern relative to package root.

**Simple path:**
```jsonc
{ "from": "rules/code-quality.md" }
```

**Pattern with placeholder:**
```jsonc
{ "from": "rules/{name}.md" }  // Matches: rules/typescript.md, rules/python.md
```

**Wildcards:**
```jsonc
{ "from": "config.yaml" }      // Single file
{ "from": "rules/*.md" }       // All .md files in rules/
{ "from": "**/*.md" }          // All .md files recursively
```

#### `to` (string | object)

Target file path relative to workspace root.

**Simple target:**
```jsonc
{ "to": ".cursor/rules/{name}.mdc" }  // Use {name} from source pattern
```

**Multi-target object:**
```jsonc
{
  "to": {
    ".cursor/mcp.json": { "namespace": true, "merge": "deep" },
    ".opencode/config.json": { "embed": "mcp", "merge": "deep" },
    ".codex/config.toml": { "section": "mcp", "merge": "deep" }
  }
}
```

## Execution Pipeline

Flows execute through a multi-stage pipeline:

```
1. Load        → Read source file, detect format
2. Extract     → Apply JSONPath if specified
3. Filter      → Apply pick/omit on keys
4. Map         → Transform keys and values
5. Transform   → Apply pipe transforms
6. Namespace   → Wrap in namespace if enabled
7. Embed       → Wrap under key/section if specified
8. Merge       → Merge with existing target
9. Write       → Serialize and write to disk
```

### Stage 1: Load

**Auto-detects format** from extension or content:
- `.json`, `.jsonc` → JSON parser
- `.yaml`, `.yml` → YAML parser
- `.toml` → TOML parser
- `.md` → Markdown with frontmatter parser

**Example:**
```yaml
# Source: config.yaml
theme: dark
fontSize: 14
```

### Stage 2: Extract (optional)

Apply **JSONPath** to extract subset:

```jsonc
{
  "from": "config.yaml",
  "to": ".cursor/config.json",
  "path": "$.editor"  // Extract only editor config
}
```

```yaml
# Source
editor:
  theme: dark
  fontSize: 14
terminal:
  shell: bash
```

**Result after extraction:**
```json
{
  "theme": "dark",
  "fontSize": 14
}
```

### Stage 3: Filter (optional)

**Pick** (whitelist) specific keys:
```jsonc
{
  "pick": ["theme", "fontSize"]  // Only include these keys
}
```

**Omit** (blacklist) specific keys:
```jsonc
{
  "omit": ["internal", "debug"]  // Exclude these keys
}
```

**Cannot use both** `pick` and `omit` in same flow.

### Stage 4: Map (optional)

Transform keys and values:

```jsonc
{
  "map": {
    "theme": "workbench.colorTheme",           // Simple rename
    "fontSize": {
      "to": "editor.fontSize",
      "transform": "number",                    // Type conversion
      "default": 14
    },
    "ai.*": "cursor.*"                          // Wildcard mapping
  }
}
```

**Before:**
```json
{ "theme": "dark", "fontSize": "14" }
```

**After:**
```json
{
  "workbench": { "colorTheme": "dark" },
  "editor": { "fontSize": 14 }
}
```

See [Flow Reference](./flow-reference.md#key-mapping) for complete mapping syntax.

### Stage 5: Transform (optional)

Apply **pipe transforms** in order:

```jsonc
{
  "pipe": ["filter-empty", "merge-shallow"]
}
```

**Available transforms:**
- Format converters: `jsonc`, `yaml`, `toml`, `xml`, `ini`
- Merging: `merge`, `merge-shallow`, `replace`
- Filtering: `filter-comments`, `filter-empty`, `filter-null`
- Markdown: `sections`, `frontmatter`, `body`
- Validation: `validate`, `validate-schema(path)`

See [Flow Reference](./flow-reference.md#built-in-transforms) for all transforms.

### Stage 6: Namespace (optional)

Wrap content under package-specific namespace:

```jsonc
{
  "namespace": true  // or string for custom namespace key
}
```

**Before:**
```json
{ "servers": { "db": {} } }
```

**After:**
```json
{
  "packages": {
    "@user/package-name": {
      "servers": { "db": {} }
    }
  }
}
```

**Purpose:** Prevent collisions when multiple packages target same file.

### Stage 7: Embed (optional)

Wrap content under specified key:

**JSON embedding:**
```jsonc
{
  "embed": "mcp"
}
```

```json
// Before: { "servers": {} }
// After:  { "mcp": { "servers": {} } }
```

**TOML sections:**
```jsonc
{
  "section": "mcp_servers"
}
```

```toml
# Before: [servers]
# After:  [mcp_servers]
```

### Stage 8: Merge

Combine with existing target file:

**Strategies:**
- `"deep"` - Recursively merge nested objects (default for objects)
- `"shallow"` - Merge only top-level keys
- `"replace"` - Overwrite entire file (default for arrays/primitives)

```jsonc
{
  "merge": "deep"
}
```

**Existing target:**
```json
{ "servers": { "db": {} } }
```

**Source content:**
```json
{ "servers": { "api": {} } }
```

**Result:**
```json
{
  "servers": {
    "db": {},   // Preserved from target
    "api": {}   // Added from source
  }
}
```

### Stage 9: Write

Serialize to target format and write to disk:
- Detects target format from extension
- Creates directories as needed
- Atomic write (temp file + rename)

## Format Conversion

Automatic bidirectional conversion between formats:

### YAML to JSON

```jsonc
{
  "from": "config.yaml",
  "to": ".cursor/config.json"
}
```

**Source (YAML):**
```yaml
theme: dark
fontSize: 14
```

**Target (JSON):**
```json
{
  "theme": "dark",
  "fontSize": 14
}
```

### JSONC to JSON

```jsonc
{
  "from": "settings.jsonc",
  "to": ".cursor/settings.json"
}
```

Comments are automatically stripped:

**Source (JSONC):**
```jsonc
{
  // User theme
  "theme": "dark"
}
```

**Target (JSON):**
```json
{
  "theme": "dark"
}
```

### JSON to TOML

```jsonc
{
  "from": "config.json",
  "to": ".codex/config.toml"
}
```

**Source (JSON):**
```json
{
  "server": {
    "host": "localhost",
    "port": 3000
  }
}
```

**Target (TOML):**
```toml
[server]
host = "localhost"
port = 3000
```

### Markdown Frontmatter

Transforms YAML frontmatter while preserving body:

```jsonc
{
  "from": "agents/{name}.md",
  "to": ".claude/agents/{name}.md",
  "map": {
    "role": "type"
  }
}
```

**Source:**
```markdown
---
role: assistant
model: claude-sonnet-4
---
# Agent Instructions
Help users with code reviews.
```

**Target:**
```markdown
---
type: assistant
model: claude-sonnet-4
---
# Agent Instructions
Help users with code reviews.
```

**Body is unchanged.**

## Merge Strategies

### Deep Merge

Recursively merge nested structures:

```jsonc
{ "merge": "deep" }
```

**Use when:**
- Composing configurations from multiple packages
- Preserving existing nested settings
- Adding keys at any depth

**Example:**
```json
// Target (existing)
{ "editor": { "theme": "dark", "fontSize": 12 } }

// Source (new)
{ "editor": { "fontSize": 14, "tabSize": 2 } }

// Result
{ "editor": { "theme": "dark", "fontSize": 14, "tabSize": 2 } }
```

### Shallow Merge

Merge only top-level keys:

```jsonc
{ "merge": "shallow" }
```

**Use when:**
- Replacing entire nested objects
- Avoiding deep merge complexity
- Clear ownership of nested structures

**Example:**
```json
// Target (existing)
{ "editor": { "theme": "dark" }, "terminal": { "shell": "bash" } }

// Source (new)
{ "editor": { "fontSize": 14 } }

// Result
{ "editor": { "fontSize": 14 }, "terminal": { "shell": "bash" } }
```

Note: `editor` object replaced entirely, `terminal` preserved.

### Replace

Completely overwrite target:

```jsonc
{ "merge": "replace" }
```

**Use when:**
- Source is authoritative
- Target should be discarded
- No composition needed

**Example:**
```json
// Target (existing) - ignored
{ "old": "config" }

// Source (new)
{ "new": "config" }

// Result
{ "new": "config" }
```

### Priority-Based Merging

When multiple packages write to same file:

**Priority order:**
1. Workspace content (highest)
2. Direct dependencies
3. Nested dependencies (shallower = higher priority)

**Conflicts:**
- Last writer wins (by priority)
- Warnings logged with package info

**Example:**
```
Package A (direct): { "servers": { "db": { "host": "localhost" } } }
Package B (direct): { "servers": { "db": { "port": 5432 } } }

Result: { "servers": { "db": { "host": "localhost", "port": 5432 } } }
Warning: "Package B merging with Package A in .cursor/mcp.json"
```

## Conditional Execution

Execute flows based on conditions:

### Platform Check

```jsonc
{
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "when": { "platform": "cursor" }
}
```

Flow executes only if Cursor platform is detected.

### File Existence

```jsonc
{
  "from": "config.yaml",
  "to": ".cursor/config.json",
  "when": { "exists": ".cursor" }
}
```

Flow executes only if `.cursor` directory exists.

### Key Check

```jsonc
{
  "from": "settings.jsonc",
  "to": ".cursor/settings.json",
  "when": { "key": "cursor" }
}
```

Flow executes only if source has `cursor` key.

### Value Check

```jsonc
{
  "from": "config.yaml",
  "to": ".cursor/dev.json",
  "when": {
    "key": "env",
    "equals": "development"
  }
}
```

Flow executes only if `env === "development"`.

### Composite Conditions

**AND condition:**
```jsonc
{
  "when": {
    "and": [
      { "platform": "cursor" },
      { "exists": "mcp.jsonc" }
    ]
  }
}
```

**OR condition:**
```jsonc
{
  "when": {
    "or": [
      { "platform": "cursor" },
      { "platform": "claude" }
    ]
  }
}
```

## Multi-Target Flows

One source file can flow to multiple targets with different transforms:

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

**Behavior:**
- Source parsed once
- Each target gets independent transformation
- Failures isolated per target

## Namespace Isolation

Prevent package collisions:

```jsonc
{
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "namespace": true,
  "merge": "deep"
}
```

**Package A content:**
```json
{ "servers": { "db": {} } }
```

**Package B content:**
```json
{ "servers": { "api": {} } }
```

**Result:**
```json
{
  "packages": {
    "@user/package-a": {
      "servers": { "db": {} }
    },
    "@user/package-b": {
      "servers": { "api": {} }
    }
  }
}
```

**Custom namespace key:**
```jsonc
{ "namespace": "extensions" }
```

```json
{
  "extensions": {
    "@user/package-a": { /* ... */ }
  }
}
```

## Performance Optimizations

### Simple File Copy Bypass

Flows with no transforms skip pipeline:

```jsonc
{
  "from": "rules/{name}.md",
  "to": ".cursor/rules/{name}.mdc"
}
```

**Optimized:** Direct file copy, no parsing.

### Parser Caching

Format parsers cached per file type within execution context.

### Single Source Parse

Multi-target flows parse source once:

```jsonc
{
  "from": "config.yaml",
  "to": {
    ".cursor/config.json": {},
    ".claude/config.json": {}
  }
}
```

**Optimized:** YAML parsed once, serialized twice.

### Lazy Evaluation

Conditional flows evaluated before loading source:

```jsonc
{
  "from": "large-file.json",
  "to": ".cursor/config.json",
  "when": { "platform": "claude" }  // False for Cursor
}
```

**Optimized:** File not loaded if condition false.

## Error Handling

### Parse Errors

```
Error: Failed to parse config.yaml: Invalid YAML syntax at line 5
```

**Solution:** Fix source file syntax.

### Transform Errors

```
Error: Transform 'unknown-transform' not found in pipe
Available: [jsonc, yaml, toml, merge, ...]
```

**Solution:** Use valid transform name from built-ins.

### Path Errors

```
Error: JSONPath '$.invalid..path' is invalid
```

**Solution:** Fix JSONPath syntax.

### Merge Conflicts

```
Warning: Package @user/b overwrites content from @user/a in .cursor/mcp.json
```

**Solution:** Check priority order or use namespace isolation.

## Best Practices

### 1. Start Simple

```jsonc
{
  "from": "rules/*.md",
  "to": ".cursor/rules/*.md"
}
```

Add transforms only when needed.

### 2. Test Incrementally

```bash
opkg install @user/package --dry-run
```

Preview changes before applying.

### 3. Use Merge for Composition

```jsonc
{
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "merge": "deep"
}
```

Allow multiple packages to compose content.

### 4. Isolate with Namespaces

```jsonc
{
  "namespace": true,
  "merge": "deep"
}
```

Prevent unintended conflicts.

### 5. Document Complex Flows

```jsonc
{
  // Transform MCP config for Cursor with namespacing
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "namespace": true,
  "merge": "deep"
}
```

## Next Steps

- **View complete flow options:** See [Flow Reference](./flow-reference.md)
- **See practical examples:** See [Examples](./examples.md)
- **Learn key mapping:** See [Flow Reference](./flow-reference.md#key-mapping)
- **Debug flows:** See [Troubleshooting](./troubleshooting.md)
