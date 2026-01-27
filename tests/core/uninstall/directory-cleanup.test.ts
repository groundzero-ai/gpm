/**
 * Tests for directory cleanup during uninstall
 * Verifies that empty directories are properly cleaned up while preserving platform roots
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

import { runCli } from '../../test-helpers.js';

async function setupWorkspace(): Promise<{ cwd: string; home: string }> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'opkg-dircleanup-home-'));
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'opkg-dircleanup-ws-'));

  const openpkgDir = path.join(workspace, '.openpackage');
  const pkgDir = path.join(openpkgDir, 'packages', 'test-pkg');
  await fs.mkdir(pkgDir, { recursive: true });

  // Create nested platform directories
  await fs.mkdir(path.join(workspace, '.cursor', 'commands', 'essentials'), { recursive: true });
  
  // Create root file directories
  await fs.mkdir(path.join(workspace, 'docs', 'guides'), { recursive: true });

  await fs.writeFile(
    path.join(openpkgDir, 'openpackage.yml'),
    ['name: workspace', 'packages:', '  - name: test-pkg', '    path: ./.openpackage/packages/test-pkg/', ''].join('\n'),
    'utf8'
  );

  await fs.writeFile(
    path.join(pkgDir, 'openpackage.yml'),
    ['name: test-pkg', 'version: 1.0.0', ''].join('\n'),
    'utf8'
  );

  // Package source files (create directories first)
  await fs.mkdir(path.join(pkgDir, 'commands'), { recursive: true });
  await fs.mkdir(path.join(pkgDir, 'root', 'docs', 'guides'), { recursive: true });
  await fs.writeFile(path.join(pkgDir, 'commands', 'clean.md'), '# clean\n', 'utf8');
  await fs.writeFile(path.join(pkgDir, 'root', 'docs', 'guides', 'setup.md'), '# setup\n', 'utf8');

  // Installed files
  await fs.writeFile(
    path.join(workspace, '.cursor', 'commands', 'essentials', 'clean.md'),
    '# clean\n',
    'utf8'
  );
  await fs.writeFile(
    path.join(workspace, 'docs', 'guides', 'setup.md'),
    '# setup\n',
    'utf8'
  );

  await fs.writeFile(
    path.join(openpkgDir, 'openpackage.index.yml'),
    [
      '# This file is managed by OpenPackage. Do not edit manually.',
      '',
      'packages:',
      '  test-pkg:',
      '    path: ./.openpackage/packages/test-pkg/',
      '    version: 1.0.0',
      '    files:',
      '      commands/:',
      '        - .cursor/commands/essentials/',
      '      root/docs/guides/setup.md:',
      '        - docs/guides/setup.md',
      ''
    ].join('\n'),
    'utf8'
  );

  return { cwd: workspace, home };
}

async function cleanup(paths: string[]) {
  await Promise.all(paths.map(p => fs.rm(p, { recursive: true, force: true })));
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// Test: Platform nested directories are cleaned up, but platform root is preserved
{
  const { cwd, home } = await setupWorkspace();
  try {
    const res = runCli(['uninstall', 'test-pkg'], cwd, { HOME: home });
    assert.equal(res.code, 0, `uninstall should succeed: ${res.stderr}`);

    // File should be removed
    const fileExists = await dirExists(path.join(cwd, '.cursor', 'commands', 'essentials', 'clean.md'));
    assert.equal(fileExists, false, 'installed file should be removed');

    // Nested directories should be removed
    const essentialsExists = await dirExists(path.join(cwd, '.cursor', 'commands', 'essentials'));
    assert.equal(essentialsExists, false, 'essentials/ directory should be removed (empty)');

    const commandsExists = await dirExists(path.join(cwd, '.cursor', 'commands'));
    assert.equal(commandsExists, false, 'commands/ directory should be removed (empty)');

    // Platform root should be preserved (even if empty)
    const cursorExists = await dirExists(path.join(cwd, '.cursor'));
    assert.equal(cursorExists, true, '.cursor/ platform root should be preserved');

    console.log('✓ Platform directory cleanup test passed');
  } finally {
    await cleanup([cwd, home]);
  }
}

// Test: Root file directories are completely cleaned up
{
  const { cwd, home } = await setupWorkspace();
  try {
    const res = runCli(['uninstall', 'test-pkg'], cwd, { HOME: home });
    assert.equal(res.code, 0, `uninstall should succeed: ${res.stderr}`);

    // File should be removed
    const fileExists = await dirExists(path.join(cwd, 'docs', 'guides', 'setup.md'));
    assert.equal(fileExists, false, 'root file should be removed');

    // All parent directories should be removed (no preservation for root files)
    const guidesExists = await dirExists(path.join(cwd, 'docs', 'guides'));
    assert.equal(guidesExists, false, 'guides/ directory should be removed (empty)');

    const docsExists = await dirExists(path.join(cwd, 'docs'));
    assert.equal(docsExists, false, 'docs/ directory should be removed (empty)');

    console.log('✓ Root file directory cleanup test passed');
  } finally {
    await cleanup([cwd, home]);
  }
}

console.log('✅ All directory cleanup tests passed');
