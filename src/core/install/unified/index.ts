/**
 * Unified installation context and builders
 * 
 * This module provides a unified approach to installation contexts that works
 * across all installation scenarios (registry, path, git, apply).
 */

// Core types
export type {
  PackageSource,
  InstallationMode,
  InstallationContext
} from './context.js';

// Context builders
export {
  buildRegistryInstallContext,
  buildPathInstallContext,
  buildGitInstallContext,
  buildApplyContext,
  buildInstallContext
} from './context-builders.js';

// Helper utilities
export {
  isApplyMode,
  shouldResolveDependencies,
  shouldUpdateManifest,
  addWarning,
  addError,
  getSourceDisplayName
} from './context-helpers.js';

// Pipeline
export { runUnifiedInstallPipeline } from './pipeline.js';

// Phase functions (for testing)
export { loadPackagePhase } from './phases/load-package.js';
export { resolveDependenciesPhase } from './phases/resolve-dependencies.js';
export { processConflictsPhase } from './phases/conflicts.js';
export { executeInstallationPhase } from './phases/execute.js';
export { updateManifestPhase } from './phases/manifest.js';
export { reportResultsPhase } from './phases/report.js';

// Phase types
export type { ExecutionResult } from './phases/execute.js';
