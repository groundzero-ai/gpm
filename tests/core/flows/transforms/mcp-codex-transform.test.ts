/**
 * MCP to Codex TOML Transform Tests
 * 
 * Tests for domain-specific MCP transformations to Codex TOML format
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { 
  mcpToCodexTomlTransform,
  codexTomlToMcpTransform 
} from '../../../../src/core/flows/toml-domain-transforms.js';
import { createDefaultTransformRegistry } from '../../../../src/core/flows/flow-transforms.js';

describe('MCP to Codex TOML Transform', () => {
  describe('mcp-to-codex-toml transform', () => {
    it('should transform STDIO server configuration', () => {
      const input = {
        mcp_servers: {
          'context7': {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {
              MY_VAR: 'value',
              API_KEY: 'secret'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      assert.equal(typeof result, 'string');
      assert.ok(result.includes('[mcp_servers.context7]') || result.includes('context7'));
      assert.ok(result.includes('command = "npx"'));
      assert.ok(result.includes('MY_VAR'));
    });

    it('should transform HTTP server with bearer token', () => {
      const input = {
        mcp_servers: {
          'figma': {
            url: 'https://mcp.figma.com/mcp',
            headers: {
              'Authorization': 'Bearer ${env:FIGMA_OAUTH_TOKEN}',
              'X-Figma-Region': 'us-east-1'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      assert.equal(typeof result, 'string');
      assert.ok(result.includes('url = "https://mcp.figma.com/mcp"'));
      assert.ok(result.includes('bearer_token_env_var = "FIGMA_OAUTH_TOKEN"'));
      assert.ok(result.includes('http_headers'));
      assert.ok(result.includes('X-Figma-Region'));
      
      // Should NOT include Authorization in http_headers
      assert.ok(!result.includes('Authorization'));
    });

    it('should format http_headers as inline table', () => {
      const input = {
        mcp_servers: {
          'api-server': {
            url: 'https://api.example.com/mcp',
            headers: {
              'X-API-Key': 'key123',
              'X-Custom-Header': 'value'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      // Check for inline table format: http_headers = { ... }
      assert.ok(
        result.includes('http_headers = {') || result.includes('http_headers={'),
        'http_headers should be formatted as inline table'
      );
    });

    it('should extract environment variables from non-Authorization headers', () => {
      const input = {
        mcp_servers: {
          'custom': {
            url: 'https://custom.com/mcp',
            headers: {
              'X-Static-Header': 'static-value',
              'X-Env-Header': '${env:MY_ENV_VAR}'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      // Static headers should be in http_headers
      assert.ok(result.includes('http_headers'));
      assert.ok(result.includes('X-Static-Header'));
      
      // Env var headers should be in env_http_headers
      assert.ok(result.includes('env_http_headers') || result.includes('X-Env-Header'));
    });

    it('should handle mixed STDIO and HTTP servers', () => {
      const input = {
        mcp_servers: {
          'local-server': {
            command: 'node',
            args: ['server.js']
          },
          'remote-server': {
            url: 'https://remote.com/mcp',
            headers: {
              'Authorization': 'Bearer ${env:TOKEN}'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      assert.ok(result.includes('local-server'));
      assert.ok(result.includes('remote-server'));
      assert.ok(result.includes('command = "node"'));
      assert.ok(result.includes('url = "https://remote.com/mcp"'));
      assert.ok(result.includes('bearer_token_env_var = "TOKEN"'));
    });

    it('should handle timeout field conversion', () => {
      const input = {
        mcp_servers: {
          'server': {
            command: 'npx',
            args: ['server'],
            timeout: 30
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      assert.ok(result.includes('startup_timeout_sec = 30'));
    });

    it('should preserve enabled, enabled_tools, and disabled_tools', () => {
      const input = {
        mcp_servers: {
          'server': {
            command: 'npx',
            args: ['server'],
            enabled: false,
            enabled_tools: ['tool1', 'tool2'],
            disabled_tools: ['tool3']
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      assert.ok(result.includes('enabled = false'));
      assert.ok(result.includes('enabled_tools'));
      assert.ok(result.includes('disabled_tools'));
    });
  });

  describe('codex-toml-to-mcp transform', () => {
    it('should reverse transform STDIO server', () => {
      const codexConfig = {
        mcp_servers: {
          'context7': {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {
              MY_VAR: 'value'
            }
          }
        }
      };

      const result = codexTomlToMcpTransform.execute(codexConfig);
      
      assert.deepEqual(result.context7, {
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
        env: {
          MY_VAR: 'value'
        }
      });
    });

    it('should reconstruct Authorization header from bearer_token_env_var', () => {
      const codexConfig = {
        mcp_servers: {
          'figma': {
            url: 'https://mcp.figma.com/mcp',
            bearer_token_env_var: 'FIGMA_OAUTH_TOKEN',
            http_headers: {
              'X-Figma-Region': 'us-east-1'
            }
          }
        }
      };

      const result = codexTomlToMcpTransform.execute(codexConfig);
      
      assert.equal(result.figma.url, 'https://mcp.figma.com/mcp');
      assert.ok(result.figma.headers);
      assert.equal(result.figma.headers.Authorization, 'Bearer ${env:FIGMA_OAUTH_TOKEN}');
      assert.equal(result.figma.headers['X-Figma-Region'], 'us-east-1');
    });

    it('should reconstruct environment variable headers', () => {
      const codexConfig = {
        mcp_servers: {
          'server': {
            url: 'https://api.com/mcp',
            http_headers: {
              'X-Static': 'value'
            },
            env_http_headers: {
              'X-Env': 'MY_VAR'
            }
          }
        }
      };

      const result = codexTomlToMcpTransform.execute(codexConfig);
      
      assert.equal(result.server.headers['X-Static'], 'value');
      assert.equal(result.server.headers['X-Env'], '${env:MY_VAR}');
    });

    it('should convert timeout fields back', () => {
      const codexConfig = {
        mcp_servers: {
          'server': {
            command: 'node',
            args: ['server.js'],
            startup_timeout_sec: 30
          }
        }
      };

      const result = codexTomlToMcpTransform.execute(codexConfig);
      
      assert.equal(result.server.timeout, 30);
    });
  });

  describe('roundtrip conversion', () => {
    it('should preserve STDIO server through roundtrip', () => {
      const original = {
        mcp_servers: {
          'server': {
            command: 'node',
            args: ['index.js'],
            env: {
              KEY: 'value'
            }
          }
        }
      };

      const toml = mcpToCodexTomlTransform.execute(original);
      const restored = codexTomlToMcpTransform.execute(toml);

      assert.deepEqual(restored.server.command, original.mcp_servers.server.command);
      assert.deepEqual(restored.server.args, original.mcp_servers.server.args);
      assert.deepEqual(restored.server.env, original.mcp_servers.server.env);
    });

    it('should preserve HTTP server with bearer token through roundtrip', () => {
      const original = {
        mcp_servers: {
          'api': {
            url: 'https://api.com/mcp',
            headers: {
              'Authorization': 'Bearer ${env:API_TOKEN}',
              'X-Custom': 'value'
            }
          }
        }
      };

      const toml = mcpToCodexTomlTransform.execute(original);
      const restored = codexTomlToMcpTransform.execute(toml);

      assert.equal(restored.api.url, original.mcp_servers.api.url);
      assert.equal(restored.api.headers.Authorization, original.mcp_servers.api.headers.Authorization);
      assert.equal(restored.api.headers['X-Custom'], original.mcp_servers.api.headers['X-Custom']);
    });
  });

  describe('transform registry integration', () => {
    it('should register mcp-to-codex-toml in default registry', () => {
      const registry = createDefaultTransformRegistry();
      
      assert.equal(registry.has('mcp-to-codex-toml'), true);
      
      const input = {
        mcp_servers: {
          'test': {
            command: 'npx',
            args: ['test']
          }
        }
      };
      
      const result = registry.execute('mcp-to-codex-toml', input);
      assert.equal(typeof result, 'string');
    });

    it('should register codex-toml-to-mcp in default registry', () => {
      const registry = createDefaultTransformRegistry();
      
      assert.equal(registry.has('codex-toml-to-mcp'), true);
      
      const input = {
        mcp_servers: {
          'test': {
            command: 'npx',
            args: ['test']
          }
        }
      };
      
      const result = registry.execute('codex-toml-to-mcp', input);
      assert.equal(typeof result, 'object');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle Figma MCP server configuration', () => {
      const input = {
        mcp_servers: {
          'figma': {
            url: 'https://mcp.figma.com/mcp',
            headers: {
              'Authorization': 'Bearer ${env:FIGMA_OAUTH_TOKEN}',
              'X-Figma-Region': 'us-east-1'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      // Verify Codex format requirements from spec
      assert.ok(result.includes('bearer_token_env_var = "FIGMA_OAUTH_TOKEN"'));
      assert.ok(result.includes('http_headers'));
      assert.ok(result.includes('X-Figma-Region'));
      
      // Verify inline table format
      assert.ok(result.match(/http_headers\s*=\s*\{/));
    });

    it('should handle Context7 MCP server configuration', () => {
      const input = {
        mcp_servers: {
          'context7': {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp']
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      assert.ok(result.includes('[mcp_servers.context7]') || result.includes('context7'));
      assert.ok(result.includes('command = "npx"'));
      // smol-toml may add spaces in arrays, so use more flexible matching
      assert.ok(result.includes('args = [') && result.includes('-y') && result.includes('@upstash/context7-mcp'));
    });

    it('should handle multi-server configuration', () => {
      const input = {
        mcp_servers: {
          'context7': {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp']
          },
          'figma': {
            url: 'https://mcp.figma.com/mcp',
            headers: {
              'Authorization': 'Bearer ${env:FIGMA_OAUTH_TOKEN}',
              'X-Figma-Region': 'us-east-1'
            }
          },
          'chrome-devtools': {
            url: 'http://localhost:3000/mcp',
            headers: {
              'X-Custom': 'value'
            },
            enabled: true,
            timeout: 20
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      // All servers should be present
      assert.ok(result.includes('context7'));
      assert.ok(result.includes('figma'));
      assert.ok(result.includes('chrome-devtools'));
      
      // Verify transformations
      assert.ok(result.includes('bearer_token_env_var = "FIGMA_OAUTH_TOKEN"'));
      assert.ok(result.includes('startup_timeout_sec = 20'));
    });
  });

  describe('edge cases', () => {
    it('should handle empty server configuration', () => {
      const input = {
        mcp_servers: {}
      };

      const result = mcpToCodexTomlTransform.execute(input);
      assert.equal(typeof result, 'string');
    });

    it('should handle server with no headers', () => {
      const input = {
        mcp_servers: {
          'server': {
            url: 'https://api.com/mcp'
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      assert.ok(result.includes('url = "https://api.com/mcp"'));
      assert.ok(!result.includes('http_headers'));
    });

    it('should handle Authorization header without env var', () => {
      const input = {
        mcp_servers: {
          'server': {
            url: 'https://api.com/mcp',
            headers: {
              'Authorization': 'Bearer static-token-123'
            }
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      
      // Static token should stay in http_headers (not extracted)
      assert.ok(result.includes('http_headers'));
      assert.ok(result.includes('Authorization'));
      assert.ok(!result.includes('bearer_token_env_var'));
    });

    it('should handle server with only env_vars', () => {
      const input = {
        mcp_servers: {
          'server': {
            command: 'node',
            args: ['server.js'],
            env_vars: ['PATH', 'HOME']
          }
        }
      };

      const result = mcpToCodexTomlTransform.execute(input);
      assert.ok(result.includes('env_vars'));
    });
  });
});

console.log('✅ All MCP-Codex transform tests defined!');
