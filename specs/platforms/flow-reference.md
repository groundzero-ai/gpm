# Flow Reference

Complete technical reference for all flow fields, transforms, and options.

## Flow Schema

```typescript
interface Flow {
  // Required
  from: string
  to: string | MultiTargetFlows
  
  // Optional transforms
  pipe?: string[]
  map?: KeyMap
  pick?: string[]
  omit?: string[]
  path?: string
  embed?: string
  section?: string
  when?: Condition
  merge?: "deep" | "shallow" | "replace"
  namespace?: boolean | string
  handler?: string
}
```

## Required Fields

### `from` (string)

Source file pattern relative to package root.

**Pattern syntax:**
```jsonc
"rules/typescript.md"          // Exact file
"rules/*.md"                   // Glob pattern (all .md files)
"commands/*.md"                // Glob in specific directory
"skills/code-review/*.md"      // Glob in nested directory
```

**Glob pattern usage:**
```jsonc
{
  "from": "rules/*.md",
  "to": ".cursor/rules/*.mdc"  // * matches filename, changes extension
}
```

**Examples:**
```jsonc
"config.yaml"                  // Single file
"rules/*.md"                   // All markdown in rules/
"agents/*.md"                  // All agents
"commands/*.md"                // All commands
```

**Future support (coming soon):**
```jsonc
"**/*.md"                      // Recursive glob
"*.{md,yaml}"                  // Multiple extensions
```

### `to` (string | object)

Target path(s) relative to workspace root.

**Single target with glob:**
```jsonc
{
  "to": ".cursor/rules/*.mdc"  // * matches source filename
}
```

**Exact file mapping:**
```jsonc
{
  "to": "CLAUDE.md"  // Specific target file
}
```

**Multi-target:**
```jsonc
{
  "to": {
    ".cursor/mcp.json": {
      "namespace": true,
      "merge": "deep"
    },
    ".claude/config.json": {
      "embed": "mcp",
      "merge": "deep"
    }
  }
}
```

**Multi-target options:**
Each target key maps to an object with any flow options except `from`, `to`, and `handler`.

## Transform Fields

### `pipe` (string[])

Ordered list of transforms to apply to content.

**Example:**
```jsonc
{
  "pipe": ["filter-empty", "merge", "validate"]
}
```

**Built-in transforms:**

#### Format Converters
- `jsonc` - Parse/emit JSON with comments
- `yaml` - Parse/emit YAML
- `toml` - Parse/emit TOML
- `xml` - Parse/emit XML
- `ini` - Parse/emit INI

#### Merging
- `merge` - Deep merge with existing target
- `merge-shallow` - Shallow merge with existing target
- `replace` - Replace target entirely

#### Filtering
- `filter-comments` - Remove comment fields
- `filter-empty` - Remove empty objects/arrays
- `filter-null` - Remove null values

#### Markdown
- `sections` - Extract markdown sections
- `frontmatter` - Extract only frontmatter
- `body` - Extract only body content

#### Validation
- `validate` - Validate against basic schema
- `validate-schema(path)` - Validate against JSON schema at path

**Custom transforms:**
Register via `handler` field for complex logic.

### `map` (object)

Key and value transformations.

**Simple rename:**
```jsonc
{
  "map": {
    "oldKey": "newKey"
  }
}
```

**Dot notation (nested paths):**
```jsonc
{
  "map": {
    "theme": "workbench.colorTheme",
    "fontSize": "editor.fontSize"
  }
}
```

**Before:**
```json
{ "theme": "dark", "fontSize": 14 }
```

**After:**
```json
{
  "workbench": { "colorTheme": "dark" },
  "editor": { "fontSize": 14 }
}
```

**Wildcard mapping:**
```jsonc
{
  "map": {
    "ai.*": "cursor.*"
  }
}
```

**Before:**
```json
{ "ai": { "model": "gpt-4", "temperature": 0.7 } }
```

**After:**
```json
{ "cursor": { "model": "gpt-4", "temperature": 0.7 } }
```

**Complex mapping with transforms:**
```jsonc
{
  "map": {
    "fontSize": {
      "to": "editor.fontSize",
      "transform": "number",
      "default": 14
    }
  }
}
```

