import type { InstallationContext } from '../context.js';
import { performIndexBasedInstallationPhases } from '../../install-flow.js';
import { displayDependencyTree } from '../../../dependency-resolver.js';
import { resolvePlatforms } from '../../platform-resolution.js';
import { logger } from '../../../../utils/logger.js';

export interface ExecutionResult {
  installedCount: number;
  skippedCount: number;
  errorCount: number;
  allAddedFiles: string[];
  allUpdatedFiles: string[];
  rootFileResults: { installed: string[]; updated: string[]; skipped: string[] };
  hadErrors: boolean;
  installedAnyFiles: boolean;
  errors?: string[];
}

/**
 * Execute installation phase
 */
export async function executeInstallationPhase(
  ctx: InstallationContext
): Promise<ExecutionResult> {
  logger.debug(`Executing installation for ${ctx.resolvedPackages.length} packages`);
  
  // Display dependency tree
  displayDependencyTree(ctx.resolvedPackages, true);
  
  // Resolve platforms if not already set
  if (ctx.platforms.length === 0) {
    const canPrompt = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    ctx.platforms = await resolvePlatforms(
      ctx.cwd,
      ctx.options.platforms,
      { interactive: canPrompt }
    );
  }
  
  // Get conflict result from context
  const conflictResult = (ctx as any).conflictResult;
  
  // Execute installation
  const outcome = await performIndexBasedInstallationPhases({
    cwd: ctx.cwd,
    packages: ctx.resolvedPackages,
    platforms: ctx.platforms,
    conflictResult,
    options: ctx.options,
    targetDir: ctx.targetDir
  });
  
  // Track errors in context
  outcome.errors?.forEach(e => ctx.errors.push(e));
  
  const hadErrors = outcome.errorCount > 0;
  const installedAnyFiles =
    outcome.allAddedFiles.length > 0 ||
    outcome.allUpdatedFiles.length > 0 ||
    outcome.rootFileResults.installed.length > 0 ||
    outcome.rootFileResults.updated.length > 0;
  
  return {
    ...outcome,
    hadErrors,
    installedAnyFiles,
    errors: outcome.errors
  };
}
