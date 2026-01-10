/**
 * TOML Domain Transforms
 * 
 * This file previously contained legacy MCP-to-Codex transforms.
 * Those transforms have been replaced by the declarative map pipeline
 * approach defined in platforms.jsonc.
 * 
 * The file is kept as a placeholder for future domain-specific transforms
 * if needed.
 */

/**
 * Register TOML domain transforms
 * 
 * Currently no domain transforms are registered.
 * All TOML transformations are handled through:
 * 1. Map pipeline operations (in platforms.jsonc)
 * 2. Generic json-to-toml / toml-to-json transforms (in flow-transforms.ts)
 */
export function registerTomlDomainTransforms(registry: any): void {
  // No transforms to register
  // Legacy mcp-to-codex-toml and codex-toml-to-mcp have been removed
}
