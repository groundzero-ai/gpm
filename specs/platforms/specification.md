# Platform Specification

Technical requirements and contracts for the platform system. This document uses SHALL/MUST for normative requirements with scenario-based specifications.

## Platform Configuration Requirements

### Requirement: Platform Configuration Schema

Each platform entry in `platforms.jsonc` SHALL have the following structure:

- `name` (string): Human-readable display name
- `rootDir` (string): Platform root directory (e.g., `.cursor`, `.claude`)
- `rootFile?` (string): Optional root file at project root (e.g., `CLAUDE.md`, `QWEN.md`)
- `aliases?` (string[]): Optional CLI aliases
- `enabled?` (boolean): Whether platform is enabled (default: `true`)
- `flows` (Flow[]): Declarative transformation flows

#### Scenario: Load platform with valid configuration

- **WHEN** platform config defines all required fields with valid types
- **THEN** platform is loaded successfully and available for use

#### Scenario: Load platform with flows configuration

- **WHEN** platform config defines `flows` array with valid flow objects
- **THEN** flows are loaded and validated according to flow schema

#### Scenario: Invalid platform configuration missing required field

- **WHEN** platform config is missing `name`, `rootDir`, or `flows` field
- **THEN** configuration load fails with error: "Platform 'id': missing required field 'fieldName'"

#### Scenario: Invalid platform configuration with wrong types

- **WHEN** platform config has field with incorrect type (e.g., `name` as number)
- **THEN** configuration load fails with type error and expected type

### Requirement: Configuration Merge Hierarchy

Platform configurations SHALL be loaded and merged from three sources in priority order:

1. **Built-in**: Default configurations shipped with CLI
2. **Global**: User overrides in `~/.openpackage/platforms.jsonc`
3. **Workspace**: Project-specific overrides in `<workspace>/.openpackage/platforms.jsonc`

Merge order: workspace > global > built-in (last writer wins)

#### Scenario: Global override of platform flows

- **WHEN** global config defines flows for existing built-in platform
- **THEN** global flows completely replace built-in flows for that platform

#### Scenario: Workspace adds custom platform

- **WHEN** workspace config defines new platform not in built-in or global
- **THEN** custom platform is added and available for detection and flow execution

#### Scenario: Workspace disables built-in platform

- **WHEN** workspace config sets `enabled: false` for built-in platform
- **THEN** platform is skipped during detection and flow execution

#### Scenario: Invalid merged configuration

- **WHEN** merged configuration results in invalid platform definition
- **THEN** configuration load fails with error indicating which source/platform caused issue

#### Scenario: Field-level merge behavior

- **WHEN** platform field is defined in multiple configs
- **THEN** last writer wins (workspace > global > built-in)
- **AND** flows array is replaced entirely, not merged at element level

### Requirement: Platform Detection

Platform detection SHALL use following logic:

- **Directory detection**: Check if platform `rootDir` exists in workspace
- **Root file detection**: Check if platform `rootFile` exists at project root
- **Enabled flag**: Only detect platforms where `enabled` is `true` or omitted
- **Detection signal**: Platform detected if rootDir OR rootFile exists

#### Scenario: Detect platform by root directory

- **WHEN** platform's `rootDir` exists in workspace
- **THEN** platform is marked as detected and flows can execute

#### Scenario: Detect platform by root file

- **WHEN** platform's `rootFile` exists at project root
- **THEN** platform is marked as detected even without directory structure

#### Scenario: Skip disabled platform during detection

- **WHEN** platform has `enabled: false` in configuration
- **THEN** platform is not detected regardless of directory/file presence

#### Scenario: Platform detection with both signals

- **WHEN** both `rootDir` and `rootFile` exist
- **THEN** platform is detected (redundant but valid)

## Flow Configuration Requirements

### Requirement: Flow Schema Validation

The system SHALL support declarative flow configurations with following structure:

- **Required fields**: `from` (source pattern), `to` (target path or multi-target object)
- **Optional transforms**: `pipe`, `map`, `pick`, `omit`, `path`, `embed`, `section`, `when`, `merge`, `namespace`, `handler`
- **Multi-target support**: `to` can be object mapping target paths to transform options
- **Validation**: Validate all flows on configuration load

#### Scenario: Simple file mapping flow loads successfully

- **WHEN** flow defines `{ "from": "rules/{name}.md", "to": ".cursor/rules/{name}.mdc" }`
- **THEN** flow is validated and ready for execution

#### Scenario: Multi-target flow with different transforms loads successfully

