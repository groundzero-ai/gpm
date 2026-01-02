# Set Command Behavior Specification

## Pipeline Overview

The set command follows a clear pipeline:

1. **Input Validation** - Validate mode and options
2. **Package Resolution** - Locate the target package
3. **Manifest Loading** - Parse current `openpackage.yml`
4. **Update Determination** - Collect field updates (interactive or flags)
5. **Change Detection** - Compare old vs new values
6. **Field Validation** - Validate all update values
7. **Confirmation** - Show diff and confirm (if interactive)
8. **Manifest Update** - Apply changes and write file
9. **Success Display** - Show results

## Mode Detection

### Interactive Mode

**Triggered when:**
- No field flags provided (`--ver`, `--name`, etc.)
- Not in `--non-interactive` mode

**Behavior:**
- Prompts for each field
- Shows current values as defaults
- Empty input = keep current value
- Returns only changed fields
- Requires confirmation before writing

**Example:**
```bash
opkg set my-package
# → Enters interactive prompt mode
```

### Batch Mode

**Triggered when:**
- One or more field flags provided
- May or may not be in `--non-interactive` mode

**Behavior:**
- Extracts values from CLI options
- No prompting
- Processes only specified fields
- Shows diff
- Writes immediately (no confirmation)

**Example:**
```bash
opkg set my-package --ver 1.2.0 --author "Jane Doe"
# → Batch update of specified fields
```

### Non-Interactive Mode

**Triggered when:**
- `--non-interactive` flag provided

**Validation:**
- Must have at least one field flag
- Errors immediately if no flags

**Behavior:**
- Same as batch mode
- No prompts or confirmations
- Fails fast on errors

**Example:**
```bash
opkg set my-package --ver 1.0.0 --non-interactive
# → Batch update, no prompts, suitable for CI/CD
```

## Package Resolution Strategy

### When No Package Argument Provided

**Search order:**
1. Check for `openpackage.yml` in current directory
2. Error if not found

**Code path:**
```typescript
const manifestPath = path.join(cwd, 'openpackage.yml');
if (!(await exists(manifestPath))) {
  throw new Error('No openpackage.yml found in current directory');
}
```

### When Package Name Provided

**Search order:**
1. Workspace packages: `.openpackage/packages/<name>/`
2. Global packages: `~/.openpackage/packages/<name>/`
3. Error if not found (registry excluded)

**Code path:**
```typescript
const resolved = await resolveMutableSource({
  cwd,
  packageName: packageInput
});
// Searches workspace → global, rejects registry
```

### Source Type Detection

After resolution, determine source type for display:

- **`cwd`** - Package in current directory
- **`workspace`** - Package in `.openpackage/packages/`
- **`global`** - Package in `~/.openpackage/packages/`

## Update Extraction

### From CLI Options (Batch Mode)

**Process:**
1. Check each option field
2. If defined, extract value
3. Apply transformations:
   - **name**: Normalize to lowercase
   - **keywords**: Split by whitespace, filter empty
   - **version**: Use as-is (validated later)
   - Others: Use as-is

**Code snippet:**
```typescript
if (options.name !== undefined) {
  updates.name = normalizePackageName(options.name);
}
if (options.ver !== undefined) {
  updates.version = options.ver;
}
if (options.keywords !== undefined) {
  updates.keywords = options.keywords.trim().split(/\s+/).filter(k => k.length > 0);
}
```

### From Interactive Prompts

**Process:**
1. Display current config
2. Prompt for each field with current value as default
3. Compare response to current value
4. Return only changed fields

**Prompt flow:**
```
Current package: my-package
Version: 1.0.0
Path: /path/to/package

Leave blank to keep current value, or enter new value:

Name [my-package]: 
Version [1.0.0]: 1.1.0
Description [My package]: Updated description
Keywords [test demo]: test demo updated
Author [John Doe]: 
License [MIT]: 
Homepage []: https://example.com
Private [false]: 
```

**Change detection:**
- Compare normalized response to current value
- For keywords, parse and compare arrays
- For booleans, compare boolean values
- Only include changed fields in result

## Change Detection

**Algorithm:**
```typescript
for (const [field, newValue] of Object.entries(updates)) {
  const oldValue = currentConfig[field];
  
  if (Array.isArray(newValue) && Array.isArray(oldValue)) {
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  } else if (oldValue !== newValue) {
    changes.push({ field, oldValue, newValue });
  }
}
```

**Special cases:**
- **Arrays (keywords)**: Deep comparison via JSON.stringify
- **Undefined vs empty**: Treat as different
- **Boolean flags**: Compare boolean values

**Result:**
- Array of `ConfigChange` objects
- Each contains: `field`, `oldValue`, `newValue`
- Empty array if no changes

## Field Validation

### Version Validation

**Rules:**
- Must be valid semantic version
- Checked using `semver.valid()`

**Example:**
```typescript
if (updates.version !== undefined) {
  if (!semver.valid(updates.version)) {
    throw new ValidationError(
      `Invalid version format: "${updates.version}"\n` +
      `Version must be valid semver (e.g., 1.0.0, 2.1.3-beta.1)`
    );
  }
}
```

### Name Validation

**Rules:**
- Must pass `validatePackageName()`
- Automatically normalized to lowercase

**Example:**
```typescript
if (updates.name !== undefined) {
  validatePackageName(updates.name);
  // Throws ValidationError if invalid
}
```

### Homepage Validation

**Rules:**
- Must be valid URL format
- Empty/whitespace-only strings skip validation

**Example:**
```typescript
if (updates.homepage !== undefined && updates.homepage.trim().length > 0) {
  try {
    new URL(updates.homepage);
  } catch {
    throw new ValidationError(`Invalid homepage URL: "${updates.homepage}"`);
  }
}
```

