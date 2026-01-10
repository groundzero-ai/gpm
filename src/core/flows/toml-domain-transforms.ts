/**
 * TOML Domain Transforms
 * 
 * Domain-specific TOML transformations for platform configurations.
 * Separates domain logic from format conversion.
 * 
 * Transforms:
 * - mcp-to-codex-toml: Convert MCP JSON to Codex TOML format
 * - codex-toml-to-mcp: Convert Codex TOML back to universal MCP JSON
 */

import * as TOML from 'smol-toml';
import type { Transform } from '../../types/flows.js';
import type { 
  McpServer, 
  McpConfig, 
  CodexMcpServer, 
  CodexMcpConfig,
  McpToCodexOptions,
  TomlFormatOptions
} from '../../types/flows.js';
import { logger } from '../../utils/logger.js';

// ============================================================================
// MCP to Codex TOML Transform
// ============================================================================

/**
 * Transform MCP schema to Codex schema (object → object)
 * 
 * This is a separate transform from serialization to allow key extraction
 * from the transformed object before it becomes a TOML string.
 */
export const mcpToCodexSchemaTransform: Transform = {
  name: 'mcp-to-codex-schema',
  description: 'Transform MCP JSON schema to Codex schema (without TOML serialization)',
  reversible: true,
  
  execute(input: any, options?: McpToCodexOptions): any {
    const opts: McpToCodexOptions = {
      inlineTables: options?.inlineTables ?? true,
      extractBearerToken: options?.extractBearerToken ?? true,
      convertTimeouts: options?.convertTimeouts ?? true,
    };

    return transformMcpToCodexSchema(input, opts);
  },
};

/**
 * Transform MCP JSON configuration to Codex TOML format
 * 
 * Key transformations:
 * 1. headers → http_headers (without Authorization)
 * 2. headers.Authorization → bearer_token_env_var (extract env var name)
 * 3. timeout → startup_timeout_sec
 * 4. Format http_headers as inline tables
 * 
 * Example:
 * Input:
 * {
 *   "mcp_servers": {
 *     "figma": {
 *       "url": "https://mcp.figma.com/mcp",
 *       "headers": {
 *         "Authorization": "Bearer ${env:FIGMA_OAUTH_TOKEN}",
 *         "X-Figma-Region": "us-east-1"
 *       }
 *     }
 *   }
 * }
 * 
 * Output (TOML):
 * [mcp_servers.figma]
 * url = "https://mcp.figma.com/mcp"
 * bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
 * http_headers = { "X-Figma-Region" = "us-east-1" }
 */
export const mcpToCodexTomlTransform: Transform = {
  name: 'mcp-to-codex-toml',
  description: 'Convert MCP JSON configuration to Codex TOML format',
  reversible: true,
  
  execute(input: any, options?: McpToCodexOptions): string {
    const opts: McpToCodexOptions = {
      inlineTables: options?.inlineTables ?? true,
      extractBearerToken: options?.extractBearerToken ?? true,
      convertTimeouts: options?.convertTimeouts ?? true,
    };

    // Transform each server configuration
    const transformed = transformMcpToCodexSchema(input, opts);
    
    // Serialize to TOML with formatting
    return serializeCodexToml(transformed, {
      inlineTables: opts.inlineTables ? ['http_headers', 'env_http_headers'] : [],
      maxInlineKeys: 10,
      sectionSpacing: true,
    });
  },
  
  validate(options?: McpToCodexOptions): boolean {
    if (!options) return true;
    
    if (options.inlineTables !== undefined && typeof options.inlineTables !== 'boolean') {
      return false;
    }
    if (options.extractBearerToken !== undefined && typeof options.extractBearerToken !== 'boolean') {
      return false;
    }
    if (options.convertTimeouts !== undefined && typeof options.convertTimeouts !== 'boolean') {
      return false;
    }
    
    return true;
  },
};

/**
 * Transform MCP schema to Codex schema
 */
