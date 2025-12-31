import { join } from 'path';
import { exists } from '../../utils/fs.js';
import { createPlatformSpecificRegistryPath } from '../../utils/platform-specific-paths.js';
import { logger } from '../../utils/logger.js';
import type { SaveCandidate, SaveCandidateGroup } from './save-types.js';

/**
 * Core responsibility: Platform-specific candidate management
 * Input: Candidates
 * Output: Pruning platform-specific candidates when they already exist in source
 */

/**
 * Prune workspace candidates that have existing platform files
 * 
 * This function removes workspace candidates from groups when a
 * platform-specific file already exists in the source. This prevents
 * overwriting existing platform-specific files with universal content.
 * 
 * Mutates the groups in place.
 */
export async function pruneExistingPlatformCandidates(
  packageRoot: string,
  groups: SaveCandidateGroup[]
): Promise<void> {
  for (const group of groups) {
    if (!group.local) {
      // No local file means no platform files could exist yet
      continue;
    }
    
    const filtered: SaveCandidate[] = [];
    
    for (const candidate of group.workspace) {
      const platform = candidate.platform;
      
      // Keep non-platform candidates
      if (!platform || platform === 'ai') {
        filtered.push(candidate);
        continue;
      }
      
      // Check if platform-specific file exists
      const platformPath = createPlatformSpecificRegistryPath(group.registryPath, platform);
      if (!platformPath) {
        filtered.push(candidate);
        continue;
      }
      
      const platformFullPath = join(packageRoot, platformPath);
      const hasPlatformFile = await exists(platformFullPath);
      
      if (hasPlatformFile) {
        // Platform-specific file exists - prune this candidate
        logger.debug(
          `Skipping workspace candidate ${candidate.displayPath} for ${group.registryPath} ` +
          `because local platform-specific file (${platformPath}) already exists`
        );
        continue;
      }
      
      // No existing platform file - keep candidate
      filtered.push(candidate);
    }
    
    group.workspace = filtered;
  }
}


