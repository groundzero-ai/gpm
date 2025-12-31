### Save Pipeline – Conflict Resolution

#### 1. Overview

When multiple workspace candidates exist for the same registry path, the pipeline must decide which content to save. This document describes the conflict resolution rules for the **workspace → source** save flow.

---

#### 2. Single-Direction Principle

Save is a **unidirectional** operation: workspace content overwrites source content. There is no comparison or "merging" with existing source files. The only conflicts that need resolution are:

1. **Multiple workspace files mapping to the same registry path**
2. **Platform-specific vs. universal content selection**

The source file is only used for **optimization** (skip writes when content is identical) and **parity checking** (skip prompts when workspace matches source).

---

#### 3. Resolution Goals

For each group where multiple workspace candidates exist, the pipeline decides:

- Which workspace candidate becomes the **universal** package content
- Which workspace candidates should be saved as **platform-specific** variants
- Which candidates should be skipped (already at parity or user choice)

---

#### 4. Parity Checking

Before prompting, the pipeline checks if workspace files are already at parity with source:

##### Universal Parity
A workspace file is at **universal parity** if its content hash matches the universal source file.

##### Platform-Specific Parity
A workspace file is at **platform-specific parity** if:
- It has a platform association (e.g., `cursor`, `claude`)
- Its content hash matches the corresponding platform-specific source file (e.g., `commands.cursor.md`)

##### Auto-Skipping
Files at parity are automatically skipped with a clear message:
- "Already matches universal - auto-skipping"
- "Already matches platform-specific file - auto-skipping"

This eliminates unnecessary prompts when files are already up-to-date.

---

#### 5. Conflict Types

##### No Workspace Candidates
- No action needed
- Group is skipped entirely

##### Single Workspace Candidate
- **If matches source (parity)**: Auto-skip (no write needed)
- **If differs from source**: Write to source automatically (no prompt)

##### Multiple Identical Workspace Candidates (Same Content Hash)
- **If all match source (parity)**: Auto-skip all
- **If differ from source**: Pick newest by mtime, write to source (no prompt)

##### Multiple Differing Workspace Candidates
- **With `--force` flag:**
  - Auto-select newest by mtime (alphabetical tie-breaker if mtimes equal)
  - Skip others
  - No prompts
- **Without `--force`:**
  - Interactive resolution (see below)

---

#### 6. Interactive Resolution Flow

When multiple differing workspace candidates exist, the user is prompted **once per file** in a single-step process:

##### Step 1: Parity Filtering
For each candidate (ordered by mtime, newest first):
- Check universal parity → Auto-skip if matches
- Check platform-specific parity → Auto-skip if matches
- Continue to prompt if not at parity

##### Step 2: Per-File Prompts
For each remaining candidate:

**Before universal selected:**
- Options: `[Set as universal]` `[Mark as platform-specific]` `[Skip]`

**After universal selected:**
- Check if identical to selected universal → Auto-skip if matches
- Options: `[Mark as platform-specific]` `[Skip]`

##### Step 3: Resolution
After all prompts:
- **Universal selected**: Write to `<registry-path>`
- **Platform-specific marked**: Write to `<registry-path>.<platform>.<ext>`
- **Skipped**: No action (neither written)
- **No universal selected**: Original universal file remains untouched, only platform-specific files written

---

#### 7. Resolution Principles

The save flow ensures:

1. **Workspace always wins**: Source content is overwritten by workspace selections
2. **Smart filtering**: Files at parity are auto-skipped (no unnecessary prompts)
3. **Progressive disclosure**: Options simplify after universal is selected
4. **No data loss**: Skipped files remain in workspace, can be saved later
5. **Platform-aware**: Respects both universal and platform-specific parity
6. **User control**: User can skip individual files or mark as platform-specific

---

#### 8. Force Mode Behavior

With `--force` flag:
- Auto-selects newest workspace file by mtime
- **Tie-breaking**: If multiple files have same mtime, selects first alphabetically
- No prompts (fully automated)
- Transparent logging of selections and skipped files
- Does NOT auto-create platform-specific variants (only universal)

