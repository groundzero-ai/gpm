/**
 * Test suite for the show command
 */

import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { runShowPipeline } from '../src/core/show/show-pipeline.js';
import { packageManager } from '../src/core/package.js';

const TEST_DIR = join(process.cwd(), 'tmp', 'show-command-test');

async function setupTestEnvironment() {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });

  // Create a test package in workspace
  const workspaceDir = join(TEST_DIR, 'workspace');
  const workspacePackageDir = join(workspaceDir, '.openpackage', 'packages', 'test-package');
  await mkdir(workspacePackageDir, { recursive: true });

  await writeFile(
    join(workspacePackageDir, 'openpackage.yml'),
    `name: test-package
version: 1.2.3
description: A test package for show command
keywords:
  - test
  - example
author: Test Author
license: MIT
homepage: https://example.com
repository:
  type: git
  url: https://github.com/test/test-package.git
private: false
packages:
  - name: dependency-one
    version: ^1.0.0
dev-packages:
  - name: dev-dependency
    version: ^2.0.0
`
  );

  await writeFile(
    join(workspacePackageDir, 'README.md'),
    '# Test Package\n\nThis is a test package.\n'
  );

  await mkdir(join(workspacePackageDir, 'commands'), { recursive: true });
  await writeFile(
    join(workspacePackageDir, 'commands', 'test.md'),
    '# Test Command\n'
  );

  // Create a package in CWD
  const cwdPackageDir = join(TEST_DIR, 'cwd-package');
  await mkdir(cwdPackageDir, { recursive: true });

  await writeFile(
    join(cwdPackageDir, 'openpackage.yml'),
    `name: cwd-package
version: 0.1.0
description: Package in current directory
`
  );

  await writeFile(
    join(cwdPackageDir, 'README.md'),
    '# CWD Package\n'
  );

  // Create a registry package
  await packageManager.savePackage({
    metadata: {
      name: 'registry-package',
      version: '2.0.0',
      description: 'Package in registry',
      keywords: ['registry', 'test']
    } as any,
    files: [
      {
        path: 'openpackage.yml',
        content: 'name: registry-package\nversion: 2.0.0\n'
      },
      {
        path: 'README.md',
        content: '# Registry Package\n'
      }
    ]
  });

  return { workspaceDir, cwdPackageDir, workspacePackageDir };
}

async function testShowWorkspacePackage() {
  console.log('\n--- Test 1: Show workspace package by name ---');
  const { workspaceDir } = await setupTestEnvironment();

  const result = await runShowPipeline('test-package', workspaceDir);

  if (!result.success) {
    throw new Error(`Show failed: ${result.error}`);
  }

  const metadata = result.data as any;
  if (metadata.name !== 'test-package') {
    throw new Error(`Expected name 'test-package', got '${metadata.name}'`);
  }
  if (metadata.version !== '1.2.3') {
    throw new Error(`Expected version '1.2.3', got '${metadata.version}'`);
  }

  console.log('✓ Workspace package shown successfully');
}

async function testShowByPath() {
  console.log('\n--- Test 2: Show package by path ---');
  const { workspacePackageDir, workspaceDir } = await setupTestEnvironment();

  const relativePath = '.openpackage/packages/test-package';
  const result = await runShowPipeline(relativePath, workspaceDir);

  if (!result.success) {
    throw new Error(`Show by path failed: ${result.error}`);
  }

  const metadata = result.data as any;
  if (metadata.name !== 'test-package') {
    throw new Error(`Expected name 'test-package', got '${metadata.name}'`);
  }

  console.log('✓ Package shown by path successfully');
}

async function testShowCwdPackage() {
  console.log('\n--- Test 3: Show package from CWD ---');
  const { cwdPackageDir } = await setupTestEnvironment();

  const result = await runShowPipeline('.', cwdPackageDir);

  if (!result.success) {
    throw new Error(`Show CWD package failed: ${result.error}`);
  }

  const metadata = result.data as any;
  if (metadata.name !== 'cwd-package') {
    throw new Error(`Expected name 'cwd-package', got '${metadata.name}'`);
  }

  console.log('✓ CWD package shown successfully');
}

async function testShowRegistryPackage() {
  console.log('\n--- Test 4: Show registry package ---');
  const { workspaceDir } = await setupTestEnvironment();

  const result = await runShowPipeline('registry-package', workspaceDir);

  if (!result.success) {
    throw new Error(`Show registry package failed: ${result.error}`);
  }

  const metadata = result.data as any;
  if (metadata.name !== 'registry-package') {
    throw new Error(`Expected name 'registry-package', got '${metadata.name}'`);
  }
  if (metadata.version !== '2.0.0') {
    throw new Error(`Expected version '2.0.0', got '${metadata.version}'`);
  }

  console.log('✓ Registry package shown successfully');
}

async function testShowNonExistentPackage() {
  console.log('\n--- Test 5: Show non-existent package (should fail) ---');
  const { workspaceDir } = await setupTestEnvironment();

  const result = await runShowPipeline('non-existent-package', workspaceDir);

  if (result.success) {
    throw new Error('Show should have failed for non-existent package');
  }

  if (!result.error || !result.error.includes('not found')) {
    throw new Error(`Expected 'not found' error, got: ${result.error}`);
  }

  console.log('✓ Non-existent package handled correctly');
}

async function testShowWithVersion() {
  console.log('\n--- Test 6: Show package with version ---');
  const { workspaceDir } = await setupTestEnvironment();

  const result = await runShowPipeline('registry-package@2.0.0', workspaceDir);

  if (!result.success) {
    throw new Error(`Show with version failed: ${result.error}`);
  }

  const metadata = result.data as any;
  if (metadata.version !== '2.0.0') {
    throw new Error(`Expected version '2.0.0', got '${metadata.version}'`);
  }

  console.log('✓ Package with version shown successfully');
}

async function cleanup() {
  await rm(TEST_DIR, { recursive: true, force: true });
}

async function runTests() {
  try {
    await testShowWorkspacePackage();
    await testShowByPath();
    await testShowCwdPackage();
    await testShowRegistryPackage();
    await testShowNonExistentPackage();
    await testShowWithVersion();

    console.log('\n✅ All show command tests passed');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

runTests();
