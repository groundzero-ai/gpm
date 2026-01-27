import type { InstallationContext } from '../context.js';
import { processConflictResolution } from '../../install-flow.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Process conflicts phase
 * @returns true if should proceed, false if cancelled
 */
export async function processConflictsPhase(ctx: InstallationContext): Promise<boolean> {
  logger.debug(`Processing conflicts for ${ctx.resolvedPackages.length} packages`);
  
  const result = await processConflictResolution(ctx.resolvedPackages, ctx.options);
  
  if ('cancelled' in result) {
    return false;
  }
  
  // Update resolved packages based on conflict resolution
  ctx.resolvedPackages = result.finalResolvedPackages;
  
  // Store conflict result in context for later use
  (ctx as any).conflictResult = result.conflictResult;
  
  return true;
}
