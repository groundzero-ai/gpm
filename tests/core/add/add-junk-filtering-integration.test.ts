/**
 * Integration test for junk file filtering during add command
 * 
 * Reproduces the reported issue where .DS_Store files were being added
 * to the package source when running `opkg add .claude`
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { runAddToSourcePipeline } from '../../../src/core/add/add-to-source-pipeline.js';

const UTF8 = 'utf-8';

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p: string, content: string) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, { encoding: UTF8 });
}

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

function writeWorkspacePackageManifest(workspaceDir: string, pkgName = 'workspace-test') {
  const pkgDir = path.join(workspaceDir, '.openpackage');
  const manifest = [`name: ${pkgName}`, 'version: 1.0.0', ''].join('\n');
  writeFile(path.join(pkgDir, 'openpackage.yml'), manifest);
}

/**
 * Test: .DS_Store files are not added when running `opkg add .claude`
 * 
 * This reproduces the issue where macOS system files were being added
 * to the package source, polluting the workspace package.
 */
async function testDSStoreFiltering(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-add-junk-integration-'));
  const originalCwd = process.cwd();
  
  try {
    process.chdir(tmp);

    // Setup workspace structure
    writeWorkspacePackageManifest(tmp);
    
    // Create platform detection marker for Claude (user has .claude directory)
    ensureDir(path.join(tmp, '.claude'));

    // Create legitimate .claude files
    const commandFile = path.join(tmp, '.claude', 'commands', 'essentials', 'cleanup.md');
    writeFile(commandFile, '# Cleanup Command\n\nCleanup workspace.');

    const ruleFile = path.join(tmp, '.claude', 'rules', 'essentials', 'code.md');
    writeFile(ruleFile, '# Code Rules\n\nCode standards.');

    // Create .DS_Store files (macOS system junk) that should be filtered
    const dsStoreRoot = path.join(tmp, '.claude', '.DS_Store');
    writeFile(dsStoreRoot, 'JUNK_DATA_ROOT');

    const dsStoreCommands = path.join(tmp, '.claude', 'commands', '.DS_Store');
    writeFile(dsStoreCommands, 'JUNK_DATA_COMMANDS');

    const dsStoreRules = path.join(tmp, '.claude', 'rules', 'essentials', '.DS_Store');
    writeFile(dsStoreRules, 'JUNK_DATA_RULES');

    // Run add on the .claude directory (simulating: opkg add .claude)
    const claudeDir = path.join(tmp, '.claude');
    const result = await runAddToSourcePipeline(undefined, claudeDir, {});

    // Verify success
    assert.ok(result.success, result.error);
    
    // Verify only legitimate files were added (should be 2, not 5)
    assert.equal(result.data?.filesAdded, 2, 
      `Expected 2 files to be added, but got ${result.data?.filesAdded}`);

    // Verify legitimate files WERE added to the correct locations
    const expectedCommand = path.join(tmp, '.openpackage', 'commands', 'essentials', 'cleanup.md');
    assert.ok(fileExists(expectedCommand), 
      `Expected command file not found at: ${expectedCommand}`);

    const expectedRule = path.join(tmp, '.openpackage', 'rules', 'essentials', 'code.md');
    assert.ok(fileExists(expectedRule), 
      `Expected rule file not found at: ${expectedRule}`);

    // Verify .DS_Store files were NOT added anywhere
    const checkPaths = [
      path.join(tmp, '.openpackage', '.DS_Store'),
      path.join(tmp, '.openpackage', 'root', '.claude', '.DS_Store'),
      path.join(tmp, '.openpackage', 'root', '.claude', 'commands', '.DS_Store'),
      path.join(tmp, '.openpackage', 'root', '.claude', 'rules', 'essentials', '.DS_Store'),
      path.join(tmp, '.openpackage', 'commands', '.DS_Store'),
      path.join(tmp, '.openpackage', 'rules', 'essentials', '.DS_Store'),
    ];

    for (const checkPath of checkPaths) {
      assert.ok(!fileExists(checkPath), 
        `.DS_Store file should not exist at: ${checkPath}`);
    }

    console.log('✓ .DS_Store files correctly filtered during add command');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Test: Other junk files are filtered (Thumbs.db, npm-debug.log, etc.)
 */
async function testOtherJunkFiltering(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-add-junk-integration-'));
  const originalCwd = process.cwd();
  
  try {
    process.chdir(tmp);

    writeWorkspacePackageManifest(tmp);
    ensureDir(path.join(tmp, '.cursor'));

    // Create legitimate files
    const commandFile = path.join(tmp, '.cursor', 'commands', 'test.md');
    writeFile(commandFile, '# Test Command');

    // Create various junk files that should be filtered
    const thumbsDb = path.join(tmp, '.cursor', 'commands', 'Thumbs.db');
    writeFile(thumbsDb, 'JUNK_THUMBS');

    const npmDebug = path.join(tmp, '.cursor', 'commands', 'npm-debug.log');
    writeFile(npmDebug, 'JUNK_DEBUG');

    const backup = path.join(tmp, '.cursor', 'commands', 'test~');
    writeFile(backup, 'JUNK_BACKUP');

    const desktopIni = path.join(tmp, '.cursor', 'commands', 'Desktop.ini');
    writeFile(desktopIni, 'JUNK_INI');

    // Run add
    const cursorDir = path.join(tmp, '.cursor');
    const result = await runAddToSourcePipeline(undefined, cursorDir, {});

    assert.ok(result.success, result.error);
    
    // Only 1 legitimate file should be added
    assert.equal(result.data?.filesAdded, 1, 
      `Expected 1 file to be added, but got ${result.data?.filesAdded}`);

    // Verify legitimate file was added
    const expectedCommand = path.join(tmp, '.openpackage', 'commands', 'test.md');
    assert.ok(fileExists(expectedCommand), 
      `Expected command file not found at: ${expectedCommand}`);

    // Verify junk files were NOT added
    const junkPaths = [
      'Thumbs.db',
      'npm-debug.log',
      'test~',
      'Desktop.ini'
    ];

    for (const junkFile of junkPaths) {
      const junkPath = path.join(tmp, '.openpackage', 'commands', junkFile);
      assert.ok(!fileExists(junkPath), 
        `Junk file ${junkFile} should not exist at: ${junkPath}`);
    }

    console.log('✓ Other junk files correctly filtered during add command');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Test: Legitimate dotfiles are preserved (not filtered as junk)
 */
async function testLegitimateDotfilesPreserved(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-add-junk-integration-'));
  const originalCwd = process.cwd();
  
  try {
    process.chdir(tmp);

    writeWorkspacePackageManifest(tmp);

    // Create legitimate dotfiles that should NOT be filtered
    const gitignore = path.join(tmp, '.gitignore');
    writeFile(gitignore, 'node_modules/');

    const env = path.join(tmp, '.env');
    writeFile(env, 'SECRET=value');

    const editorconfig = path.join(tmp, '.editorconfig');
    writeFile(editorconfig, 'root = true');

    // Also add a junk file to ensure filtering still works
    const dsStore = path.join(tmp, '.DS_Store');
    writeFile(dsStore, 'JUNK');

    // Run add on all files
    const result = await runAddToSourcePipeline(undefined, tmp, {});

    assert.ok(result.success, result.error);
    
    // Should have 3 files (dotfiles) + workspace manifest, not 4 (excluding .DS_Store)
    // Actually we need to check the specific files since there might be other files
    
    // Verify legitimate dotfiles were added to root/
    const expectedGitignore = path.join(tmp, '.openpackage', 'root', '.gitignore');
    assert.ok(fileExists(expectedGitignore), 
      `.gitignore should be preserved at: ${expectedGitignore}`);

    const expectedEnv = path.join(tmp, '.openpackage', 'root', '.env');
    assert.ok(fileExists(expectedEnv), 
      `.env should be preserved at: ${expectedEnv}`);

    const expectedEditorconfig = path.join(tmp, '.openpackage', 'root', '.editorconfig');
    assert.ok(fileExists(expectedEditorconfig), 
      `.editorconfig should be preserved at: ${expectedEditorconfig}`);

    // Verify .DS_Store was NOT added
    const dsStorePath = path.join(tmp, '.openpackage', 'root', '.DS_Store');
    assert.ok(!fileExists(dsStorePath), 
      `.DS_Store should not exist at: ${dsStorePath}`);

    console.log('✓ Legitimate dotfiles preserved while junk files filtered');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Run all tests
async function runTests() {
  console.log('\n🧪 Running junk file filtering integration tests...\n');
  
  await testDSStoreFiltering();
  await testOtherJunkFiltering();
  await testLegitimateDotfilesPreserved();
  
  console.log('\n✅ All junk file filtering integration tests passed!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