Example force mode output:
```
ℹ Force mode: Auto-selecting newest (.cursor/commands/test.md)
  Skipping: .claude/commands/test.md (older)
  Skipping: .opencode/commands/test.md (older)

✓ Saved my-pkg
  Updated: commands/test.md
```

Example with tie-breaking:
```
ℹ Force mode: Multiple files have same modification time (1/15/2024 10:30 AM)
  Auto-selecting first alphabetically: .claude/commands/test.md
  Tied files:
    → .claude/commands/test.md
      .cursor/commands/test.md
  Skipping: .cursor/commands/test.md (tied, not alphabetically first)

💡 Tip: If this wasn't the file you wanted, run without --force
```

---

#### 9. Edge Cases

##### No Universal Selected
If user skips all candidates or marks all as platform-specific:
- Original universal file remains **untouched**
- Only platform-specific files are written
- No confirmation prompt needed

##### All Files Skipped
If user skips all files (or all are at parity):
- No changes made
- No confirmation prompt needed
- Message: "No changes to `<path>`"

##### All Files at Parity
If all workspace files match source:
- All auto-skipped with clear messages
- No prompts shown
- Message: "No changes needed"

---

#### 10. Example Scenarios

##### Scenario A: Mixed Parity
```
Workspace:
  .cursor/commands/test.md   (hash: abc123) ← Matches universal
  .claude/commands/test.md   (hash: def456) ← Different!

Source:
  commands/test.md           (hash: abc123)

Interactive flow:
  ✓ .cursor/commands/test.md
    Already matches universal - auto-skipping

  .claude/commands/test.md (claude) [1/14/2024]
  What should we do with this file?
  > Mark as platform-specific

Result:
  Created: commands.claude.md (platform-specific)
```

##### Scenario B: Platform-Specific at Parity
```
Workspace:
  .cursor/commands/test.md   (hash: abc123) ← Different from universal
  .claude/commands/test.md   (hash: def456) ← Matches platform file!

Source:
  commands/test.md           (hash: xyz789)
  commands.claude.md         (hash: def456) ← Matches!

Interactive flow:
  .cursor/commands/test.md (cursor) [1/15/2024]
  What should we do with this file?
  > Set as universal

  ✓ .claude/commands/test.md
    Already matches platform-specific file - auto-skipping

Result:
  Updated: commands/test.md (from cursor)
```

##### Scenario C: One Edited, Others at Parity
```
Workspace:
  .cursor/commands/test.md   (hash: NEW123) ← User just edited
  .claude/commands/test.md   (hash: abc123) ← At parity
  .opencode/commands/test.md (hash: abc123) ← At parity

Source:
  commands/test.md           (hash: abc123)

Interactive flow:
  .cursor/commands/test.md (cursor) [1/15/2024 10:35 AM]
  What should we do with this file?
  > Set as universal

  ✓ .claude/commands/test.md
    Already matches universal - auto-skipping
  ✓ .opencode/commands/test.md
    Already matches universal - auto-skipping

Result:
  Updated: commands/test.md (from cursor)
```

---

#### 11. Removed Behaviors

The following behaviors have been removed as they conflicted with single-direction flow:

- ❌ Comparing workspace mtime against source mtime for resolution
- ❌ Preferring source content when it's newer
- ❌ Prompting to choose between source and workspace versions
- ❌ "Local wins with --force" logic
- ❌ Two-phase prompt flow (platform marking + universal selection)

---

#### 12. Summary

| Situation | Behavior |
|-----------|----------|
| **Single workspace file** | Write if differs from source, skip if at parity |
| **Multiple identical** | Pick newest, write if differs from source |
| **Multiple differing + force** | Auto-select newest (alphabetical tie-breaker) |
| **Multiple differing + interactive** | Prompt per file (parity-filtered, single-step) |
| **File matches universal** | Auto-skip with message |
| **File matches platform-specific** | Auto-skip with message |
| **No universal selected** | Original untouched, only platform-specific written |
| **All skipped** | No changes, no confirmation |

The conflict resolution ensures a smooth, intuitive workflow that minimizes prompts while giving users full control over their content.