function transformMcpToCodexSchema(data: any, options: McpToCodexOptions): any {
  // Check if input has mcp_servers key
  const hasMcpServersKey = data && typeof data === 'object' && 'mcp_servers' in data;
  const servers = hasMcpServersKey ? data.mcp_servers : data;
  
  if (!servers || typeof servers !== 'object') {
    logger.warn('Invalid MCP configuration structure');
    return data;
  }

  const result: Record<string, CodexMcpServer> = {};

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (!serverConfig || typeof serverConfig !== 'object') {
      result[serverName] = serverConfig as CodexMcpServer;
      continue;
    }

    const server = serverConfig as McpServer;
    const codexServer: CodexMcpServer = {};

    // Copy STDIO server fields
    if (server.command) codexServer.command = server.command;
    if (server.args) codexServer.args = server.args;
    if (server.env) codexServer.env = server.env;
    if (server.env_vars) codexServer.env_vars = server.env_vars;
    if (server.cwd) codexServer.cwd = server.cwd;

    // Transform HTTP server fields
    if (server.url) {
      codexServer.url = server.url;

      // Process headers
      if (server.headers) {
        const { bearerToken, httpHeaders, envHttpHeaders } = extractHeadersForCodex(
          server.headers,
          options.extractBearerToken ?? true
        );

        if (bearerToken) {
          codexServer.bearer_token_env_var = bearerToken;
        }

        if (httpHeaders && Object.keys(httpHeaders).length > 0) {
          codexServer.http_headers = httpHeaders;
        }

        if (envHttpHeaders && Object.keys(envHttpHeaders).length > 0) {
          codexServer.env_http_headers = envHttpHeaders;
        }
      }
    }

    // Transform timeout fields
    if (options.convertTimeouts && server.timeout !== undefined) {
      codexServer.startup_timeout_sec = server.timeout;
    }

    // Copy common options
    if (server.enabled !== undefined) codexServer.enabled = server.enabled;
    if (server.enabled_tools) codexServer.enabled_tools = server.enabled_tools;
    if (server.disabled_tools) codexServer.disabled_tools = server.disabled_tools;

    result[serverName] = codexServer;
  }

  // Preserve the mcp_servers wrapper if it was present in the input
  // This ensures TOML output has [mcp_servers.server_name] structure
  if (hasMcpServersKey) {
    return { mcp_servers: result };
  }

  return result;
}

/**
 * Extract bearer token and separate headers for Codex format
 * 
 * Input:
 * {
 *   "Authorization": "Bearer ${env:FIGMA_TOKEN}",
 *   "X-Custom-Header": "value",
 *   "X-Env-Header": "${env:MY_VAR}"
 * }
 * 
 * Output:
 * {
 *   bearerToken: "FIGMA_TOKEN",
 *   httpHeaders: { "X-Custom-Header": "value" },
 *   envHttpHeaders: { "X-Env-Header": "MY_VAR" }
 * }
 */
function extractHeadersForCodex(
  headers: Record<string, string>,
  extractBearer: boolean
): {
  bearerToken?: string;
  httpHeaders?: Record<string, string>;
  envHttpHeaders?: Record<string, string>;
} {
  let bearerToken: string | undefined;
  const httpHeaders: Record<string, string> = {};
  const envHttpHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    // Extract Authorization header bearer token
    if (extractBearer && key.toLowerCase() === 'authorization') {
      const token = extractBearerTokenFromHeader(value);
      if (token) {
        bearerToken = token;
        continue; // Don't include in http_headers
      }
    }

    // Check if value is an environment variable reference
    const envVar = extractEnvVarName(value);
    if (envVar) {
      envHttpHeaders[key] = envVar;
    } else {
      httpHeaders[key] = value;
    }
  }

  return { bearerToken, httpHeaders, envHttpHeaders };
}

/**
 * Extract bearer token environment variable name from Authorization header
 * 
 * Examples:
 * - "Bearer ${env:FIGMA_TOKEN}" → "FIGMA_TOKEN"
 * - "Bearer ${FIGMA_TOKEN}" → "FIGMA_TOKEN"
 * - "Bearer token123" → undefined (static token, keep in headers)
 */
function extractBearerTokenFromHeader(value: string): string | undefined {
  // Pattern: Bearer ${env:VAR_NAME} or Bearer ${VAR_NAME}
  const match = value.match(/^Bearer\s+\$\{(?:env:)?([A-Z_][A-Z0-9_]*)\}$/i);
  return match ? match[1] : undefined;
}

/**
 * Extract environment variable name from value
 * 
 * Examples:
 * - "${env:MY_VAR}" → "MY_VAR"
 * - "${MY_VAR}" → "MY_VAR"
 * - "static-value" → undefined
 */
function extractEnvVarName(value: string): string | undefined {
  const match = value.match(/^\$\{(?:env:)?([A-Z_][A-Z0-9_]*)\}$/i);
  return match ? match[1] : undefined;
}

/**
 * Serialize Codex configuration to TOML with custom formatting
 */