**Mapping object schema:**
```typescript
type KeyMap = {
  [sourceKey: string]: string | {
    to: string
    transform?: string
    default?: any
    values?: { [sourceValue: string]: any }
  }
}
```

**Value lookup table:**
```jsonc
{
  "map": {
    "model": {
      "to": "aiModel",
      "values": {
        "anthropic/claude-sonnet-4.5": "claude-sonnet-4.5",
        "openai/gpt-4": "gpt-4"
      }
    }
  }
}
```

**Before:**
```json
{ "model": "anthropic/claude-sonnet-4.5" }
```

**After:**
```json
{ "aiModel": "claude-sonnet-4.5" }
```

### `pick` (string[])

Whitelist specific keys (extract only these).

**Example:**
```jsonc
{
  "pick": ["theme", "fontSize", "tabSize"]
}
```

**Before:**
```json
{
  "theme": "dark",
  "fontSize": 14,
  "internal": "debug",
  "deprecated": true
}
```

**After:**
```json
{
  "theme": "dark",
  "fontSize": 14
}
```

**Nested keys:**
```jsonc
{
  "pick": ["editor.theme", "editor.fontSize"]
}
```

**Cannot use with `omit`.**

### `omit` (string[])

Blacklist specific keys (exclude these).

**Example:**
```jsonc
{
  "omit": ["internal", "debug", "deprecated"]
}
```

**Before:**
```json
{
  "theme": "dark",
  "fontSize": 14,
  "internal": "debug"
}
```

**After:**
```json
{
  "theme": "dark",
  "fontSize": 14
}
```

**Cannot use with `pick`.**

### `path` (string)

JSONPath expression to extract subset of data.

**Syntax:** JSONPath (subset of XPath for JSON)

**Example:**
```jsonc
{
  "path": "$.editor"
}
```

**Before:**
```json
{
  "editor": {
    "theme": "dark",
    "fontSize": 14
  },
  "terminal": {
    "shell": "bash"
  }
}
```

**After:**
```json
{
  "theme": "dark",
  "fontSize": 14
}
```

**Common expressions:**
```jsonc
"$.editor"           // Extract editor object
"$.servers.*"        // All servers
"$.servers[0]"       // First server
"$.servers[?(@.enabled)]"  // Servers where enabled=true
```

**Libraries:** Typically uses `jsonpath-plus` or similar.

### `embed` (string)

Wrap content under specified key.

**Example:**
```jsonc
{
  "embed": "mcp"
}
```

**Before:**
```json
{ "servers": { "db": {} } }
```

**After:**
```json
{
  "mcp": {
    "servers": { "db": {} }
  }
}
```

**Use case:** Embed package content in larger configuration structure.

**With merge:**
```jsonc
{
  "embed": "mcp",
  "merge": "deep"
}
```

**Existing target:**
```json
{ "other": "config" }
```

**Result:**
```json
{
  "other": "config",
  "mcp": {
    "servers": { "db": {} }
  }
}
```

### `section` (string)

TOML section name for embedding.

**Example:**
```jsonc
{
  "section": "mcp_servers"
}
```

**Before (JSON):**
```json
{ "host": "localhost", "port": 5432 }
```

**After (TOML):**
```toml
[mcp_servers]
host = "localhost"
port = 5432
```

**Use case:** Convert JSON/YAML to TOML sections.

### `when` (object)

Conditional execution based on context.

**Condition types:**

#### Platform check
```jsonc
{
  "when": { "platform": "cursor" }
}
```

Executes only if Cursor platform detected.

#### File existence
```jsonc
{
  "when": { "exists": ".cursor" }
}
```

Executes only if `.cursor` directory exists.

#### Key existence
```jsonc
{
  "when": { "key": "servers" }
}
```

Executes only if source has `servers` key.

#### Value equality
```jsonc
{
  "when": {
    "key": "env",
    "equals": "production"
  }
}
```

Executes only if `env` field equals `"production"`.

#### Composite AND
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

All conditions must be true.

#### Composite OR
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

Any condition can be true.

**Schema:**
```typescript
type Condition = 
  | { platform: string }
  | { exists: string }
  | { key: string; equals?: any }
  | { and: Condition[] }
  | { or: Condition[] }
```

### `merge` (string)

Merge strategy when target file exists.

