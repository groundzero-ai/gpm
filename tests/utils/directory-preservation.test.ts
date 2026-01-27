/**
 * Tests for directory preservation utilities
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

import { 
  extractDirectoryFromPattern, 
  buildPreservedDirectoriesSet 
} from '../../src/utils/directory-preservation.js';

// Test extractDirectoryFromPattern
{
  const cwd = '/workspace';
  
  // Directory patterns
  assert.equal(
    extractDirectoryFromPattern('.cursor', cwd),
    path.join(cwd, '.cursor'),
    'Should extract simple directory'
  );
  
  assert.equal(
    extractDirectoryFromPattern('.claude/', cwd),
    path.join(cwd, '.claude'),
    'Should extract directory with trailing slash'
  );
  
  // File patterns
  assert.equal(
    extractDirectoryFromPattern('.claude-plugin/plugin.json', cwd),
    path.join(cwd, '.claude-plugin'),
    'Should extract directory from file path'
  );
  
  assert.equal(
    extractDirectoryFromPattern('.agent', cwd),
    path.join(cwd, '.agent'),
    'Should treat extension-less pattern as directory'
  );
  
  // Root files (should return null)
  assert.equal(
    extractDirectoryFromPattern('CLAUDE.md', cwd),
    null,
    'Should return null for root file'
  );
  
  assert.equal(
    extractDirectoryFromPattern('AGENTS.md', cwd),
    null,
    'Should return null for root file'
  );
  
  console.log('✓ extractDirectoryFromPattern tests passed');
}

// Test buildPreservedDirectoriesSet with actual platform configuration
{
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opkg-preservation-test-'));
  
  try {
    const preserved = buildPreservedDirectoriesSet(tmpDir);
    
    // Should contain platform root directories based on detection patterns
    // Check for a few known platforms
    const cursorPath = path.join(tmpDir, '.cursor');
    const claudePath = path.join(tmpDir, '.claude');
    const opencodePath = path.join(tmpDir, '.opencode');
    
    assert.ok(
      preserved.has(cursorPath),
      `.cursor should be preserved: ${cursorPath}`
    );
    
    assert.ok(
      preserved.has(claudePath),
      `.claude should be preserved: ${claudePath}`
    );
    
    assert.ok(
      preserved.has(opencodePath),
      `.opencode should be preserved: ${opencodePath}`
    );
    
    // Should NOT contain the workspace root itself
    assert.ok(
      !preserved.has(tmpDir),
      'Workspace root should not be in preserved set'
    );
    
    console.log('✓ buildPreservedDirectoriesSet tests passed');
    console.log(`  Preserved ${preserved.size} platform directories`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

console.log('✅ All directory-preservation tests passed');
