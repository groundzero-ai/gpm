/**
 * TOML Key Tracking Integration Test
 * 
 * Verifies that keys are properly extracted and tracked for TOML files
 * when using domain-specific transforms with merge strategies.
 * 
 * Regression test for:
 * - Keys being empty when TOML transforms serialize to string
 * - mcp_servers prefix missing in TOML table headers
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DefaultFlowExecutor } from '../../../../src/core/flows/flow-executor.js';
import type { Flow, FlowContext } from '../../../../src/types/flows.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TOML Key Tracking Integration', () => {
  it('should extract keys before TOML serialization with merge strategy', async () => {
    // Create temp directories
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'toml-key-test-'));
    const packageRoot = path.join(tmpDir, 'package');
    const workspaceRoot = path.join(tmpDir, 'workspace');
    
    await fs.mkdir(packageRoot, { recursive: true });
    await fs.mkdir(workspaceRoot, { recursive: true });

    try {
      // Create source MCP config file
      const sourceFile = path.join(packageRoot, 'mcp.jsonc');
      const mcpConfig = {
        mcp: {
          'figma': {
            url: 'https://mcp.figma.com/mcp',
            headers: {
              'Authorization': 'Bearer ${env:FIGMA_OAUTH_TOKEN}',
              'X-Figma-Region': 'us-east-1'
            }
          },
          'context7': {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp']
          }
        }
      };
      await fs.writeFile(sourceFile, JSON.stringify(mcpConfig, null, 2));

      // Define flow matching Codex platform configuration
      const flow: Flow = {
        from: 'mcp.jsonc',
        to: path.join(workspaceRoot, 'mcp-servers.toml'),
        map: [
          { $rename: { 'mcp': 'mcp_servers' } }
        ],
        pipe: ['mcp-to-codex-toml'],
        merge: 'deep'
      };

      const context: FlowContext = {
        packageRoot,
        workspaceRoot,
        platform: 'codex',
        packageName: 'test-package',
        variables: {},
        direction: 'install',
        dryRun: false,
      };

      const executor = new DefaultFlowExecutor();
      const result = await executor.executeFlow(flow, context);

      // Verify execution succeeded
      assert.equal(result.success, true, 'Flow should succeed');
      assert.equal(result.transformed, true, 'Flow should be transformed');
      
      // CRITICAL: Verify keys were extracted
      assert.ok(result.keys, 'Keys should be tracked for merge strategy');
      assert.ok(result.keys!.length > 0, 'Keys array should not be empty');
      
      console.log('Extracted keys:', result.keys);
      
      // Verify expected keys are present
      const expectedKeys = [
        'mcp_servers.figma.url',
        'mcp_servers.figma.bearer_token_env_var',
        'mcp_servers.context7.command',
        'mcp_servers.context7.args'
      ];
      
      for (const expectedKey of expectedKeys) {
        assert.ok(
          result.keys!.some(k => k.startsWith(expectedKey)),
          `Expected key ${expectedKey} to be tracked`
        );
      }

      // Verify TOML output has correct structure
      const tomlContent = await fs.readFile(path.join(workspaceRoot, 'mcp-servers.toml'), 'utf-8');
      console.log('Generated TOML:');
      console.log(tomlContent);
      
      // Verify mcp_servers prefix is present
      assert.ok(
        tomlContent.includes('[mcp_servers.figma]') || tomlContent.includes('[mcp_servers.context7]'),
        'TOML should have mcp_servers prefix in table headers'
      );
      
      // Verify no extraneous indentation
      assert.ok(
        !tomlContent.includes('  ['),
        'TOML should not have extraneous indentation on table headers'
      );
      
      // Verify bearer token extraction
      assert.ok(
        tomlContent.includes('bearer_token_env_var = "FIGMA_OAUTH_TOKEN"'),
        'Bearer token should be extracted'
      );
      
      // Verify http_headers inline format
      assert.ok(
        tomlContent.includes('http_headers = {'),
        'http_headers should use inline table format'
      );

    } finally {
      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should handle merge strategy with existing TOML file', async () => {
    // Create temp directories
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'toml-merge-test-'));
    const packageRoot = path.join(tmpDir, 'package');
    const workspaceRoot = path.join(tmpDir, 'workspace');
    
    await fs.mkdir(packageRoot, { recursive: true });
    await fs.mkdir(workspaceRoot, { recursive: true });

    try {
      // Create existing TOML file in workspace
      const existingToml = `[mcp_servers.existing_server]
command = "existing"
args = [ "arg1" ]
`;
      await fs.writeFile(path.join(workspaceRoot, 'mcp-servers.toml'), existingToml);

      // Create source MCP config file
      const sourceFile = path.join(packageRoot, 'mcp.jsonc');
      const mcpConfig = {
        mcp: {
          'new_server': {
            command: 'new',
            args: ['arg2']
          }
        }
      };
      await fs.writeFile(sourceFile, JSON.stringify(mcpConfig, null, 2));

      // Define flow
      const flow: Flow = {
        from: 'mcp.jsonc',
        to: path.join(workspaceRoot, 'mcp-servers.toml'),
        map: [
          { $rename: { 'mcp': 'mcp_servers' } }
        ],
        pipe: ['mcp-to-codex-toml'],
        merge: 'deep'
      };

      const context: FlowContext = {
        packageRoot,
        workspaceRoot,
        platform: 'codex',
        packageName: 'test-package',
        variables: {},
        direction: 'install',
        dryRun: false,
      };

      const executor = new DefaultFlowExecutor();
      const result = await executor.executeFlow(flow, context);

      // Verify execution succeeded
      assert.equal(result.success, true, 'Flow should succeed');
      
      // Verify keys were extracted for the NEW server only
      assert.ok(result.keys, 'Keys should be tracked');
      assert.ok(result.keys!.length > 0, 'Keys array should not be empty');
      
      // Should only track keys for new_server, not existing_server
      assert.ok(
        result.keys!.some(k => k.includes('new_server')),
        'Should track new_server keys'
      );

      // Read merged TOML
      const mergedToml = await fs.readFile(path.join(workspaceRoot, 'mcp-servers.toml'), 'utf-8');
      console.log('Merged TOML:');
      console.log(mergedToml);
      
      // Both servers should be present
      assert.ok(mergedToml.includes('existing_server'), 'Existing server should be preserved');
      assert.ok(mergedToml.includes('new_server'), 'New server should be added');

    } finally {
      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

console.log('✅ TOML key tracking integration tests defined!');
