/**
 * @fileoverview Main pipeline for the show command
 * 
 * Orchestrates package resolution, data collection, and display.
 * This is the main business logic layer that coordinates all show operations.
 */

import { basename } from 'path';
import { isJunk } from 'junk';
import { logger } from '../../utils/logger.js';
import { isUnversionedVersion } from '../../utils/package-versioning.js';
import { loadPackageConfig } from '../package-context.js';
import { packageManager } from '../package.js';
import { ensureRegistryDirectories } from '../directory.js';
import { resolvePackageForShow } from './package-resolver.js';
import { displayPackageInfo, displayResolutionInfo } from './show-output.js';
import type { ShowPackageInfo } from './show-types.js';
import type { CommandResult } from '../../types/index.js';

/**
 * Collect package information for display
 */
async function collectPackageInfo(
  resolvedPath: string,
  name: string,
  version: string
): Promise<Omit<ShowPackageInfo, 'source'>> {
  logger.debug('Collecting package information', { resolvedPath, name, version });

  // Load manifest
  const metadata = await loadPackageConfig(resolvedPath);
  if (!metadata) {
    throw new Error(`Failed to load package metadata from: ${resolvedPath}`);
  }

  // Load package using the provided packageRootDir option to read from resolved path
  // Use a temporary name if the actual name isn't valid for validation
  const pkg = await packageManager.loadPackage(
    metadata.name, // Use name from manifest instead of potentially invalid input
    version,
    { packageRootDir: resolvedPath }
  );
  const packageFiles = pkg.files;

  // Filter out junk files and sort
  const filteredFiles = packageFiles.filter((f: any) => !isJunk(basename(f.path)));
  const sortedFilePaths = filteredFiles
    .map((f: any) => f.path)
    .sort((a: string, b: string) => a.localeCompare(b));

  // Check if unversioned
  const unversioned = isUnversionedVersion(version);

  // Detect partial packages
  let isPartial = false;
  if (version && !unversioned) {
    try {
      const versionState = await packageManager.getPackageVersionState(name, version);
      isPartial = Boolean((metadata as any).partial) || versionState.isPartial;
    } catch (error) {
      // If we can't get version state, check manifest flag only
      isPartial = Boolean((metadata as any).partial);
      logger.debug('Failed to get version state, using manifest flag only', { error });
    }
  }

  return {
    name: metadata.name,
    version: metadata.version || version,
    unversioned,
    metadata,
    files: sortedFilePaths,
    isPartial
  };
}

/**
 * Run the show pipeline for a package
 * 
 * This is the main entry point for showing package information.
 * It coordinates:
 * 1. Package resolution (finding the package)
 * 2. Data collection (loading metadata and files)
 * 3. Display (formatting and outputting information)
 * 
 * @param packageInput - User input (package name, path, git URL, etc.)
 * @param cwd - Current working directory
 * @returns Command result with success status
 */
export async function runShowPipeline(
  packageInput: string,
  cwd: string = process.cwd()
): Promise<CommandResult> {
  logger.debug('Starting show pipeline', { packageInput, cwd });

  try {
    // Ensure registry directories exist
    await ensureRegistryDirectories();

    // Step 1: Resolve package location
    const resolved = await resolvePackageForShow(packageInput, cwd);

    logger.info('Package resolved for show', {
      input: packageInput,
      resolvedPath: resolved.path,
      sourceType: resolved.source.type
    });

    // Display resolution info if multiple candidates were found
    if (resolved.resolutionInfo) {
      displayResolutionInfo(resolved.resolutionInfo);
    }

    // Step 2: Collect package information
    const packageInfo = await collectPackageInfo(
      resolved.path,
      resolved.name,
      resolved.version
    );

    // Combine resolved source info with collected data
    const completeInfo: ShowPackageInfo = {
      ...packageInfo,
      source: resolved.source
    };

    // Step 3: Display package information
    displayPackageInfo(completeInfo, cwd);

    logger.debug('Show pipeline completed successfully');

    return {
      success: true,
      data: completeInfo.metadata
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Show pipeline failed', { error: message });

    return {
      success: false,
      error: message
    };
  }
}
