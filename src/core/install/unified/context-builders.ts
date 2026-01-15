import type { InstallOptions } from '../../../types/index.js';
import type { InstallationContext, PackageSource } from './context.js';
import { classifyPackageInput } from '../../../utils/package-input.js';
import { normalizePlatforms } from '../../../utils/platform-mapper.js';
import { parsePackageYml } from '../../../utils/package-yml.js';
import { getLocalPackageYmlPath } from '../../../utils/paths.js';
import { exists } from '../../../utils/fs.js';
import { createWorkspacePackageYml } from '../../../utils/package-management.js';

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
 * Build context for apply command
 */
export async function buildApplyContext(
  cwd: string,
  packageName: string,
  options: InstallOptions
): Promise<InstallationContext> {
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
  // Ensure workspace manifest exists before reading
  await createWorkspacePackageYml(cwd);
  
  // Read openpackage.yml and create context for each package
  const opkgYmlPath = getLocalPackageYmlPath(cwd);
  const opkgYml = await parsePackageYml(opkgYmlPath);
  
  if (!opkgYml.packages || opkgYml.packages.length === 0) {
    return [];
  }
  
  const contexts: InstallationContext[] = [];
  
  for (const dep of opkgYml.packages) {
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
      // Path source
      const isAbsolute = dep.path.startsWith('/');
      const isTarball = dep.path.endsWith('.tgz') || dep.path.endsWith('.tar.gz');
      
      source = {
        type: 'path',
        packageName: dep.name,
        localPath: dep.path,
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
  
  return contexts;
}
