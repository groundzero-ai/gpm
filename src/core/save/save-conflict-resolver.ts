/**
 * DEPRECATED: This file is being phased out in favor of:
 * - save-conflict-analyzer.ts (analysis logic)
 * - save-resolution-executor.ts (execution logic)
 * - save-interactive-resolver.ts (UI logic)
 * - save-group-builder.ts (group building)
 * 
 * Kept for backward compatibility during migration.
 * Will be removed in future version.
 */

import { buildCandidateGroups } from './save-group-builder.js';
import { analyzeGroup } from './save-conflict-analyzer.js';
import { executeResolution } from './save-resolution-executor.js';
import { pruneExistingPlatformCandidates } from './save-platform-handler.js';

// Re-export for backward compatibility
export { buildCandidateGroups, pruneExistingPlatformCandidates };

/**
 * @deprecated Use analyzeGroup + executeResolution instead
 */
export async function resolveGroup(
  group: any,
  force: boolean,
  packageRoot?: string
): Promise<any> {
  const analysis = analyzeGroup(group, force);
  // For backward compatibility, use empty string if packageRoot not provided
  return executeResolution(group, analysis, packageRoot || '');
}

/**
 * @deprecated Use analyzeGroup + executeResolution instead
 */
export async function resolveRootGroup(
  group: any,
  force: boolean,
  packageRoot?: string
): Promise<any> {
  const analysis = analyzeGroup(group, force);
  // For backward compatibility, use empty string if packageRoot not provided
  return executeResolution(group, analysis, packageRoot || '');
}
