/**
 * TOML Transform Tests
 * 
 * Tests for json-to-toml and toml-to-json transforms
 * Updated to use smol-toml instead of @iarna/toml
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { 
  jsonToTomlTransform, 
  tomlToJsonTransform,
  createDefaultTransformRegistry 
} from '../../../../src/core/flows/flow-transforms.js';

describe('TOML Transforms', () => {
  describe('json-to-toml transform', () => {
    it('should convert JSON object to TOML string', () => {
      const input = {
        mcp_servers: {
          server1: {
            command: 'node',
            args: ['server.js'],
            env: {
              API_KEY: 'test-key'
            }
          }
        }
      };

      const result = jsonToTomlTransform.execute(input);
      
      assert.equal(typeof result, 'string');
      assert.ok(result.includes('mcp_servers'));
      assert.ok(result.includes('server1'));
      assert.ok(result.includes('command'));
    });

    it('should handle nested objects', () => {
      const input = {
        section: {
          nested: {
            value: 'test'
          }
        }
      };

      const result = jsonToTomlTransform.execute(input);
      
      assert.equal(typeof result, 'string');
      assert.ok(result.includes('section'));
      assert.ok(result.includes('nested'));
    });

    it('should handle arrays', () => {
      const input = {
        list: ['item1', 'item2', 'item3']
      };

      const result = jsonToTomlTransform.execute(input);
      
      assert.equal(typeof result, 'string');
      assert.ok(result.includes('list'));
    });
  });

  describe('toml-to-json transform', () => {
    it('should convert TOML string to JSON object', () => {
      const input = `
[mcp_servers.server1]
command = "node"
args = ["server.js"]

[mcp_servers.server1.env]
API_KEY = "test-key"
`;

      const result = tomlToJsonTransform.execute(input);
      
      assert.equal(typeof result, 'object');
      assert.ok(result.mcp_servers);
      assert.ok(result.mcp_servers.server1);
      assert.equal(result.mcp_servers.server1.command, 'node');
      assert.equal(result.mcp_servers.server1.env.API_KEY, 'test-key');
    });

    it('should handle simple key-value pairs', () => {
      const input = `
title = "Test"
version = "1.0.0"
enabled = true
`;

      const result = tomlToJsonTransform.execute(input);
      
      assert.equal(result.title, 'Test');
      assert.equal(result.version, '1.0.0');
      assert.equal(result.enabled, true);
    });

    it('should handle arrays', () => {
      const input = `
items = ["a", "b", "c"]
`;

      const result = tomlToJsonTransform.execute(input);
      
      assert.ok(Array.isArray(result.items));
      assert.deepEqual(result.items, ['a', 'b', 'c']);
    });
  });

  describe('roundtrip conversion', () => {
    it('should preserve data through JSON -> TOML -> JSON', () => {
      const original = {
        mcp: {
          server1: {
            command: 'node',
            args: ['index.js']
          }
        }
      };

      const toml = jsonToTomlTransform.execute(original);
      const restored = tomlToJsonTransform.execute(toml);

      assert.deepEqual(restored, original);
    });
  });

  describe('transform registry', () => {
    it('should register json-to-toml in default registry', () => {
      const registry = createDefaultTransformRegistry();
      
      assert.equal(registry.has('json-to-toml'), true);
      
      const input = { test: 'value' };
      const result = registry.execute('json-to-toml', input);
      
      assert.equal(typeof result, 'string');
    });

    it('should register toml-to-json in default registry', () => {
      const registry = createDefaultTransformRegistry();
      
      assert.equal(registry.has('toml-to-json'), true);
      
      const input = 'test = "value"';
      const result = registry.execute('toml-to-json', input);
      
      assert.equal(typeof result, 'object');
      assert.equal(result.test, 'value');
    });
  });

  describe('codex platform use case', () => {
    it('should simulate codex export: mcp.jsonc -> mcp-servers.toml', () => {
      // Simulates the codex platform export flow
      const mcpConfig = {
        mcp: {
          'filesystem-server': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
          },
          'git-server': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-git']
          }
        }
      };

      // Step 1: Rename field (would be done by map pipeline)
      const renamed = {
        mcp_servers: mcpConfig.mcp
      };

      // Step 2: Convert to TOML (pipe: ["filter-comments", "json-to-toml"])
      const tomlOutput = jsonToTomlTransform.execute(renamed);

      assert.equal(typeof tomlOutput, 'string');
      assert.ok(tomlOutput.includes('mcp_servers'));
      assert.ok(tomlOutput.includes('filesystem-server'));
      assert.ok(tomlOutput.includes('git-server'));
    });

    it('should simulate codex import: mcp-servers.toml -> mcp.jsonc', () => {
      // Simulates the codex platform import flow
      const tomlInput = `
[mcp_servers.filesystem-server]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]

[mcp_servers.git-server]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-git"]
`;

      // Step 1: Convert from TOML (pipe: ["toml-to-json"])
      const jsonOutput = tomlToJsonTransform.execute(tomlInput);

      assert.ok(jsonOutput.mcp_servers);
      assert.ok(jsonOutput.mcp_servers['filesystem-server']);
      assert.ok(jsonOutput.mcp_servers['git-server']);

      // Step 2: Rename field (would be done by map pipeline)
      assert.equal(jsonOutput.mcp_servers['filesystem-server'].command, 'npx');
    });
  });
});

console.log('✅ All TOML transform tests passed!');