- **WHEN** flow defines `to` as object with multiple target paths
- **THEN** each target configuration is validated independently

#### Scenario: Invalid flow missing required field

- **WHEN** flow is missing `from` or `to` field
- **THEN** validation fails with error: "Flow missing required field 'from'/'to'"

#### Scenario: Invalid flow with wrong field types

- **WHEN** flow has field with incorrect type (e.g., `merge` as number)
- **THEN** validation fails with type error

### Requirement: Flow Execution Pipeline

The system SHALL execute flows through multi-stage pipeline:

1. **Load**: Read source file, auto-detect format (YAML/JSON/JSONC/TOML/Markdown)
2. **Extract**: Apply JSONPath extraction if `path` specified
3. **Filter**: Apply `pick` (whitelist) or `omit` (blacklist) key filters
4. **Map**: Transform keys and values using `map` configuration
5. **Transform**: Apply pipe transforms in order
6. **Namespace**: Wrap content if `namespace` enabled
7. **Embed**: Wrap under key/section if `embed` or `section` specified
8. **Merge**: Merge with existing target using strategy
9. **Write**: Serialize to target format and write atomically

#### Scenario: Simple format conversion through pipeline

- **WHEN** YAML file flows to JSON target with no additional transforms
- **THEN** content is parsed as YAML, converted to JSON object, serialized as JSON

#### Scenario: Complex transformation pipeline with multiple stages

- **WHEN** flow defines `path`, `map`, `pipe`, `embed`, and `merge` options
- **THEN** transformations are applied in defined pipeline order

#### Scenario: Pipeline stage failure stops execution

- **WHEN** any pipeline stage fails (parse error, transform error, write error)
- **THEN** execution stops immediately and error is reported with context (stage, file, reason)

#### Scenario: Simple file copy bypasses pipeline

- **WHEN** flow has no transform options (only `from` and `to`)
- **THEN** file is copied directly without parsing for performance optimization

## Format Conversion Requirements

### Requirement: Automatic Format Conversion

The system SHALL support bidirectional format conversion:

- **JSONC**: Parse JSON with comments, strip comments when converting to strict JSON
- **YAML**: Convert between YAML and JSON object representations
- **TOML**: Convert between TOML and JSON object representations
- **Markdown**: Parse frontmatter as YAML, transform frontmatter, preserve body
- **Auto-detection**: Detect format from file extension or content analysis

#### Scenario: YAML to JSON conversion

- **WHEN** source is YAML and target is JSON
- **THEN** content is parsed as YAML object and serialized as JSON

#### Scenario: JSONC to JSON conversion strips comments

- **WHEN** source is JSONC and target is JSON
- **THEN** comments are stripped during conversion, content preserved

#### Scenario: Format auto-detection from extension

- **WHEN** file extension is `.yaml`, `.json`, `.toml`, or `.md`
- **THEN** format is detected from extension and appropriate parser used

#### Scenario: Format auto-detection from content

- **WHEN** file extension is ambiguous or missing
- **THEN** format is detected by attempting to parse with multiple parsers

## Merge Strategy Requirements

### Requirement: Configurable Merge Strategies

The system SHALL support multiple merge strategies:

- **Deep merge** (`merge: "deep"`): Recursively merge nested objects and arrays
- **Shallow merge** (`merge: "shallow"`): Merge only top-level keys
- **Replace** (default): Completely replace target content with source
- **Priority-based**: Workspace > direct deps > nested deps (shallower = higher priority)

#### Scenario: Deep merge of nested objects

- **WHEN** two JSON files are merged with `merge: "deep"`
- **THEN** nested objects are recursively merged, preserving non-overlapping keys at all levels

#### Scenario: Shallow merge of top-level keys only

- **WHEN** two JSON files are merged with `merge: "shallow"`
- **THEN** only top-level keys are merged, nested objects are replaced entirely

#### Scenario: Replace strategy overwrites target

- **WHEN** no merge strategy is specified
- **THEN** target file is completely replaced with source content

#### Scenario: Priority-based merge with multiple packages

- **WHEN** multiple packages define flows to same target with merge strategy
- **THEN** content is merged according to priority order (workspace > direct > nested)
- **AND** conflicts at leaf nodes resolved by last-writer-wins using priority

#### Scenario: Conflict warning logged during merge

- **WHEN** multiple packages write to same file and content conflicts
- **THEN** warning is logged: "Package @scope/b overwrites content from @scope/a in path"

## Key Mapping Requirements