function serializeCodexToml(data: any, formatOptions: TomlFormatOptions): string {
  try {
    // Use smol-toml for serialization
    let toml = TOML.stringify(data);

    // Apply inline table formatting for specified keys
    if (formatOptions.inlineTables && formatOptions.inlineTables.length > 0) {
      toml = applyInlineTableFormatting(toml, formatOptions.inlineTables);
    }

    return toml;
  } catch (error) {
    throw new Error(
      `Failed to serialize Codex TOML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Apply inline table formatting to TOML output
 * Converts nested table sections to inline format for specified keys
 * 
 * Before:
 * [mcp_servers.figma.http_headers]
 * X-Figma-Region = "us-east-1"
 * X-Custom = "value"
 * 
 * After:
 * http_headers = { "X-Figma-Region" = "us-east-1", "X-Custom" = "value" }
 */
function applyInlineTableFormatting(toml: string, inlineKeys: string[]): string {
  let result = toml;

  for (const key of inlineKeys) {
    // Pattern to match nested table sections for the key
    // Matches: [section.subsection.key]\nfield = "value"\n...
    // Allow server names with hyphens, underscores, and quoted names
    const pattern = new RegExp(
      `\\[([\\w-]+(?:\\.[\\w-]+|\\."[^"]+")*)?\\.${key}\\]\\s*\\n([\\s\\S]*?)(?=\\n\\[|\\n*$)`,
      'g'
    );

    result = result.replace(pattern, (match, parentPath, content) => {
      // Parse the content to extract key-value pairs
      const pairs: string[] = [];
      const lines = content.trim().split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Parse key = value or key = "value"
        // Allow hyphens and other chars in key names
        const kvMatch = trimmed.match(/^([\w-]+)\s*=\s*(.+)$/);
        if (kvMatch) {
          const [, k, v] = kvMatch;
          // Quote the key for inline table format
          pairs.push(`"${k}" = ${v}`);
        }
      }

      if (pairs.length === 0) return match;

      // Format as inline table
      const inlineTable = `{ ${pairs.join(', ')} }`;
      return `${key} = ${inlineTable}`;
    });
  }

  return result;
}

// ============================================================================
// Codex TOML to MCP Transform (Inverse)
// ============================================================================

/**
 * Transform Codex TOML configuration back to universal MCP JSON format
 * 
 * Inverse of mcp-to-codex-toml transform.
 */
export const codexTomlToMcpTransform: Transform = {
  name: 'codex-toml-to-mcp',
  description: 'Convert Codex TOML configuration back to universal MCP JSON format',
  reversible: true,
  
  execute(input: any): any {
    // If input is a string, parse it as TOML first
    let data = input;
    if (typeof input === 'string') {
      try {
        data = TOML.parse(input);
      } catch (error) {
        throw new Error(
          `Failed to parse Codex TOML: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return transformCodexToMcpSchema(data);
  },
};

/**
 * Transform Codex schema back to MCP schema
 */
function transformCodexToMcpSchema(data: any): any {
  const servers = data.mcp_servers || data;
  
  if (!servers || typeof servers !== 'object') {
    logger.warn('Invalid Codex MCP configuration structure');
    return data;
  }

  const result: Record<string, McpServer> = {};

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (!serverConfig || typeof serverConfig !== 'object') {
      result[serverName] = serverConfig as McpServer;
      continue;
    }

    const codex = serverConfig as CodexMcpServer;
    const server: McpServer = {};

    // Copy STDIO server fields
    if (codex.command) server.command = codex.command;
    if (codex.args) server.args = codex.args;
    if (codex.env) server.env = codex.env;
    if (codex.env_vars) server.env_vars = codex.env_vars;
    if (codex.cwd) server.cwd = codex.cwd;

    // Transform HTTP server fields back
    if (codex.url) {
      server.url = codex.url;

      // Reconstruct headers
      const headers: Record<string, string> = {};

      // Add bearer token as Authorization header
      if (codex.bearer_token_env_var) {
        headers['Authorization'] = `Bearer \${env:${codex.bearer_token_env_var}}`;
      }

      // Add static headers
      if (codex.http_headers) {
        Object.assign(headers, codex.http_headers);
      }

      // Add environment variable headers
      if (codex.env_http_headers) {
        for (const [key, envVar] of Object.entries(codex.env_http_headers)) {
          headers[key] = `\${env:${envVar}}`;
        }
      }

      if (Object.keys(headers).length > 0) {
        server.headers = headers;
      }
    }

    // Transform timeout fields back
    if (codex.startup_timeout_sec !== undefined) {
      server.timeout = codex.startup_timeout_sec;
    } else if (codex.tool_timeout_sec !== undefined) {
      server.timeout = codex.tool_timeout_sec;
    }

    // Copy common options
    if (codex.enabled !== undefined) server.enabled = codex.enabled;
    if (codex.enabled_tools) server.enabled_tools = codex.enabled_tools;
    if (codex.disabled_tools) server.disabled_tools = codex.disabled_tools;

    result[serverName] = server;
  }

  return result;
}

// ============================================================================
// Registry Integration
// ============================================================================

/**
 * Register all TOML domain transforms
 */
export function registerTomlDomainTransforms(registry: any): void {
  registry.register(mcpToCodexSchemaTransform);
  registry.register(mcpToCodexTomlTransform);
  registry.register(codexTomlToMcpTransform);
}
