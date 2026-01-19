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
import { createEmptyResult } from './helpers/result-converter.js';
import { getApplicableFlows } from './helpers/flow-helpers.js';
import { logInstallationResult } from '../helpers/result-logging.js';

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
   * 
   * Uses conversion context as the single source of truth for format identity.
   */
  protected buildFlowContext(
    context: FlowInstallContext,
    direction: 'install' | 'save' = 'install'
  ): FlowContext {
    const platformDef = getPlatformDefinition(context.platform, context.workspaceRoot);
    
    // Use conversion context as single source of truth for original format
    const originalSource = context.conversionContext.originalFormat.platform || 'openpackage';
    
    logger.debug('Building flow context', {
      originalSource,
      targetPlatform: context.platform,
      conversions: context.conversionContext.conversionHistory.length
    });
    
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
        platform: context.platform,  // Target platform
        targetPlatform: context.platform,  // Explicit target platform
        source: originalSource,  // Original source format (from conversion context)
        sourcePlatform: originalSource,  // Explicit source platform
        // Path variable for conditional installation behavior
        targetRoot: context.workspaceRoot
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
   * Log installation results using shared utility
   */
  protected logResults(result: FlowInstallResult, context: FlowInstallContext): void {
    logInstallationResult(
      result,
      context.packageName,
      context.platform,
      context.dryRun ?? false
    );
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
