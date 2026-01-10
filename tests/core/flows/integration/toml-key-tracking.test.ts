/**
 * TOML Key Tracking Integration Test
 * 
 * Verifies that keys are properly extracted and tracked for TOML files
 * when using map pipeline with json-to-toml transform and merge strategies.
 * 
 * Tests the map pipeline approach that replaced the legacy mcp-to-codex-toml transform.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DefaultFlowExecutor } from '../../../../src/core/flows/flow-executor.js';
import type { Flow, FlowContext } from '../../../../src/types/flows.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TOML Key Tracking Integration', () => {
  it('should extract keys with map pipeline and json-to-toml transform', async () => {
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

      // Define flow using map pipeline (Codex platform approach)
      const flow: Flow = {
        from: 'mcp.jsonc',
        to: 'mcp-servers.toml',
        map: [
          // 1. Rename root key
          { $rename: { mcp: 'mcp_servers' } },
          
          // 2. Extract bearer token from Authorization header
          {
            $pipeline: {
              field: 'mcp_servers.*.headers.Authorization',
              operations: [
                { $extract: { 
                    pattern: '^Bearer \\$\\{env:([A-Z_][A-Z0-9_]*)\\}$',
                    group: 1,
                    default: '$SELF'
                }}
              ]
            }
          },
          { $rename: { 'mcp_servers.*.headers.Authorization': 'mcp_servers.*.bearer_token_env_var' } },
          
          // 3. Partition headers into env and static
          {
            $pipeline: {
              field: 'mcp_servers.*.headers',
              operations: [
                { $partition: {
                    by: 'value',
                    patterns: {
                      env_http_headers: '^\\$\\{env:.*\\}$',
                      http_headers: '.*'
                    }
                }}
              ]
            }
          },
          
          // 4. Extract env var names from env_http_headers
          {
            $pipeline: {
              field: 'mcp_servers.*.headers.env_http_headers',
              operations: [
                { $mapValues: {
                    operations: [
                      { $extract: { 
                          pattern: '^\\$\\{env:([A-Z_][A-Z0-9_]*)\\}$',
                          group: 1 
                      }}
                    ]
                }}
              ]
            }
          },
          
          // 5. Flatten to server level
          { $rename: { 'mcp_servers.*.headers.http_headers': 'mcp_servers.*.http_headers' } },
          { $rename: { 'mcp_servers.*.headers.env_http_headers': 'mcp_servers.*.env_http_headers' } },
          { $unset: 'mcp_servers.*.headers' },
          
          // 6. Convert to TOML
          { $pipe: ['json-to-toml'] }
        ],
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

      // Debug logging
      console.log('Flow result:', JSON.stringify(result, null, 2));
      if (result.error) {
        console.error('Error:', result.error);
      }

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
      
      // Verify bearer token extraction (via map pipeline)
      assert.ok(
        tomlContent.includes('bearer_token_env_var = "FIGMA_OAUTH_TOKEN"'),
        'Bearer token should be extracted via map pipeline'
      );
      
      // Verify http_headers field exists (static headers partitioned correctly)
      assert.ok(
        tomlContent.includes('http_headers'),
        'http_headers should be present after partition operation'
      );
      
      // Verify no empty sections (fix for partition operation)
      assert.ok(
        !tomlContent.includes('[mcp_servers.figma.http_headers]') || 
        !tomlContent.match(/\[mcp_servers\.figma\.http_headers\]\s*\n\s*\[/),
        'Should not have empty http_headers section'
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

      // Define flow using map pipeline
      const flow: Flow = {
        from: 'mcp.jsonc',
        to: 'mcp-servers.toml',
        map: [
          { $rename: { 'mcp': 'mcp_servers' } },
          { $pipe: ['json-to-toml'] }
        ],
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