### Requirement: Sophisticated Key Transformations

The system SHALL support key mapping with:

- **Dot notation**: Map to nested paths (`theme` → `workbench.colorTheme`)
- **Wildcard patterns**: Map multiple keys (`ai.*` → `cursor.*`)
- **Value transforms**: Apply type/string transforms during mapping
- **Value lookup tables**: Map values to platform-specific equivalents
- **Default values**: Provide fallback for missing keys

#### Scenario: Simple key rename with dot notation

- **WHEN** map defines `{ "theme": "workbench.colorTheme" }`
- **THEN** key `theme` is moved to nested path `workbench.colorTheme`

#### Scenario: Wildcard key mapping

- **WHEN** map defines `{ "ai.*": "cursor.*" }`
- **THEN** all keys under `ai` namespace are moved under `cursor` namespace

#### Scenario: Value transformation during mapping

- **WHEN** map defines `{ "fontSize": { "to": "editor.fontSize", "transform": "number" } }`
- **THEN** value is converted to number type and moved to target key

#### Scenario: Value lookup table mapping

- **WHEN** map defines `values` object with source-to-target mapping
- **THEN** source values are replaced with corresponding target values from table

#### Scenario: Default value for missing key

- **WHEN** map defines `default` value and source key is missing
- **THEN** default value is used in target

## Markdown Frontmatter Requirements

### Requirement: Frontmatter Transformation

The system SHALL support transforming YAML frontmatter in Markdown files:

- **Parse frontmatter**: Extract YAML frontmatter from Markdown
- **Transform frontmatter**: Apply key mapping and transforms to frontmatter only
- **Preserve body**: Keep Markdown body content unchanged
- **Serialize**: Reconstruct file with transformed frontmatter and original body

#### Scenario: Transform agent frontmatter with key mapping

- **WHEN** agent Markdown file has frontmatter with keys defined in map
- **THEN** frontmatter keys/values are transformed according to map
- **AND** markdown body content is preserved byte-for-byte

#### Scenario: Add frontmatter keys with defaults

- **WHEN** map defines new keys with default values
- **THEN** new keys are added to frontmatter without affecting body

#### Scenario: Remove frontmatter keys with omit

- **WHEN** omit list includes frontmatter keys
- **THEN** specified keys are removed from frontmatter without affecting body

## Multi-Package Composition Requirements

### Requirement: Priority-Based Multi-Package Merging

The system SHALL support composition from multiple packages using priority-based conflict resolution:

- **Priority order**: Workspace content > direct dependencies > nested dependencies (shallower = higher)
- **Conflict detection**: Detect when multiple packages write to same file paths
- **Conflict warnings**: Log warnings when conflicts occur with package information
- **Last-writer-wins**: Package with highest priority overwrites conflicting content at leaf nodes
- **Merge strategies**: Apply deep/shallow/replace merge based on flow configuration

#### Scenario: Direct dependency wins over nested dependency

- **WHEN** direct dependency and its nested dependency target same file
- **THEN** direct dependency content takes precedence (shallower = higher priority)
- **AND** warning logged: "Package @scope/direct overwrites @scope/nested in path"

#### Scenario: Later direct dependency wins over earlier

- **WHEN** two direct dependencies define conflicting content for same target
- **THEN** package listed later in dependency order wins (higher priority)
- **AND** warning logged with package information

#### Scenario: Workspace content preserved with highest priority

- **WHEN** workspace has manually-edited content in target file
- **THEN** workspace content is preserved (highest priority)
- **AND** package content does not overwrite manual edits

#### Scenario: Multi-package deep merge with priority resolution

- **WHEN** multiple packages define flows to same target with `merge: "deep"`
- **THEN** content is deeply merged according to priority order
- **AND** conflicts at leaf nodes resolved by priority (last-writer-wins)

## Conditional Execution Requirements

### Requirement: Context-Based Conditional Flows

The system SHALL support conditional flow execution:

- **Platform checks**: Execute only if specific platform detected (`platform: "cursor"`)
- **Existence checks**: Execute only if file/directory exists (`exists: ".cursor"`)
- **Key checks**: Execute only if source key exists (`key: "servers"`)
- **Value checks**: Execute only if key equals value (`equals: "production"`)
- **Composite conditions**: Support `and` and `or` operators for complex logic

#### Scenario: Platform-conditional flow execution

- **WHEN** flow has `when: { "platform": "cursor" }` condition
- **THEN** flow executes only when Cursor platform is detected in workspace

#### Scenario: File existence check before execution

