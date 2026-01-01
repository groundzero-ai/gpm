import path from 'path';
import semver from 'semver';

import type { CommandResult, PackOptions, PackageYml } from '../../types/index.js';
import { FILE_PATTERNS } from '../../constants/index.js';
import { ensureRegistryDirectories, getPackageVersionPath } from '../directory.js';
import { readPackageFilesForRegistry, writePackageFilesToDirectory } from '../../utils/package-copy.js';
import { parsePackageYml } from '../../utils/package-yml.js';
import { exists, remove } from '../../utils/fs.js';
import { logger } from '../../utils/logger.js';
import { resolvePackageByName } from '../../utils/package-name-resolution.js';

interface ResolvedSource {
  name: string;
  version: string;
  packageRoot: string;
  manifest: PackageYml;
}

async function resolveSource(
  cwd: string,
  packageName?: string
): Promise<ResolvedSource> {
  // No package name provided - pack CWD as package
  if (!packageName) {
    const manifestPath = path.join(cwd, FILE_PATTERNS.OPENPACKAGE_YML);
    if (!(await exists(manifestPath))) {
      throw new Error('No openpackage.yml found in current directory; specify a package name or run inside a package root.');
    }
    const manifest = await parsePackageYml(manifestPath);
    return {
      name: manifest.name,
      version: manifest.version ?? '',
      packageRoot: cwd,
      manifest
    };
  }

  // Package name provided - use name resolution
  // Priority: CWD (if name matches) → Workspace → Global
  // Skip registry (already immutable) and remote (not relevant)
  const resolution = await resolvePackageByName({
    cwd,
    packageName,
    checkCwd: true,           // Check if CWD is the package (highest priority)
    searchWorkspace: true,    // Search workspace packages
    searchGlobal: true,       // Search global packages
    searchRegistry: false     // Skip registry (already packed/immutable)
  });

  if (!resolution.found || !resolution.path) {
    throw new Error(
      `Package '${packageName}' not found.\n` +
      `Searched: current directory, workspace packages (.openpackage/packages/), and global packages (~/.openpackage/packages/).\n` +
      `Make sure the package exists in one of these locations.`
    );
  }

  // Load manifest from resolved path
  const manifestPath = path.join(resolution.path, FILE_PATTERNS.OPENPACKAGE_YML);
  if (!(await exists(manifestPath))) {
    throw new Error(`openpackage.yml not found at ${manifestPath}`);
  }

  const manifest = await parsePackageYml(manifestPath);

  // Log resolution info for debugging/transparency
  if (resolution.resolutionInfo) {
    const { selected, reason } = resolution.resolutionInfo;
    logger.info('Resolved package for packing', {
      packageName,
      selectedSource: selected.type,
      version: selected.version,
      path: selected.path,
      reason
    });

    // User-friendly message about where package was found
    const sourceLabel = selected.type === 'cwd' ? 'current directory' :
                       selected.type === 'workspace' ? 'workspace packages' :
                       selected.type === 'global' ? 'global packages' : selected.type;
    console.log(`✓ Found ${packageName} in ${sourceLabel}`);
  }

  return {
    name: manifest.name,
    version: manifest.version ?? '',
    packageRoot: resolution.path,
    manifest
  };
}

export interface PackPipelineResult {
  destination: string;
  files: number;
}

export async function runPackPipeline(
  packageName: string | undefined,
  options: PackOptions = {}
): Promise<CommandResult<PackPipelineResult>> {
  const cwd = process.cwd();

  try {
    const source = await resolveSource(cwd, packageName);

    if (!source.version || !semver.valid(source.version)) {
      return {
        success: false,
        error: `openpackage.yml must contain a valid semver version to pack (found "${source.version || 'undefined'}").`
      };
    }

    const files = await readPackageFilesForRegistry(source.packageRoot);
    if (files.length === 0) {
      return { success: false, error: 'No package files found to pack.' };
    }

    const destination = options.output
      ? path.resolve(cwd, options.output)
      : getPackageVersionPath(source.name, source.version);

    if (options.dryRun) {
      console.log(`(dry-run) Would write ${files.length} files to: ${destination}`);
      return {
        success: true,
        data: { destination, files: files.length }
      };
    }

    if (!options.output) {
      await ensureRegistryDirectories();
    }

    if (await exists(destination)) {
      await remove(destination);
    }

    await writePackageFilesToDirectory(destination, files);

    logger.info(`Packed ${source.name}@${source.version} to ${destination}`);

    return {
      success: true,
      data: { destination, files: files.length }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