**Options:**
- `"deep"` - Recursive merge (default for objects)
- `"shallow"` - Top-level merge only
- `"replace"` - Overwrite entirely (default for primitives/arrays)

**Deep merge:**
```jsonc
{ "merge": "deep" }
```

**Existing:**
```json
{
  "servers": {
    "db": { "host": "localhost" }
  }
}
```

**New:**
```json
{
  "servers": {
    "db": { "port": 5432 },
    "api": { "host": "api.example.com" }
  }
}
```

**Result:**
```json
{
  "servers": {
    "db": { "host": "localhost", "port": 5432 },
    "api": { "host": "api.example.com" }
  }
}
```

**Shallow merge:**
```jsonc
{ "merge": "shallow" }
```

**Result (shallow):**
```json
{
  "servers": {
    "db": { "port": 5432 },
    "api": { "host": "api.example.com" }
  }
}
```

Note: `db` object replaced entirely.

**Replace:**
```jsonc
{ "merge": "replace" }
```

**Result:**
```json
{
  "servers": {
    "db": { "port": 5432 },
    "api": { "host": "api.example.com" }
  }
}
```

Entire file replaced.

### `namespace` (boolean | string)

Wrap content under package-specific namespace.

**Boolean (auto-generate key):**
```jsonc
{
  "namespace": true
}
```

**Result:**
```json
{
  "packages": {
    "@user/package-name": {
      /* content */
    }
  }
}
```

**String (custom namespace key):**
```jsonc
{
  "namespace": "extensions"
}
```

**Result:**
```json
{
  "extensions": {
    "@user/package-name": {
      /* content */
    }
  }
}
```

**Use case:** Prevent collisions when multiple packages write to same file.

**With merge:**
```jsonc
{
  "namespace": true,
  "merge": "deep"
}
```

Merges namespaced content from multiple packages.

### `handler` (string)

Custom handler function for complex transformations.

**Example:**
```jsonc
{
  "handler": "custom-mcp-transform"
}
```

**Use case:** Complex logic not expressible via declarative options.

**Registration:**
```typescript
// In CLI code
registerHandler("custom-mcp-transform", (source, context) => {
  // Custom transformation logic
  return transformed;
});
```

**Not available in user configurations** - requires CLI code changes.

## Value Transforms

Used in `map` field for value transformations.

### Type Converters

- `number` - Convert to number
- `string` - Convert to string
- `boolean` - Convert to boolean
- `json` - Parse JSON string to object
- `date` - Parse date string to Date

**Example:**
```jsonc
{
  "map": {
    "fontSize": {
      "to": "editor.fontSize",
      "transform": "number"
    }
  }
}
```

### String Transforms

- `uppercase` - Convert to UPPERCASE
- `lowercase` - Convert to lowercase
- `title-case` - Convert To Title Case
- `camel-case` - Convert to camelCase
- `kebab-case` - Convert to kebab-case
- `snake-case` - Convert to snake_case
- `trim` - Remove leading/trailing whitespace
- `slugify` - Create URL-safe slug

**Example:**
```jsonc
{
  "map": {
    "name": {
      "to": "id",
      "transform": "kebab-case"
    }
  }
}
```

**Before:**
```json
{ "name": "My Custom Rule" }
```

**After:**
```json
{ "id": "my-custom-rule" }
```

### Array Transforms

- `array-append` - Append to existing array
- `array-unique` - Remove duplicates
- `array-flatten` - Flatten nested arrays

**Example:**
```jsonc
{
  "map": {
    "tags": {
      "to": "categories",
      "transform": "array-unique"
    }
  }
}
```

**Before:**
```json
{ "tags": ["typescript", "quality", "typescript"] }
```

**After:**
```json
{ "categories": ["typescript", "quality"] }
```

### Object Transforms

- `flatten` - Flatten nested object to dot notation
- `unflatten` - Expand dot notation to nested object
- `pick-keys` - Extract specific keys
- `omit-keys` - Remove specific keys

**Flatten example:**
```jsonc
{
  "map": {
    "config": {
      "to": "settings",
      "transform": "flatten"
    }
  }
}
```

**Before:**
```json
{
  "config": {
    "editor": { "theme": "dark" }
  }
}
```

**After:**
```json
{
  "settings": {
    "editor.theme": "dark"
  }
}
```

## Complete Examples

### Example 1: Simple File Copy with Extension Change

