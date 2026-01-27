/**
 * Flow-Based Installer Module
 * 
 * Handles installation of package files using the declarative flow system.
 * Integrates with the existing install pipeline to execute flow transformations
 * for each package file, with multi-package composition and priority-based merging.
 * 
 * This module now serves as a thin orchestration layer, delegating to specialized
 * strategy implementations for different installation scenarios.
 * 
 * CORE LAYER: Pure flow execution logic
 * For workspace-integrated installation with index updates, see flow-index-installer.ts
 */

import type { Platform } from '../platforms.js';
import type { InstallOptions } from '../../types/index.js';
import { platformUsesFlows } from '../platforms.js';
import { logger } from '../../utils/logger.js';
import {
  selectInstallStrategy,
  type FlowInstallContext,
  type FlowInstallResult,
  type FlowConflictReport,
  type FlowInstallError
} from './strategies/index.js';
import { getApplicableFlows } from './strategies/helpers/flow-helpers.js';
import type { FlowContext } from '../../types/flows.js';
import {
  detectFormatFromDirectory,
  detectFormatWithContextFromDirectory
} from './helpers/format-detection.js';
import {
  logInstallationResult
} from './helpers/result-logging.js';
import {
  aggregateFlowResults
} from './helpers/result-aggregation.js';
import {
  trackTargetFiles,
  generateConflictReports
} from './helpers/conflict-detection.js';

// Re-export types for backward compatibility
export type {
  FlowInstallContext,
  FlowInstallResult,
  FlowConflictReport,
  FlowInstallError
};

// ============================================================================
// Main Installation API
// ============================================================================

/**
 * Execute flows for a single package installation with format detection and conversion
 * 
 * This is the main entry point for flow-based installation. It:
 * 1. Detects the package format (universal vs platform-specific)
 * 2. Selects the appropriate installation strategy
 * 3. Delegates to the strategy for execution
 * 
 * @param installContext - Installation context with package metadata
 * @param options - Installation options (e.g., dryRun)
 * @returns Installation result with file mappings and metrics
 */
export async function installPackageWithFlows(
  installContext: FlowInstallContext,
  options?: InstallOptions
): Promise<FlowInstallResult> {
  const {
    packageName,
    packageRoot,
    workspaceRoot,
    platform,
    packageVersion,
    priority,
    dryRun
  } = installContext;
  
  const result: FlowInstallResult = {
    success: true,
    filesProcessed: 0,
    filesWritten: 0,
    conflicts: [],
    errors: [],
    targetPaths: [],
    fileMapping: {}
  };
  
  try {
    // Check if platform uses flows
    if (!platformUsesFlows(platform, workspaceRoot)) {
      logger.debug(`Platform ${platform} does not use flows, skipping flow-based installation`);
      return result;
    }
    
    // Phase 1: Get or detect package format
    const packageFormat = installContext.packageFormat || 
      await detectFormatFromDirectory(packageRoot);
    
    logger.debug('Package format', {
      package: packageName,
      type: packageFormat.type,
      platform: packageFormat.platform,
      confidence: packageFormat.confidence,
      targetPlatform: platform,
      source: installContext.packageFormat ? 'provided' : 'detected'
    });
    
    // Phase 2: Select and execute installation strategy
    const enrichedContext: FlowInstallContext = {
      ...installContext,
      packageFormat
    };
    
    const strategy = selectInstallStrategy(enrichedContext, options);
    const strategyResult = await strategy.install(enrichedContext, options);
    
    // Log results using shared utility
    logInstallationResult(strategyResult, packageName, platform, dryRun ?? false);
    
    return strategyResult;
    
  } catch (error) {
    result.success = false;
    logger.error(`Failed to install package ${packageName} with flows: ${(error as Error).message}`);
    result.errors.push({
      flow: { from: packageRoot, to: workspaceRoot },
      sourcePath: packageRoot,
      error: error as Error,
      message: `Installation failed: ${(error as Error).message}`
    });
    return result;
  }
}

/**
 * Execute flows for multiple packages with priority-based merging
 * 
 * Installs multiple packages in priority order (lower priority first).
 * Detects conflicts when multiple packages write to the same file.
 * 
 * @param packages - Array of packages to install
 * @param workspaceRoot - Workspace root directory
 * @param platform - Target platform
 * @param options - Installation options
 * @returns Aggregated installation result
 */
export async function installPackagesWithFlows(
  packages: Array<{
    packageName: string;
    packageRoot: string;
    packageVersion: string;
    priority: number;
  }>,
  workspaceRoot: string,
  platform: Platform,
  options?: InstallOptions
): Promise<FlowInstallResult> {
  const aggregatedResult: FlowInstallResult = {
    success: true,
    filesProcessed: 0,
    filesWritten: 0,
    conflicts: [],
    errors: [],
    targetPaths: [],
    fileMapping: {}
  };
  
  const dryRun = options?.dryRun ?? false;
  
  // Sort packages by priority (LOWER priority first, so higher priority writes last and wins)
  const sortedPackages = [...packages].sort((a, b) => a.priority - b.priority);
  
  // Track files written by each package for conflict detection
  const fileTargets = new Map<string, Array<{ packageName: string; priority: number }>>();
  
  // Install each package
  for (const pkg of sortedPackages) {
    // Detect package format and create conversion context using shared utility
    const { format, context: conversionContext } = 
      await detectFormatWithContextFromDirectory(pkg.packageRoot);
    
    const installContext: FlowInstallContext = {
      packageName: pkg.packageName,
      packageRoot: pkg.packageRoot,
      workspaceRoot,
      platform,
      packageVersion: pkg.packageVersion,
      priority: pkg.priority,
      dryRun,
      packageFormat: format,
      conversionContext
    };
    
    // Get flows and track conflicts using shared utility
    const flows = getApplicableFlows(platform, workspaceRoot);
    const flowContext: FlowContext = {
      workspaceRoot,
      packageRoot: pkg.packageRoot,
      platform,
      packageName: pkg.packageName,
      direction: 'install',
      variables: {
        name: pkg.packageName,
        version: pkg.packageVersion,
        priority: pkg.priority,
        targetRoot: workspaceRoot
      },
      dryRun
    };
    
    // Track target files for conflict detection
    await trackTargetFiles(
      fileTargets,
      pkg.packageName,
      pkg.priority,
      pkg.packageRoot,
      flows,
      flowContext
    );
    
    const result = await installPackageWithFlows(installContext, options);
    
    // Aggregate results using shared utility
    aggregateFlowResults(aggregatedResult, result);
  }
  
  // Generate conflict reports using shared utility
  const detectedConflicts = generateConflictReports(fileTargets);
  aggregatedResult.conflicts.push(...detectedConflicts);
  
  return aggregatedResult;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a file should be processed with flows
 */
export function shouldUseFlows(platform: Platform, cwd: string): boolean {
  return platformUsesFlows(platform, cwd);
}

/**
 * Get flow statistics for reporting
 */
export function getFlowStatistics(result: FlowInstallResult): {
  total: number;
  written: number;
  conflicts: number;
  errors: number;
} {
  return {
    total: result.filesProcessed,
    written: result.filesWritten,
    conflicts: result.conflicts.length,
    errors: result.errors.length
  };
}
