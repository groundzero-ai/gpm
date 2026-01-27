import { basename } from 'path';
import type { InstallOptions } from '../../../types/index.js';
import type { InstallationContext, PackageSource } from './context.js';
import { classifyPackageInput } from '../../../utils/package-input.js';
import { normalizePlatforms } from '../../../utils/platform-mapper.js';
import { parsePackageYml } from '../../../utils/package-yml.js';
import { getLocalPackageYmlPath, getLocalOpenPackageDir } from '../../../utils/paths.js';
import { exists } from '../../../utils/fs.js';
import { createWorkspacePackageYml, ensureLocalOpenPackageStructure } from '../../../utils/package-management.js';
import { logger } from '../../../utils/logger.js';
import { resolveDeclaredPath } from '../../../utils/path-resolution.js';

/**
 * Build context for registry-based installation
 */
export async function buildRegistryInstallContext(
  cwd: string,
  packageName: string,
  options: InstallOptions & { version?: string; registryPath?: string }
): Promise<InstallationContext> {
  const source: PackageSource = {
    type: 'registry',
    packageName,
    version: options.version,
    registryPath: options.registryPath
  };
  
  return {
    source,
    mode: 'install',
    options,
    platforms: normalizePlatforms(options.platforms) || [],
    cwd,
    targetDir: '.',
    resolvedPackages: [],
    warnings: [],
    errors: []
  };
}

/**
 * Build context for path-based installation
 */
export async function buildPathInstallContext(
  cwd: string,
  sourcePath: string,
  options: InstallOptions & { sourceType: 'directory' | 'tarball' }
): Promise<InstallationContext> {
  // Will need to load package to get name
  // For now, we'll populate after loading
  const source: PackageSource = {
    type: 'path',
    packageName: '', // Populated after loading
    localPath: sourcePath,
    sourceType: options.sourceType
  };
  
  return {
    source,
    mode: 'install',
    options,
    platforms: normalizePlatforms(options.platforms) || [],
    cwd,
    targetDir: '.',
    resolvedPackages: [],
    warnings: [],
    errors: []
  };
}

/**
 * Build context for git-based installation
 */
export async function buildGitInstallContext(
  cwd: string,
  gitUrl: string,
  options: InstallOptions & { gitRef?: string; gitSubdirectory?: string }
): Promise<InstallationContext> {
  const source: PackageSource = {
    type: 'git',
    packageName: '', // Populated after loading
    gitUrl,
    gitRef: options.gitRef,
    gitSubdirectory: options.gitSubdirectory
  };
  
  return {
    source,
    mode: 'install',
    options,
    platforms: normalizePlatforms(options.platforms) || [],
    cwd,
    targetDir: '.',
    resolvedPackages: [],
    warnings: [],
    errors: []
  };
}

/**
 * Build context for workspace root installation
 * Used when installing/applying workspace-level files from .openpackage/
 */
export async function buildWorkspaceRootInstallContext(
  cwd: string,
  options: InstallOptions,
  mode: 'install' | 'apply' = 'install'
): Promise<InstallationContext | null> {
  // Ensure .openpackage/ structure exists
  await ensureLocalOpenPackageStructure(cwd);
  
  // Create workspace manifest if it doesn't exist
  await createWorkspacePackageYml(cwd);
  
  const openpackageDir = getLocalOpenPackageDir(cwd);
  const packageYmlPath = getLocalPackageYmlPath(cwd);
  
  // Check if workspace manifest exists
  if (!(await exists(packageYmlPath))) {
    logger.debug('No workspace manifest found, skipping workspace root context');
    return null;
  }
  
  // Load workspace manifest
  let config;
  try {
    config = await parsePackageYml(packageYmlPath);
  } catch (error) {
    logger.warn(`Failed to read workspace manifest: ${error}`);
    return null;
  }
  
  // Use workspace directory name as package name if not specified in manifest
  const packageName = config.name || basename(cwd);
  
  const source: PackageSource = {
    type: 'workspace',
    packageName,
    version: config.version,
    contentRoot: openpackageDir
  };
  
  return {
    source,
    mode,
    options: mode === 'apply' ? { ...options, force: true } : options,
    platforms: normalizePlatforms(options.platforms) || [],
    cwd,
    targetDir: '.',
    resolvedPackages: [],
    warnings: [],
    errors: []
  };
}

/**
 * Build context for apply command (single package)
 */
export async function buildApplyContext(
  cwd: string,
  packageName: string,
  options: InstallOptions
): Promise<InstallationContext>;

/**
 * Build context for apply command (bulk apply when no package specified)
 */
export async function buildApplyContext(
  cwd: string,
  packageName: undefined,
  options: InstallOptions
): Promise<InstallationContext[]>;

/**
 * Build context for apply command
 */
export async function buildApplyContext(
  cwd: string,
  packageName: string | undefined,
  options: InstallOptions
): Promise<InstallationContext | InstallationContext[]> {
  // No package name = apply workspace root + all installed packages
  if (!packageName) {
    return buildBulkApplyContexts(cwd, options);
  }
  
  const source: PackageSource = {
    type: 'workspace',
    packageName
    // version and contentRoot will be populated from workspace index
  };
  
  return {
    source,
    mode: 'apply',
    options: {
      ...options,
      force: true // Apply always overwrites
    },
    platforms: [], // Will be populated from detected platforms
    cwd,
    targetDir: '.',
    resolvedPackages: [],
    warnings: [],
    errors: []
  };
}

