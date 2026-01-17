/**
 * Flow-Based Installer Module
 * 
 * Handles installation of package files using the declarative flow system.
 * Integrates with the existing install pipeline to execute flow transformations
 * for each package file, with multi-package composition and priority-based merging.
 * 
 * This module now serves as a thin orchestration layer, delegating to specialized
 * strategy implementations for different installation scenarios.
 */

import { join, relative } from 'path';
import type { Platform } from '../platforms.js';
import type { InstallOptions } from '../../types/index.js';
import { platformUsesFlows } from '../platforms.js';
import { logger } from '../../utils/logger.js';
import { toTildePath } from '../../utils/path-resolution.js';
import { detectPackageFormat } from './format-detector.js';
import { walkFiles } from '../../utils/file-walker.js';
import {
  selectInstallStrategy,
  type FlowInstallContext,
  type FlowInstallResult,
  type FlowConflictReport,
  type FlowInstallError
} from './strategies/index.js';
import { discoverFlowSources } from '../flows/flow-source-discovery.js';
import { resolvePattern } from '../flows/flow-source-discovery.js';
import { getGlobalExportFlows, getPlatformDefinition } from '../platforms.js';
import type { FlowContext } from '../../types/flows.js';

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
      await detectPackageFormatFromDirectory(packageRoot);
    
    logger.info('Package format determination', {
      providedFormat: installContext.packageFormat ? 'yes' : 'no',
      providedType: installContext.packageFormat?.type,
      providedPlatform: installContext.packageFormat?.platform,
      finalType: packageFormat.type,
      finalPlatform: packageFormat.platform
    });
    
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
    
    // Log results
    if (strategyResult.filesProcessed > 0) {
      logger.info(
        `Processed ${strategyResult.filesProcessed} files for ${packageName} on platform ${platform}` +
        (dryRun ? ' (dry run)' : `, wrote ${strategyResult.filesWritten} files`)
      );
    }
    
    // Log conflicts
    if (strategyResult.conflicts.length > 0) {
      logger.warn(`Detected ${strategyResult.conflicts.length} conflicts during installation`);
      for (const conflict of strategyResult.conflicts) {
        const winner = conflict.packages.find(p => p.chosen);
        logger.warn(
          `  ${toTildePath(conflict.targetPath)}: ${winner?.packageName} (priority ${winner?.priority}) overwrites ` +
          `${conflict.packages.find(p => !p.chosen)?.packageName}`
        );
      }
    }
    
    // Log errors
    if (strategyResult.errors.length > 0) {
      logger.error(`Encountered ${strategyResult.errors.length} errors during installation`);
      for (const error of strategyResult.errors) {
        logger.error(`  ${error.sourcePath}: ${error.message}`);
      }
    }
    
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
    const installContext: FlowInstallContext = {
      packageName: pkg.packageName,
      packageRoot: pkg.packageRoot,
      workspaceRoot,
      platform,
      packageVersion: pkg.packageVersion,
      priority: pkg.priority,
      dryRun
    };
    
    // Get flows and discover target files to track conflicts
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
    
    // Discover target paths for this package
    const flowSources = await discoverFlowSources(flows, pkg.packageRoot, flowContext);
    for (const [flow, sources] of flowSources) {
      if (sources.length > 0) {
        // Determine target path from flow
        const targetPath = typeof flow.to === 'string' 
          ? resolvePattern(flow.to, flowContext)
          : Object.keys(flow.to)[0];
        
        // Track this package writing to this target
        if (!fileTargets.has(targetPath)) {
          fileTargets.set(targetPath, []);
        }
        fileTargets.get(targetPath)!.push({
          packageName: pkg.packageName,
          priority: pkg.priority
        });
      }
    }
    
    const result = await installPackageWithFlows(installContext, options);
    
    // Aggregate results
    aggregatedResult.filesProcessed += result.filesProcessed;
    aggregatedResult.filesWritten += result.filesWritten;
    aggregatedResult.errors.push(...result.errors);
    aggregatedResult.targetPaths.push(...(result.targetPaths ?? []));
    
    // Merge file mappings
    for (const [source, targets] of Object.entries(result.fileMapping ?? {})) {
      const existing = aggregatedResult.fileMapping[source] ?? [];
      aggregatedResult.fileMapping[source] = Array.from(new Set([...existing, ...targets])).sort();
    }
    
    if (!result.success) {
      aggregatedResult.success = false;
    }
  }
  
  // Detect conflicts: files written by multiple packages
  for (const [targetPath, writers] of fileTargets) {
    if (writers.length > 1) {
      // Sort by priority to determine winner
      const sortedWriters = [...writers].sort((a, b) => b.priority - a.priority);
      const winner = sortedWriters[0];
      
      aggregatedResult.conflicts.push({
        targetPath,
        packages: sortedWriters.map((w, i) => ({
          packageName: w.packageName,
          priority: w.priority,
          chosen: i === 0
        })),
        message: `Conflict in ${targetPath}: ${winner.packageName} (priority ${winner.priority}) overwrites ${sortedWriters.slice(1).map(w => w.packageName).join(', ')}`
      });
    }
  }
  
  return aggregatedResult;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get applicable flows for a platform, including global flows
 */
function getApplicableFlows(platform: Platform, cwd: string) {
  const flows = [];
  
  const globalExportFlows = getGlobalExportFlows(cwd);
  if (globalExportFlows && globalExportFlows.length > 0) {
    flows.push(...globalExportFlows);
  }
  
  const definition = getPlatformDefinition(platform, cwd);
  if (definition.export && definition.export.length > 0) {
    flows.push(...definition.export);
  }
  
  return flows;
}

/**
 * Detect package format from directory by reading files
 */
async function detectPackageFormatFromDirectory(packageRoot: string) {
  const files: Array<{ path: string; content: string }> = [];
  
  try {
    for await (const fullPath of walkFiles(packageRoot)) {
      const relativePath = relative(packageRoot, fullPath);
      
      // Skip git metadata
      if (relativePath.startsWith('.git/') || relativePath === '.git') {
        continue;
      }
      
      files.push({
        path: relativePath,
        content: ''
      });
    }
  } catch (error) {
    logger.error('Failed to read package directory for format detection', { 
      packageRoot, 
      error 
    });
  }
  
  return detectPackageFormat(files);
}

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
