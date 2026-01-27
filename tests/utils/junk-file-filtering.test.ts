/**
 * Tests for junk file filtering in walkFiles
 * 
 * Validates that system junk files (.DS_Store, Thumbs.db, etc.) are filtered out
 * while legitimate dotfiles and dot-directories are preserved.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'path';
import { walkFiles } from '../../src/utils/fs.js';

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p: string, content: string) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, { encoding: 'utf-8' });
}

/**
 * Test: .DS_Store files are filtered out
 */
async function testDSStoreFiltering(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-junk-test-'));
  
  try {
    // Create test directory structure with .DS_Store files
    writeFile(path.join(tmp, 'test.txt'), 'test content');
    writeFile(path.join(tmp, '.DS_Store'), 'junk');
    writeFile(path.join(tmp, 'subdir', 'file.txt'), 'file content');
    writeFile(path.join(tmp, 'subdir', '.DS_Store'), 'junk');

    // Walk files and collect results
    const files: string[] = [];
    for await (const file of walkFiles(tmp)) {
      files.push(path.relative(tmp, file));
    }

    // Verify .DS_Store files are filtered out
    assert.ok(!files.includes('.DS_Store'), '.DS_Store should be filtered out');
    assert.ok(!files.includes('subdir/.DS_Store'), 'subdir/.DS_Store should be filtered out');
    
    // Verify legitimate files are included
    assert.ok(files.includes('test.txt'), 'test.txt should be included');
    assert.ok(files.includes(path.join('subdir', 'file.txt')), 'subdir/file.txt should be included');

    console.log('✓ .DS_Store filtering test passed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Test: Thumbs.db files are filtered out
 */
async function testThumbsDbFiltering(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-junk-test-'));
  
  try {
    writeFile(path.join(tmp, 'image.jpg'), 'image');
    writeFile(path.join(tmp, 'Thumbs.db'), 'junk');
    writeFile(path.join(tmp, 'folder', 'photo.png'), 'photo');
    writeFile(path.join(tmp, 'folder', 'Thumbs.db'), 'junk');

    const files: string[] = [];
    for await (const file of walkFiles(tmp)) {
      files.push(path.relative(tmp, file));
    }

    assert.ok(!files.includes('Thumbs.db'), 'Thumbs.db should be filtered out');
    assert.ok(!files.includes('folder/Thumbs.db'), 'folder/Thumbs.db should be filtered out');
    assert.ok(files.includes('image.jpg'), 'image.jpg should be included');
    assert.ok(files.includes(path.join('folder', 'photo.png')), 'folder/photo.png should be included');

    console.log('✓ Thumbs.db filtering test passed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Test: Legitimate dotfiles and dot-directories are NOT filtered out
 */
async function testLegitimateDotsPreserved(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-junk-test-'));
  
  try {
    // Create legitimate dotfiles and dot-directories
    writeFile(path.join(tmp, '.gitignore'), 'node_modules/');
    writeFile(path.join(tmp, '.env'), 'SECRET=value');
    writeFile(path.join(tmp, '.claude', 'rules', 'test.md'), '# Test Rule');
    writeFile(path.join(tmp, '.cursor', 'commands', 'cmd.md'), '# Command');
    writeFile(path.join(tmp, 'regular.txt'), 'regular file');
    
    // Also add a junk file to verify it's still filtered
    writeFile(path.join(tmp, '.DS_Store'), 'junk');
    writeFile(path.join(tmp, '.claude', '.DS_Store'), 'junk');

    const files: string[] = [];
    for await (const file of walkFiles(tmp)) {
      files.push(path.relative(tmp, file));
    }

    // Verify legitimate dotfiles are included
    assert.ok(files.includes('.gitignore'), '.gitignore should be included');
    assert.ok(files.includes('.env'), '.env should be included');
    assert.ok(files.includes(path.join('.claude', 'rules', 'test.md')), '.claude/rules/test.md should be included');
    assert.ok(files.includes(path.join('.cursor', 'commands', 'cmd.md')), '.cursor/commands/cmd.md should be included');
    assert.ok(files.includes('regular.txt'), 'regular.txt should be included');
    
    // Verify junk files are filtered
    assert.ok(!files.includes('.DS_Store'), '.DS_Store should be filtered out');
    assert.ok(!files.includes(path.join('.claude', '.DS_Store')), '.claude/.DS_Store should be filtered out');

    console.log('✓ Legitimate dotfiles preservation test passed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Test: Other junk file patterns are filtered
 */
async function testOtherJunkPatterns(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opkg-junk-test-'));
  
  try {
    // Create various junk file patterns
    writeFile(path.join(tmp, 'file.txt'), 'content');
    writeFile(path.join(tmp, '._thumbnail'), 'macOS thumbnail'); // ._* pattern
    writeFile(path.join(tmp, 'npm-debug.log'), 'debug log');
    writeFile(path.join(tmp, 'backup~'), 'backup'); // Linux backup file
    writeFile(path.join(tmp, 'Desktop.ini'), 'Windows folder config');

    const files: string[] = [];
    for await (const file of walkFiles(tmp)) {
      files.push(path.relative(tmp, file));
    }

    // Verify junk files are filtered
    assert.ok(!files.includes('._thumbnail'), '._thumbnail should be filtered out');
    assert.ok(!files.includes('npm-debug.log'), 'npm-debug.log should be filtered out');
    assert.ok(!files.includes('backup~'), 'backup~ should be filtered out');
    assert.ok(!files.includes('Desktop.ini'), 'Desktop.ini should be filtered out');
    
    // Verify legitimate file is included
    assert.ok(files.includes('file.txt'), 'file.txt should be included');

    console.log('✓ Other junk patterns filtering test passed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Run all tests
async function runTests() {
  console.log('\n🧪 Running junk file filtering tests...\n');
  
  await testDSStoreFiltering();
  await testThumbsDbFiltering();
  await testLegitimateDotsPreserved();
  await testOtherJunkPatterns();
  
  console.log('\n✅ All junk file filtering tests passed!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
