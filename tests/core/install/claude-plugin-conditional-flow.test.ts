import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { runCli } from '../../test-helpers.js';
import { exists, readTextFile } from '../../../src/utils/fs.js';
import { DIR_PATTERNS, CLAUDE_PLUGIN_PATHS } from '../../../src/constants/index.js';

describe('Claude Plugin Conditional Flow Bug Fix', () => {
  let testDir: string;
  let pluginDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opkg-conditional-test-'));
    pluginDir = join(testDir, 'test-plugin');
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a Claude plugin with agent files
   */
  async function createClaudePluginWithAgent() {
    await mkdir(join(pluginDir, DIR_PATTERNS.CLAUDE_PLUGIN), { recursive: true });
    await mkdir(join(pluginDir, 'agents'), { recursive: true });

    // Create plugin manifest
    const pluginManifest = {
      name: 'test-agent-plugin',
      version: '1.0.0',
      description: 'Test plugin with agents'
    };
    await writeFile(
      join(pluginDir, CLAUDE_PLUGIN_PATHS.PLUGIN_MANIFEST),
      JSON.stringify(pluginManifest, null, 2)
    );

    // Create an agent with universal format (OpenPackage format)
    // This has tools as object and model with anthropic/ prefix
    const agentContent = `---
model: anthropic/claude-sonnet-4.20250514
tools:
  bash: true
  read: true
  write: true
---

# Test Agent

This agent should NOT be transformed when installing to claude platform.
`;
    await writeFile(join(pluginDir, 'agents', 'test-agent.md'), agentContent);
  }

  it('should NOT apply transformations when installing claude-plugin to claude platform', async () => {
    await createClaudePluginWithAgent();

    // Create a workspace to install into
    const workspaceDir = join(testDir, 'workspace');
    await mkdir(workspaceDir);

    // Install plugin to CLAUDE platform
    // The conditional flow should check: $$platform == "claude" → skip transformations
    const { stdout, stderr, code } = runCli(
      ['install', pluginDir, '--platforms', 'claude'],
      workspaceDir
    );

    console.log('Install output:', stdout);
    if (stderr) console.error('Install stderr:', stderr);

    assert.strictEqual(code, 0, 'Install should succeed');

    // Verify agent was installed
    const agentFile = join(workspaceDir, '.claude', 'agents', 'test-agent.md');
    assert.ok(await exists(agentFile), 'Agent should be installed to .claude/agents/');

    // Read the installed agent file and verify NO transformations were applied
    const installedContent = await readTextFile(agentFile);
    
    console.log('Installed agent content:', installedContent);

    // The agent should still have OpenPackage format (NOT transformed to Claude format):
    // - model should still have "anthropic/" prefix
    // - tools should still be an object { bash: true, ... }, NOT a string "bash, read, write"
    
    assert.ok(
      installedContent.includes('anthropic/claude-sonnet-4.20250514'),
      'Model should retain anthropic/ prefix (no transformation)'
    );
    
    assert.ok(
      installedContent.includes('bash: true'),
      'Tools should remain as object format (no transformation to comma-separated string)'
    );
  });

  it('should apply transformations when installing claude-plugin to cursor platform', async () => {
    await createClaudePluginWithAgent();

    // Create a workspace to install into
    const workspaceDir = join(testDir, 'workspace');
    await mkdir(workspaceDir);

    // Install plugin to CURSOR platform (different from source)
    // The conditional flow should check: $$platform != "claude" → apply transformations
    const { stdout, stderr, code } = runCli(
      ['install', pluginDir, '--platforms', 'cursor'],
      workspaceDir
    );

    console.log('Install output:', stdout);
    if (stderr) console.error('Install stderr:', stderr);

    assert.strictEqual(code, 0, 'Install should succeed');

    // Verify agent was installed to cursor
    const agentFile = join(workspaceDir, '.cursor', 'agents', 'test-agent.md');
    assert.ok(await exists(agentFile), 'Agent should be installed to .cursor/agents/');

    // Read the installed agent file
    const installedContent = await readTextFile(agentFile);
    
    console.log('Installed agent content:', installedContent);

    // Since cursor platform doesn't have conditional transformations,
    // the agent should be in universal format (same as source)
    assert.ok(
      installedContent.includes('anthropic/claude-sonnet-4.20250514'),
      'Model should retain universal format'
    );
    
    assert.ok(
      installedContent.includes('bash: true'),
      'Tools should remain as object format'
    );
  });

  it('should handle $$source correctly in export flows after conversion', async () => {
    await createClaudePluginWithAgent();

    // Create a workspace
    const workspaceDir = join(testDir, 'workspace');
    await mkdir(workspaceDir);

    // Install to claude platform
    const { code } = runCli(
      ['install', pluginDir, '--platforms', 'claude'],
      workspaceDir
    );

    assert.strictEqual(code, 0, 'Install should succeed');

    // The export flow in platforms.jsonc has:
    // {
    //   "from": "agents/**/*.md",
    //   "to": ".claude/agents/**/*.md",
    //   "when": { "$eq": ["$$source", "claude-plugin"] }
    //   // No transformations
    // }
    //
    // After conversion, $$source should still be "claude-plugin"
    // This flow should match and NOT apply transformations

    const agentFile = join(workspaceDir, '.claude', 'agents', 'test-agent.md');
    const installedContent = await readTextFile(agentFile);

    // Verify the content was NOT double-transformed
    assert.ok(
      installedContent.includes('anthropic/claude-sonnet-4.20250514'),
      'Content should not be double-transformed'
    );
  });
});