/**
 * Build context from package input (auto-detect type)
 */
export async function buildInstallContext(
  cwd: string,
  packageInput: string | undefined,
  options: InstallOptions
): Promise<InstallationContext | InstallationContext[]> {
  // No input = bulk install
  if (!packageInput) {
    return buildBulkInstallContexts(cwd, options);
  }
  
  // Classify input to determine source type
  const classification = await classifyPackageInput(packageInput, cwd);
  
  switch (classification.type) {
    case 'registry':
      return buildRegistryInstallContext(cwd, classification.name!, options);
    
    case 'directory':
    case 'tarball':
      return buildPathInstallContext(cwd, classification.resolvedPath!, {
        ...options,
        sourceType: classification.type
      });
    
    case 'git':
      return buildGitInstallContext(cwd, classification.gitUrl!, {
        ...options,
        gitRef: classification.gitRef,
        gitSubdirectory: classification.gitSubdirectory
      });
    
    default:
      throw new Error(`Unknown package input type: ${classification.type}`);
  }
}

/**
 * Build contexts for bulk installation
 */
async function buildBulkInstallContexts(
  cwd: string,
  options: InstallOptions
): Promise<InstallationContext[]> {
  const contexts: InstallationContext[] = [];
  
  // First, try to build workspace root context
  const workspaceContext = await buildWorkspaceRootInstallContext(cwd, options, 'install');
  if (workspaceContext) {
    contexts.push(workspaceContext);
  }
  
  // Ensure workspace manifest exists before reading
  await createWorkspacePackageYml(cwd);
  
  // Read openpackage.yml and create context for each package
  const opkgYmlPath = getLocalPackageYmlPath(cwd);
  const opkgYml = await parsePackageYml(opkgYmlPath);
  
  // Get workspace package name to exclude it from bulk install
  const workspacePackageName = workspaceContext?.source.packageName;
  
  if (opkgYml.packages && opkgYml.packages.length > 0) {
    for (const dep of opkgYml.packages) {
      // Skip if this package matches the workspace package name
      if (workspacePackageName && dep.name === workspacePackageName) {
        logger.debug(`Skipping workspace package '${dep.name}' from bulk install`);
        continue;
      }
      
      let source: PackageSource;
      
      if (dep.git) {
        // Git source
        source = {
          type: 'git',
          packageName: dep.name,
          gitUrl: dep.git,
          gitRef: dep.ref,
          gitSubdirectory: dep.subdirectory
        };
      } else if (dep.path) {
        // Path source - resolve tilde paths before creating source
        const resolved = resolveDeclaredPath(dep.path, cwd);
        const isTarball = dep.path.endsWith('.tgz') || dep.path.endsWith('.tar.gz');
        
        source = {
          type: 'path',
          packageName: dep.name,
          localPath: resolved.absolute,
          sourceType: isTarball ? 'tarball' : 'directory'
        };
      } else {
        // Registry source
        source = {
          type: 'registry',
          packageName: dep.name,
          version: dep.version
        };
      }
      
      contexts.push({
        source,
        mode: 'install',
        options,
        platforms: normalizePlatforms(options.platforms) || [],
        cwd,
        targetDir: '.',
        resolvedPackages: [],
        warnings: [],
        errors: []
      });
    }
  }
  
  return contexts;
}

/**
 * Build contexts for bulk apply
 */
async function buildBulkApplyContexts(
  cwd: string,
  options: InstallOptions
): Promise<InstallationContext[]> {
  const { readWorkspaceIndex } = await import('../../../utils/workspace-index-yml.js');
  const { index } = await readWorkspaceIndex(cwd);
  
  const contexts: InstallationContext[] = [];
  
  // First, try to build workspace root context if it exists
  // Note: We include the workspace context even if it's not in the index yet.
  // The pipeline will upsert it to the index during execution (apply command updates index).
  // This allows 'opkg add' followed by 'opkg apply' to work without requiring 'opkg install' first.
  const workspaceContext = await buildWorkspaceRootInstallContext(cwd, options, 'apply');
  if (workspaceContext) {
    contexts.push(workspaceContext);
  }
  
  // Then apply all other installed packages
  const packageNames = Object.keys(index.packages ?? {}).sort();
  const workspacePackageName = workspaceContext?.source.packageName;
  
  for (const name of packageNames) {
    // Skip workspace package (already added)
    if (workspacePackageName && name === workspacePackageName) {
      continue;
    }
    
    const source: PackageSource = {
      type: 'workspace',
      packageName: name
      // version and contentRoot will be populated from workspace index
    };
    
    contexts.push({
      source,
      mode: 'apply',
      options: {
        ...options,
        force: true // Apply always overwrites
      },
      platforms: [], // Will be populated from detected platforms
      cwd,
      targetDir: '.',
      resolvedPackages: [],
      warnings: [],
      errors: []
    });
  }
  
  return contexts;
}
