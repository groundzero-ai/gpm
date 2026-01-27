/**
 * Result Converter Module
 * 
 * Utilities for converting execution results to installation results.
 */

import type { Platform } from '../../../platforms.js';
import type { FlowInstallResult, FlowConflictReport } from '../types.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Convert execution result from flow coordinator to installation result format
 * 
 * @param executionResult - Result from flow execution coordinator
 * @param packageName - Name of package being installed
 * @param platform - Target platform
 * @param dryRun - Whether this is a dry run
 * @returns Formatted installation result
 */
export function convertToInstallResult(
  executionResult: any,
  packageName: string,
  platform: Platform,
  dryRun: boolean
): FlowInstallResult {
  const result: FlowInstallResult = {
    success: executionResult.success,
    filesProcessed: executionResult.filesProcessed,
    filesWritten: executionResult.filesWritten,
    conflicts: executionResult.conflicts.map((c: any) => ({
      targetPath: c.path,
      packages: [
        { packageName: c.winner, priority: 0, chosen: true },
        ...c.losers.map((loser: string) => ({
          packageName: loser,
          priority: 0,
          chosen: false
        }))
      ],
      message: `Conflict in ${c.path}: ${c.winner} overwrites ${c.losers.join(', ')}`
    })),
    errors: executionResult.errors,
    targetPaths: executionResult.targetPaths,
    fileMapping: executionResult.fileMapping
  };
  
  // Log results
  if (result.filesProcessed > 0) {
    logger.info(
      `Processed ${result.filesProcessed} files for ${packageName} on platform ${platform}` +
      (dryRun ? ' (dry run)' : `, wrote ${result.filesWritten} files`)
    );
  }
  
  return result;
}

/**
 * Create an empty install result (for early returns)
 */
export function createEmptyResult(): FlowInstallResult {
  return {
    success: true,
    filesProcessed: 0,
    filesWritten: 0,
    conflicts: [],
    errors: [],
    targetPaths: [],
    fileMapping: {}
  };
}

/**
 * Map conflicts to conflict reports with enriched metadata
 */
export function mapConflictsToReports(
  conflicts: Array<{ path: string; winner: string; losers: string[] }>
): FlowConflictReport[] {
  return conflicts.map(conflict => ({
    targetPath: conflict.path,
    packages: [
      { packageName: conflict.winner, priority: 0, chosen: true },
      ...conflict.losers.map(loser => ({
        packageName: loser,
        priority: 0,
        chosen: false
      }))
    ],
    message: `Conflict in ${conflict.path}: ${conflict.winner} overwrites ${conflict.losers.join(', ')}`
  }));
}
