import type { InstallationContext } from '../context.js';
import { resolveDependenciesForInstall } from '../../install-flow.js';
import { pullMissingDependenciesIfNeeded } from '../../remote-flow.js';
import { addWarning, addError } from '../context-helpers.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Resolve dependencies phase
 */
export async function resolveDependenciesPhase(ctx: InstallationContext): Promise<void> {
  logger.debug(`Resolving dependencies for ${ctx.source.packageName}`);
  
  try {
    // Initial dependency resolution
    const result = await resolveDependenciesForInstall(
      ctx.source.packageName,
      ctx.cwd,
      ctx.source.version,
      ctx.options
    );
    
    // Add warnings
    result.warnings?.forEach(w => addWarning(ctx, w));
    
    // Update context
    ctx.resolvedPackages = result.resolvedPackages;
    let missingPackages = result.missingPackages;
    
    // Pull missing dependencies if needed
    if (missingPackages.length > 0 && ctx.options.resolutionMode !== 'local-only') {
      const pullResult = await pullMissingDependenciesIfNeeded({
        missingPackages,
        resolvedPackages: ctx.resolvedPackages,
        remoteOutcomes: result.remoteOutcomes || {},
        warnedPackages: new Set(),
        dryRun: ctx.options.dryRun || false,
        profile: ctx.options.profile,
        apiKey: ctx.options.apiKey
      });
      
      pullResult.warnings.forEach(w => addWarning(ctx, w));
      
      // Re-resolve if we pulled anything
      if (pullResult.pulledAny) {
        const refreshed = await resolveDependenciesForInstall(
          ctx.source.packageName,
          ctx.cwd,
          ctx.source.version,
          ctx.options
        );
        
        ctx.resolvedPackages = refreshed.resolvedPackages;
        missingPackages = refreshed.missingPackages;
      }
    }
    
    // Warn about remaining missing packages
    if (missingPackages.length > 0) {
      const warning = `Missing packages: ${Array.from(new Set(missingPackages)).join(', ')}`;
      addWarning(ctx, warning);
    }
    
    logger.info(`Resolved ${ctx.resolvedPackages.length} packages`);
    
  } catch (error) {
    const errorMsg = `Failed to resolve dependencies: ${error}`;
    addError(ctx, errorMsg);
    throw new Error(errorMsg);
  }
}
