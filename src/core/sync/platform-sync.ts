/**
 * Platform Sync Module
 * Utility functions for syncing saved package files across detected platforms
 */

import { getDetectedPlatforms } from '../platforms.js';
import { logger } from '../../utils/logger.js';
import type { PackageFile, InstallOptions } from '../../types/index.js';
import { installOrSyncRootFiles, type RootFileOperationResult } from '../install/operations/root-files.js';
import { applyPlannedSyncForPackageFiles } from '../../utils/index-based-installer.js';
import type { PackageIndexLocation } from '../../utils/package-index-yml.js';

/**
 * Result of platform sync operation
 */
export interface PlatformSyncResult {
  created: string[];
  updated: string[];
  deleted?: string[];
}

export interface PlatformSyncOptions extends InstallOptions {
  skipRootSync?: boolean;
  packageLocation?: PackageIndexLocation;
}

export async function performPlatformSync(
  cwd: string,
  packageName: string,
  packageVersion: string,
  packageFiles: PackageFile[],
  options: PlatformSyncOptions = {}
): Promise<PlatformSyncResult> {
  const { skipRootSync, packageLocation = 'nested', ...installOptions } = options;
  const detectedPlatforms = await getDetectedPlatforms(cwd);

  logger.debug(
    `Planning platform sync for package ${packageName}@${packageVersion} across ${detectedPlatforms.length} platforms`
  );

  const syncOptions: InstallOptions = {
    ...installOptions,
    dryRun: installOptions?.dryRun ?? false,
    resolvedPlatforms: detectedPlatforms
  };

  const plannerOutcome = await applyPlannedSyncForPackageFiles(
    cwd,
    packageName,
    packageVersion,
    packageFiles,
    detectedPlatforms,
    syncOptions,
    packageLocation
  );

  const rootSyncResult: RootFileOperationResult = skipRootSync
    ? { created: [], updated: [], skipped: [] }
    : await installOrSyncRootFiles(cwd, packageName, packageFiles, detectedPlatforms);

  return {
    created: [...plannerOutcome.operation.installedFiles, ...rootSyncResult.created],
    updated: [...plannerOutcome.operation.updatedFiles, ...rootSyncResult.updated],
    deleted: plannerOutcome.operation.deletedFiles
  };
}