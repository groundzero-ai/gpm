/**
 * Package source loaders
 * 
 * This module provides an abstraction layer for loading packages from different
 * sources (registry, path, git, workspace). Each loader implements the
 * PackageSourceLoader interface and handles source-specific loading logic.
 */

// Core types and base interface
export type {
  LoadedPackage,
  PackageSourceLoader
} from './base.js';

export { SourceLoadError } from './base.js';

// Source loader implementations
export { RegistrySourceLoader } from './registry-source.js';
export { PathSourceLoader } from './path-source.js';
export { GitSourceLoader } from './git-source.js';
export { WorkspaceSourceLoader } from './workspace-source.js';

// Factory and registry
export {
  getLoaderForSource,
  registerSourceLoader
} from './loader-factory.js';
