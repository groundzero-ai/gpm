/**
 * @fileoverview Package resolution logic for the show command
 * 
 * Handles resolving package inputs (names, paths, git URLs, tarballs) to their
 * actual file system locations using unified resolution logic.
 */

import { resolve } from 'path';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';
import { parsePackageInput } from '../../utils/package-name.js';
import { classifyPackageInput } from '../../utils/package-input.js';
import { resolvePackageByName } from '../../utils/package-name-resolution.js';
import { loadPackageFromGit } from '../install/git-package-loader.js';
import { isValidPackageDirectory, loadPackageConfig } from '../package-context.js';
import type { ShowPackageSource, ShowResolutionInfo, ShowSourceType } from './show-types.js';

/**
 * Result of resolving a package for show
 */
export interface ResolvedPackage {
  /** Absolute path to the package directory */
  path: string;
  /** Package name from manifest */
  name: string;
  /** Package version from manifest (may be empty) */
  version: string;
  /** Source information */
  source: ShowPackageSource;
  /** Resolution info if multiple candidates were found */
  resolutionInfo?: ShowResolutionInfo;
}

/**
 * Get human-readable label for source type
 */
function getSourceLabel(sourceType: ShowSourceType): string {
  switch (sourceType) {
    case 'cwd':
      return 'current directory';
    case 'workspace':
      return 'workspace packages';
    case 'global':
      return 'global packages';
    case 'registry':
      return 'local registry';
    case 'path':
      return 'path';
    case 'git':
      return 'git repository';
    case 'tarball':
      return 'tarball';
    default:
      return sourceType;
  }
}

/**
 * Determine if a package source is mutable based on path and type
 */
function determineIfMutable(packagePath: string, sourceType: ShowSourceType): boolean {
  // Git sources and tarballs are treated as immutable for show purposes
  if (sourceType === 'git' || sourceType === 'tarball') {
    return false;
  }

  // Check if path is in registry (immutable) or packages (mutable)
  const normalizedPath = packagePath.toLowerCase();
  if (normalizedPath.includes('.openpackage/registry')) {
    return false;
  }
  if (normalizedPath.includes('.openpackage/packages')) {
    return true;
  }

  // CWD, workspace, global, and arbitrary paths are mutable
  return sourceType === 'cwd' || sourceType === 'workspace' || sourceType === 'global' || sourceType === 'path';
}

/**
 * Create source information object
 */
function createSourceInfo(path: string, type: ShowSourceType): ShowPackageSource {
  return {
    type,
    path,
    isMutable: determineIfMutable(path, type),
    label: getSourceLabel(type)
  };
}

/**
 * Resolve package from git URL
 */
async function resolveFromGit(
  gitUrl: string,
  gitRef: string | undefined
): Promise<ResolvedPackage> {
  logger.debug('Resolving package from git', { gitUrl, gitRef });

  const { sourcePath } = await loadPackageFromGit({
    url: gitUrl,
    ref: gitRef
  });

  if (!await isValidPackageDirectory(sourcePath)) {
    throw new ValidationError(
      `Git repository does not contain a valid OpenPackage (missing openpackage.yml)`
    );
  }

  const manifest = await loadPackageConfig(sourcePath);
  if (!manifest) {
    throw new ValidationError(`Failed to load package manifest from git source`);
  }

  return {
    path: sourcePath,
    name: manifest.name,
    version: manifest.version || '',
    source: createSourceInfo(sourcePath, 'git')
  };
}

/**
 * Resolve package from directory or tarball path
 */