- **WHEN** flow has `when: { "exists": ".cursor" }` condition
- **THEN** flow executes only if `.cursor` directory exists

#### Scenario: Composite AND condition requires all true

- **WHEN** flow has `when: { "and": [{ "platform": "cursor" }, { "exists": "mcp.jsonc" }] }`
- **THEN** flow executes only if both Cursor detected AND mcp.jsonc exists

#### Scenario: Composite OR condition requires any true

- **WHEN** flow has `when: { "or": [{ "platform": "cursor" }, { "platform": "claude" }] }`
- **THEN** flow executes if either Cursor OR Claude platform is detected

## Content Embedding Requirements

### Requirement: Content Embedding in Target Structures

The system SHALL support embedding content within target structures:

- **JSON embedding**: Wrap content under specified key with `embed: "key"`
- **TOML sections**: Place content in TOML section with `section: "section_name"`
- **Merge with embedding**: Combine embedding with merge strategies

#### Scenario: Embed content in JSON structure

- **WHEN** flow defines `embed: "mcp"` for JSON target
- **THEN** source content is wrapped under `{ "mcp": <content> }` in target

#### Scenario: TOML section embedding

- **WHEN** flow defines `section: "mcp_servers"` for TOML target
- **THEN** content is placed under `[mcp_servers]` section in TOML file

#### Scenario: Embed and deep merge together

- **WHEN** flow defines both `embed: "mcp"` and `merge: "deep"`
- **THEN** embedded content is deep merged with existing embedded section in target

## Built-in Transform Requirements

### Requirement: Comprehensive Built-in Value Transforms

The system SHALL provide built-in value transforms:

**Type Converters:** `number`, `string`, `boolean`, `json`, `date`
**String Transforms:** `uppercase`, `lowercase`, `title-case`, `camel-case`, `kebab-case`, `snake-case`, `trim`, `slugify`
**Array Transforms:** `array-append`, `array-unique`, `array-flatten`
**Object Transforms:** `flatten`, `unflatten`, `pick-keys`, `omit-keys`

#### Scenario: Type conversion transform

- **WHEN** transform is `number` and value is string "42"
- **THEN** value is converted to number 42

#### Scenario: String case transform

- **WHEN** transform is `kebab-case` and value is "helloWorld"
- **THEN** value is converted to "hello-world"

#### Scenario: Array deduplication transform

- **WHEN** transform is `array-unique` and value is `[1, 2, 2, 3]`
- **THEN** value is converted to `[1, 2, 3]`

#### Scenario: Object flattening transform

- **WHEN** transform is `flatten` and value is `{ "a": { "b": 1 } }`
- **THEN** value is converted to `{ "a.b": 1 }`

## Namespace Isolation Requirements

### Requirement: Package Namespace Isolation

The system SHALL support namespace isolation to prevent package collisions:

- **Automatic wrapping**: Wrap content under `packages.{packageName}` when `namespace: true`
- **Custom namespace key**: Support custom key via `namespace: "customKey"`
- **Merge with namespacing**: Combine namespacing with merge strategies
- **Per-package isolation**: Each package gets separate namespace

#### Scenario: Automatic namespace wrapping

- **WHEN** flow has `namespace: true`
- **THEN** content is wrapped under `packages[@scope/package-name]` key in target

#### Scenario: Custom namespace key

- **WHEN** flow has `namespace: "extensions"`
- **THEN** content is wrapped under `extensions[@scope/package-name]` key in target

#### Scenario: Namespace isolation prevents conflicts

- **WHEN** multiple packages use namespacing for same target
- **THEN** each package's content is isolated under its own namespace
- **AND** no conflicts occur between packages

## Validation Requirements

### Requirement: Configuration Validation

The system SHALL validate configurations with clear error reporting:

- **Schema validation**: Validate required fields and types
- **Transform validation**: Verify transform names exist in built-ins
- **JSONPath validation**: Validate JSONPath expression syntax
- **Circular dependency detection**: Detect and report circular flow dependencies
- **Context-rich errors**: Include file path, platform, flow index, and fix suggestions

#### Scenario: Missing required field validation

- **WHEN** flow is missing `from` or `to` field
- **THEN** validation fails with error: "Platform 'id' flow N: missing required field 'from'/'to'"

#### Scenario: Invalid transform name validation

- **WHEN** flow references non-existent transform in `pipe`
- **THEN** validation fails with error: "Unknown transform 'xyz'. Available: [list]"

#### Scenario: Invalid JSONPath expression validation