```jsonc
{
  "from": "rules/*.md",
  "to": ".cursor/rules/*.mdc"
}
```

**Behavior:**
- Copies all `.md` files from `rules/` directory
- Changes extension from `.md` to `.mdc`
- No content transformation

### Example 2: Format Conversion with Key Mapping

```jsonc
{
  "from": "settings.yaml",
  "to": ".cursor/settings.json",
  "map": {
    "theme": "workbench.colorTheme",
    "fontSize": "editor.fontSize"
  },
  "merge": "deep"
}
```

**Behavior:**
- Converts YAML to JSON
- Remaps keys to nested paths
- Deep merges with existing settings

### Example 3: Multi-Package MCP Composition

```jsonc
{
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "namespace": true,
  "merge": "deep"
}
```

**Behavior:**
- Wraps content under `packages.{packageName}`
- Merges with other packages
- Prevents naming conflicts

### Example 4: Conditional Platform Flow

```jsonc
{
  "from": "config.yaml",
  "to": ".cursor/config.json",
  "when": {
    "and": [
      { "platform": "cursor" },
      { "exists": "config.yaml" }
    ]
  },
  "merge": "deep"
}
```

**Behavior:**
- Executes only for Cursor platform
- Checks source file exists
- Deep merges configuration

### Example 5: Multi-Target with Different Transforms

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
- Parses source once
- Cursor: Namespaced JSON
- OpenCode: Embedded in JSON
- Codex: Extracted servers in TOML section

### Example 6: Markdown Frontmatter Transform

```jsonc
{
  "from": "agents/*.md",
  "to": ".claude/agents/*.md",
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
```

**Behavior:**
- Transforms YAML frontmatter
- Renames `role` → `type`
- Maps model values
- Preserves markdown body

### Example 7: Complex Pipeline with Filtering

```jsonc
{
  "from": "config.jsonc",
  "to": ".cursor/config.json",
  "pick": ["editor", "terminal"],
  "map": {
    "editor.theme": "workbench.colorTheme"
  },
  "pipe": ["filter-empty", "filter-null"],
  "merge": "deep"
}
```

**Behavior:**
- Extracts only `editor` and `terminal` keys
- Remaps nested theme key
- Filters empty/null values
- Deep merges result

## Best Practices

### 1. Keep Flows Simple

Start with minimal options:
```jsonc
{ "from": "rules/{name}.md", "to": ".platform/rules/{name}.md" }
```

Add complexity only when needed.

### 2. Use Merge for Composition

Enable multiple packages to coexist:
```jsonc
{ "merge": "deep" }
```

### 3. Namespace for Safety

Prevent conflicts:
```jsonc
{ "namespace": true, "merge": "deep" }
```

### 4. Test Conditionals

Ensure conditions work as expected:
```bash
opkg install @user/package --dry-run
```

### 5. Document Complex Flows

Add comments explaining intent:
```jsonc
{
  // Transform MCP config with namespacing for multi-package support
  "from": "mcp.jsonc",
  "to": ".cursor/mcp.json",
  "namespace": true,
  "merge": "deep"
}
```

### 6. Validate Configurations

Always validate before deploying:
```bash
opkg validate platforms --strict
```

## Performance Tips

- **Simple flows are fastest** - Direct copy when possible
- **Avoid deep merges** if shallow merge sufficient
- **Use conditionals** to skip unnecessary work
- **Multi-target flows reuse parsing** - More efficient than separate flows

## Troubleshooting

### Flow Not Executing

**Check conditions:**
```bash
opkg status  # Shows detected platforms
```

**Check syntax:**
```bash
opkg validate platforms
```

### Merge Not Working

**Remember merge strategy:**
- Default is `replace` for arrays/primitives
- Use `"merge": "deep"` explicitly for objects

### Keys Not Mapping

**Check dot notation:**
```jsonc
"theme": "workbench.colorTheme"  // Correct
"theme": "workbench/colorTheme"  // Wrong
```

### Transform Not Found

**Check transform name:**
```bash
opkg validate platforms --strict
```

Shows available transforms.

## Next Steps

- **See practical examples:** [Examples](./examples.md)
- **Learn platform detection:** [Detection](./detection.md)
- **Debug issues:** [Troubleshooting](./troubleshooting.md)