async function resolveFromPath(
  packagePath: string,
  sourceType: 'directory' | 'tarball',
  cwd: string
): Promise<ResolvedPackage> {
  logger.debug('Resolving package from path', { packagePath, sourceType });

  if (sourceType === 'directory' && !await isValidPackageDirectory(packagePath)) {
    throw new ValidationError(
      `Path '${packagePath}' is not a valid OpenPackage directory (missing openpackage.yml)`
    );
  }

  const manifest = await loadPackageConfig(packagePath);
  if (!manifest) {
    throw new ValidationError(`Failed to load package manifest from path: ${packagePath}`);
  }

  // Determine specific source type based on path
  let specificType: ShowSourceType = 'path';
  const normalizedPath = packagePath.toLowerCase();
  const normalizedCwd = cwd.toLowerCase();

  if (normalizedPath.includes('.openpackage/packages')) {
    specificType = normalizedPath.includes(normalizedCwd) ? 'workspace' : 'global';
  } else if (normalizedPath.includes('.openpackage/registry')) {
    specificType = 'registry';
  } else if (normalizedPath === normalizedCwd) {
    specificType = 'cwd';
  } else if (sourceType === 'tarball') {
    specificType = 'tarball';
  }

  return {
    path: packagePath,
    name: manifest.name,
    version: manifest.version || '',
    source: createSourceInfo(packagePath, specificType)
  };
}

/**
 * Convert package-name-resolution result to show resolution info
 */
function convertResolutionInfo(resolutionInfo: any): ShowResolutionInfo {
  return {
    candidates: resolutionInfo.candidates.map((c: any) => ({
      type: c.type,
      version: c.version,
      path: c.path
    })),
    selected: {
      type: resolutionInfo.selected.type,
      version: resolutionInfo.selected.version,
      path: resolutionInfo.selected.path
    },
    reason: resolutionInfo.reason
  };
}

/**
 * Resolve package from name using unified resolution
 */
async function resolveFromName(
  name: string,
  version: string | undefined,
  cwd: string
): Promise<ResolvedPackage> {
  logger.debug('Resolving package by name', { name, version });

  // Use unified resolution (CWD → Workspace → Global → Registry)
  const resolution = await resolvePackageByName({
    cwd,
    packageName: name,
    checkCwd: true,        // Check if CWD is the package
    searchWorkspace: true, // Check workspace packages
    searchGlobal: true,    // Check global packages
    searchRegistry: true   // Check local registry
  });

  if (!resolution.found || !resolution.path) {
    throw new ValidationError(`Package '${name}' not found locally`);
  }

  // Load manifest to get actual package details
  const manifest = await loadPackageConfig(resolution.path);
  if (!manifest) {
    throw new ValidationError(`Failed to load package manifest for: ${name}`);
  }

  const result: ResolvedPackage = {
    path: resolution.path,
    name: manifest.name,
    version: manifest.version || version || '',
    source: createSourceInfo(resolution.path, resolution.sourceType!)
  };

  // Include resolution info if multiple candidates were found
  if (resolution.resolutionInfo && resolution.resolutionInfo.candidates.length > 1) {
    result.resolutionInfo = convertResolutionInfo(resolution.resolutionInfo);
  }

  return result;
}

/**
 * Resolve a package input (name, path, git URL, tarball) to its location
 * 
 * This is the main entry point for package resolution in the show command.
 * It handles all input types and uses the appropriate resolution strategy.
 * 
 * @param packageInput - User input (package name, path, git URL, etc.)
 * @param cwd - Current working directory
 * @returns Resolved package information
 */
export async function resolvePackageForShow(
  packageInput: string,
  cwd: string
): Promise<ResolvedPackage> {
  logger.debug('Resolving package for show', { packageInput, cwd });

  // Classify the input type
  const classification = await classifyPackageInput(packageInput, cwd);

  switch (classification.type) {
    case 'git':
      return resolveFromGit(classification.gitUrl!, classification.gitRef);

    case 'directory':
    case 'tarball':
      return resolveFromPath(classification.resolvedPath!, classification.type, cwd);

    case 'registry': {
      // Registry classification means it looks like a package name
      const { name, version } = parsePackageInput(packageInput);
      return resolveFromName(name, version, cwd);
    }

    default:
      throw new ValidationError(`Unknown input type: ${classification.type}`);
  }
}
