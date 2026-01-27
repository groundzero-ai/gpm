/**
 * Test: Add files to workspace package, then apply without prior install
 * 
 * This test verifies the fix for the issue where `opkg add` followed by `opkg apply`
 * would fail with "No packages installed" because the workspace package wasn't in the index.
 * 
 * Expected behavior:
 * 1. `opkg add .cursor` adds files to .openpackage/ (no index update)
 * 2. `opkg apply --platforms cursor` should:
 *    - Detect workspace package exists in .openpackage/
 *    - Create context for workspace package even if not in index
 *    - Execute apply and upsert to index
 *    - Apply files to .cursor/ platform
 */

import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import { buildApplyContext } from '../../../src/core/install/unified/context-builders.js';
import { runUnifiedInstallPipeline } from '../../../src/core/install/unified/pipeline.js';
import { readWorkspaceIndex } from '../../../src/utils/workspace-index-yml.js';

async function runAddThenApplyWorkspaceTest(): Promise<void> {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), 'opkg-add-apply-'));

  try {
    console.log(`\n🧪 Testing add → apply workflow in ${tempDir}\n`);
    
    // Step 1: Create workspace structure as if 'opkg add .cursor' was run
    await mkdir(join(tempDir, '.openpackage', 'commands'), { recursive: true });
    await mkdir(join(tempDir, '.openpackage', 'rules'), { recursive: true });
    
    // Create workspace manifest
    await writeFile(
      join(tempDir, '.openpackage', 'openpackage.yml'),
      'name: test-workspace\nversion: 1.0.0\n',
      'utf8'
    );
    
    // Create some files in workspace package
    await writeFile(
      join(tempDir, '.openpackage', 'commands', 'cleanup.md'),
      '# Cleanup Command',
      'utf8'
    );
    await writeFile(
      join(tempDir, '.openpackage', 'rules', 'code.md'),
      '# Code Rules',
      'utf8'
    );
    
    // Create platform directory
    await mkdir(join(tempDir, '.cursor'), { recursive: true });
    
    // Change to temp directory
    process.chdir(tempDir);
    
    // Verify: No workspace index exists yet (simulating state after `opkg add`)
    const indexPath = join(tempDir, '.openpackage', 'openpackage.index.yml');
    assert.equal(
      existsSync(indexPath),
      false,
      'Workspace index should not exist before apply (simulating post-add state)'
    );
    console.log('✓ Verified: No workspace index exists (as after opkg add)');
    
    // Step 2: Run apply (should work even though workspace package is not in index)
    console.log('\n📝 Running apply...\n');
    const contexts = await buildApplyContext(tempDir, undefined, { platforms: ['cursor'] });
    
    // Verify contexts were created
    assert.ok(Array.isArray(contexts), 'buildApplyContext should return array for bulk apply');
    assert.equal(contexts.length, 1, 'Should create context for workspace package');
    assert.equal(contexts[0].source.packageName, 'test-workspace', 'Should create context for test-workspace');
    console.log('✓ Apply context created for workspace package');
    
    // Execute apply pipeline
    for (const ctx of contexts) {
      const result = await runUnifiedInstallPipeline(ctx);
      assert.equal(result.success, true, `Apply should succeed: ${result.error || 'unknown error'}`);
    }
    console.log('✓ Apply pipeline executed successfully');
    
    // Step 3: Verify workspace index was created and populated
    assert.equal(
      existsSync(indexPath),
      true,
      'Workspace index should be created by apply'
    );
    console.log('✓ Workspace index created');
    
    const { index } = await readWorkspaceIndex(tempDir);
    assert.ok(
      index.packages['test-workspace'],
      'Workspace package should be in index after apply'
    );
    assert.equal(
      index.packages['test-workspace'].path,
      './.openpackage/',
      'Workspace package path should be ./.openpackage/'
    );
    console.log('✓ Workspace package added to index');
    
    // Step 4: Verify files were applied to platform
    const cursorCommandPath = join(tempDir, '.cursor', 'commands', 'cleanup.md');
    assert.equal(
      existsSync(cursorCommandPath),
      true,
      'Command file should exist in .cursor/commands/'
    );
    
    const content = await readFile(cursorCommandPath, 'utf8');
    assert.equal(content, '# Cleanup Command', 'File content should match');
    console.log('✓ Files applied to .cursor/ platform');
    
    // Step 5: Verify file mapping in index
    const fileMapping = index.packages['test-workspace'].files;
    assert.ok(
      fileMapping['commands/cleanup.md'],
      'File mapping should include commands/cleanup.md'
    );
    assert.ok(
      Array.isArray(fileMapping['commands/cleanup.md']),
      'File mapping should be array'
    );
    assert.ok(
      fileMapping['commands/cleanup.md'].includes('.cursor/commands/cleanup.md'),
      'File mapping should include .cursor target path'
    );
    console.log('✓ File mappings recorded in index');
    
    console.log('\n✅ All add → apply workflow tests passed!\n');
    
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
}

// Run test
try {
  await runAddThenApplyWorkspaceTest();
} catch (error) {
  console.error('\n❌ Test failed:');
  console.error(error);
  process.exit(1);
}