### Other Fields

**No validation:**
- `description` - Any string
- `keywords` - Already parsed and filtered
- `author` - Any string
- `license` - Any string (should be valid SPDX, but not enforced)
- `private` - Boolean (type-safe)

## Manifest Update Strategy

### No Changes Scenario

**When:** Change detection returns empty array

**Behavior:**
1. Display "No changes made" message
2. Return success immediately
3. Don't write file

**Code:**
```typescript
if (changes.length === 0) {
  displayNoChanges(packageName);
  return { success: true, data: { updatedFields: [] } };
}
```

### With Changes Scenario

**Process:**
1. Show change diff
2. Confirm (if interactive and not force)
3. Merge updates into current config
4. Write updated YAML

**Merge strategy:**
```typescript
const updatedConfig = {
  ...currentConfig,
  ...updates
};
```

**YAML serialization:**
- Uses `writePackageYml()` from existing utils
- Maintains formatting consistency
- Preserves field order where possible

## Confirmation Flow

### When Confirmation Required

**Conditions:**
- Interactive mode (field flags not provided)
- Not force mode (`--force` not present)
- Changes detected

**Prompt:**
```
📝 Changes to apply:
  version: 1.0.0 → 1.1.0
  description: Old → New

Apply these changes? (y/n): 
```

**Behavior:**
- Default: `true` (Enter = yes)
- `n` or `N`: Cancel operation
- Any other input: Proceed

### When Confirmation Skipped

**Conditions:**
- Batch mode (field flags provided)
- Force mode (`--force` present)
- Non-interactive mode

**Behavior:**
- Show diff
- Apply changes immediately
- No prompt

## File Writing

### Write Process

1. **Serialize to YAML**
   ```typescript
   const content = serializePackageYml(updatedConfig);
   ```

2. **Write to file**
   ```typescript
   await writeTextFile(manifestPath, content);
   ```

3. **Atomic operation**
   - Write completes or fails entirely
   - No partial writes

### Error Handling During Write

**Possible errors:**
- File system permissions
- Disk space
- File locked by another process

**Behavior:**
- Catch exception
- Return failure result with error message
- File remains in original state (no partial update)

## Output Display

### Change Diff Format

```
📝 Changes to apply:
  field: oldValue → newValue
  field: oldValue → newValue
```

**Value formatting:**
- `(not set)` for undefined/null
- `[]` for empty arrays
- `[item1, item2]` for arrays
- `true`/`false` for booleans
- Plain string for strings

### Success Format

```
✓ Updated <package-name> manifest
  Path: <display-path>
  Type: <source-type> package
  Updated: <field1>, <field2>, ...
```

**Path display:**
- Relative path if within CWD
- Absolute path if outside CWD
- Tilde notation for home directory

### No Changes Format

```
✓ No changes made to <package-name>
  Manifest unchanged
```

## Error Scenarios

### Early Validation Errors

**Before file operations:**
- Non-interactive without flags
- Package not found
- No openpackage.yml in CWD

**Behavior:**
- Throw error immediately
- No file operations attempted
- Clear error message

### Field Validation Errors

**After change detection:**
- Invalid version format
- Invalid package name
- Invalid homepage URL

**Behavior:**
- Throw error before confirmation
- No file operations attempted
- Specific validation message

### File Operation Errors

**During write:**
- Permission denied
- Disk full
- File locked

**Behavior:**
- Catch exception
- Return failure result
- Preserve original file

## State Transitions

### State Machine

```
START
  ↓
INPUT_VALIDATION
  ↓ (valid)
PACKAGE_RESOLUTION
  ↓ (found)
MANIFEST_LOADING
  ↓ (loaded)
UPDATE_DETERMINATION
  ↓ (interactive or flags)
CHANGE_DETECTION
  ↓ (changes detected)
FIELD_VALIDATION
  ↓ (valid)
CONFIRMATION
  ↓ (confirmed)
MANIFEST_UPDATE
  ↓ (written)
SUCCESS_DISPLAY
  ↓
END
```

**Exit points:**
- Input validation failure
- Package not found
- No changes detected (success)
- Field validation failure
- User cancellation
- Write failure

## Side Effects

### File System Changes

**Modified:**
- Target package's `openpackage.yml`

**Not Modified:**
- Package directory structure
- Package files/content
- Workspace index
- Registry snapshots

### State Changes

**Local:**
- Package manifest updated in place
- Timestamp updated on file

**No Remote Changes:**
- Registry not affected
- Remote not contacted
- No network operations

## Concurrency Considerations

**File locking:**
- No explicit locking implemented
- Race condition possible if multiple processes modify same manifest
- Last write wins

**Recommendations:**
- Don't run multiple `set` commands on same package simultaneously
- CI/CD should serialize set operations

## Performance Characteristics

**Time complexity:**
- O(1) for package resolution
- O(n) for interactive prompts (n = number of fields)
- O(1) for validation
- O(1) for file write

**Space complexity:**
- O(1) memory usage
- Small YAML files (~1-5 KB typical)

**Typical execution time:**
- < 100ms for batch mode
- Human-dependent for interactive mode

## Idempotency

**Behavior:**
- Running same command twice with same values = no-op on second run
- Change detection prevents unnecessary writes
- Safe to retry

**Example:**
```bash
opkg set my-package --ver 1.0.0  # Updates version
opkg set my-package --ver 1.0.0  # No changes detected
```

## Testing Strategy

**Unit tests:**
- Package resolution
- Update extraction
- Change detection
- Field validation
- Manifest merging

**Integration tests:**
- End-to-end pipeline
- CWD package updates
- Workspace package updates
- Error scenarios
- No-op scenarios

**Manual tests:**
- Interactive mode flow
- Confirmation prompts
- Output formatting
- Edge cases
