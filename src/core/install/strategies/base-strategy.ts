/**
 * Base Strategy Module
 * 
 * Abstract base class providing shared functionality for installation strategies.
 */

import type { Platform } from '../../platforms.js';
import type { FlowContext } from '../../../types/flows.js';
import type { PackageFormat } from '../format-detector.js';
import type { InstallationStrategy, FlowInstallContext, FlowInstallResult } from './types.js';
import type { InstallOptions } from '../../../types/index.js';
import { getPlatformDefinition, deriveRootDirFromFlows } from '../../platforms.js';
import { logger } from '../../../utils/logger.js';
import { toTildePath } from '../../../utils/path-resolution.js';
import { createEmptyResult } from './helpers/result-converter.js';
import { getApplicableFlows } from './helpers/flow-helpers.js';

/**
 * Abstract base class for installation strategies
 */
export abstract class BaseStrategy implements InstallationStrategy {
  abstract readonly name: string;
  
  abstract canHandle(format: PackageFormat, platform: Platform): boolean;
  
  abstract install(
    context: FlowInstallContext,
    options?: InstallOptions
  ): Promise<FlowInstallResult>;
  
  /**
   * Create an empty result object
   */
  protected createEmptyResult(): FlowInstallResult {
    return createEmptyResult();
  }
  
  /**
   * Get applicable flows for a platform (global + platform-specific)
   */
  protected getApplicableFlows(platform: Platform, cwd: string) {
    return getApplicableFlows(platform, cwd);
  }
  
  /**
   * Build flow context with standard variables
   */
  protected buildFlowContext(
    context: FlowInstallContext,
    direction: 'install' | 'save' = 'install'
  ): FlowContext {
    const platformDef = getPlatformDefinition(context.platform, context.workspaceRoot);
    
    return {
      workspaceRoot: context.workspaceRoot,
      packageRoot: context.packageRoot,
      platform: context.platform,
      packageName: context.packageName,
      direction,
      variables: {
        name: context.packageName,
        version: context.packageVersion,
        priority: context.priority,
        rootFile: platformDef.rootFile,
        rootDir: deriveRootDirFromFlows(platformDef),
        // Context variables for conditional flows
        platform: context.platform,
        source: context.packageFormat?.sourcePlatform || 'openpackage'
      },
      dryRun: context.dryRun
    };
  }
  
  /**
   * Log strategy selection for debugging
   */
  protected logStrategySelection(context: FlowInstallContext): void {
    logger.debug(`Selected installation strategy: ${this.name}`, {
      package: context.packageName,
      platform: context.platform,
      formatType: context.packageFormat?.type,
      formatPlatform: context.packageFormat?.platform
    });
  }
  
  /**
   * Log installation results
   */
  protected logResults(result: FlowInstallResult, context: FlowInstallContext): void {
    if (result.filesProcessed > 0) {
      logger.info(
        `Processed ${result.filesProcessed} files for ${context.packageName} on platform ${context.platform}` +
        (context.dryRun ? ' (dry run)' : `, wrote ${result.filesWritten} files`)
      );
    }
    
    this.logConflicts(result);
    this.logErrors(result);
  }
  
  /**
   * Log conflicts detected during installation
   */
  protected logConflicts(result: FlowInstallResult): void {
    if (result.conflicts.length > 0) {
      logger.warn(`Detected ${result.conflicts.length} conflicts during installation`);
      for (const conflict of result.conflicts) {
        const winner = conflict.packages.find(p => p.chosen);
        const loser = conflict.packages.find(p => !p.chosen);
        logger.warn(
          `  ${toTildePath(conflict.targetPath)}: ${winner?.packageName} (priority ${winner?.priority}) overwrites ${loser?.packageName}`
        );
      }
    }
  }
  
  /**
   * Log errors encountered during installation
   */
  protected logErrors(result: FlowInstallResult): void {
    if (result.errors.length > 0) {
      logger.error(`Encountered ${result.errors.length} errors during installation`);
      for (const error of result.errors) {
        logger.error(`  ${error.sourcePath}: ${error.message}`);
      }
    }
  }
  
  /**
   * Create an error result
   */
  protected createErrorResult(
    context: FlowInstallContext,
    error: Error,
    message: string
  ): FlowInstallResult {
    return {
      success: false,
      filesProcessed: 0,
      filesWritten: 0,
      conflicts: [],
      errors: [{
        flow: { from: context.packageRoot, to: context.workspaceRoot },
        sourcePath: context.packageRoot,
        error,
        message
      }],
      targetPaths: [],
      fileMapping: {}
    };
  }
}