- **WHEN** flow defines invalid JSONPath in `path` field
- **THEN** validation fails with error: "Invalid JSONPath expression: <expr>. <reason>"

#### Scenario: Circular dependency detection

- **WHEN** flows create circular transformation dependency
- **THEN** validation fails with error: "Circular dependency detected: A → B → A"

## Performance Requirements

### Requirement: Performance Optimization

The system SHALL optimize flow execution:

- **Simple file copy bypass**: Skip pipeline for flows with no transforms
- **Parser caching**: Cache format parsers per file type within execution context
- **Single source parse**: Parse source once for multi-target flows
- **Lazy evaluation**: Evaluate conditional flows only when conditions might be true
- **Structural sharing**: Share unchanged object structures during merges

#### Scenario: Simple file copy optimization

- **WHEN** flow has no transforms (just `from` and `to` with extension change)
- **THEN** file is copied directly without parsing pipeline

#### Scenario: Multi-target source caching

- **WHEN** flow has multiple targets from same source
- **THEN** source is parsed once and AST/object is reused for all targets

#### Scenario: Conditional flow lazy evaluation

- **WHEN** flow has `when` condition that evaluates to false
- **THEN** flow is skipped without loading or parsing source file

## Unidirectional Flow Requirements

### Requirement: Unidirectional Flow Configuration

The system SHALL define all flows as unidirectional transformations from package to workspace:

- **Flow direction**: All flows transform from universal package format to platform-specific workspace format
- **Source (`from`)**: Always relative to package root (universal format)
- **Target (`to`)**: Always relative to workspace root (platform-specific format)
- **Save operation**: Uses reverse lookup and inverse transformation (workspace → package)
- **No circular dependencies**: Flows cannot reference each other in cycles

#### Scenario: Install executes flows forward (package → workspace)

- **WHEN** installing a package with flows
- **THEN** flows execute in forward direction from package to workspace
- **AND** source files are in universal package format

#### Scenario: Save performs reverse lookup (workspace → package)

- **WHEN** saving workspace files to package
- **THEN** system performs reverse lookup matching workspace paths to flow targets
- **AND** applies inverse transformations to convert workspace format to universal format

#### Scenario: Circular dependency validation prevents cycles

- **WHEN** flows would create circular dependency within same direction
- **THEN** validation fails with error showing cycle path

## Schema Versioning Requirements

### Requirement: Local JSON Schema Support

The system SHALL support schema versioning using local JSON schema files:

- **Schema field**: Optional `$schema` field in platforms.jsonc referencing local schema
- **Local schema path**: Resolve relative to workspace or node_modules
- **IDE support**: Enable validation and autocomplete via JSON schema
- **Version detection**: Infer version from schema path or default to CLI version
- **Validation**: Validate config against specified schema version

#### Scenario: Explicit schema version reference

- **WHEN** platforms.jsonc includes `$schema: "./node_modules/opkg-cli/schemas/platforms-v1.json"`
- **THEN** config is validated against v1 schema
- **AND** IDE provides v1-specific autocomplete and validation

#### Scenario: Missing schema field defaults to current

- **WHEN** platforms.jsonc has no `$schema` field
- **THEN** config defaults to current CLI version schema
- **AND** validation uses latest schema rules

#### Scenario: Schema path resolution

- **WHEN** schema path is relative (e.g., `./node_modules/...` or `./schemas/...`)
- **THEN** system resolves path relative to config file location
- **AND** loads schema for IDE and CLI validation

## Custom Handler Requirements

### Requirement: Custom Handler Escape Hatch

The system SHALL support custom handlers for edge cases not expressible via declarative options:

- **Handler registration**: Register handler functions in CLI code
- **Handler invocation**: Invoke handler when `handler: "name"` specified in flow
- **Handler context**: Provide full flow context (source, target, package info) to handlers
- **Handler errors**: Report handler errors clearly with handler name and context
- **Not user-configurable**: Handlers require CLI code changes, not available in user configs

#### Scenario: Custom handler for complex transformation

- **WHEN** flow defines `handler: "custom-mcp-transform"`
- **AND** handler is registered in CLI code
- **THEN** handler function is invoked with source content and full context

#### Scenario: Handler not found error

- **WHEN** flow references unregistered handler name
- **THEN** execution fails with error: "Handler 'xyz' not found. Available: [list]"

#### Scenario: Handler error with context

- **WHEN** custom handler throws error during execution
- **THEN** error is caught and reported with handler name, source file, and error details
