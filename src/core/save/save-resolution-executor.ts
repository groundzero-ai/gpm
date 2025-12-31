import { logger } from '../../utils/logger.js';
import type { ConflictAnalysis } from './save-conflict-analyzer.js';
import { getNewestCandidate, sortCandidatesByMtime } from './save-conflict-analyzer.js';
import { resolveInteractively } from './save-interactive-resolver.js';
import type { SaveCandidate, SaveCandidateGroup, ResolutionResult, ResolutionStrategy } from './save-types.js';

/**
 * Core responsibility: Execute resolution strategy and return results
 * Input: Analysis + candidates
 * Output: Resolution result (selection + platform-specific)
 */

/**
 * Execute resolution for a group based on analysis
 * 
 * This is the main entry point for resolution execution.
 * It delegates to specific resolution functions based on strategy.
 */
export async function executeResolution(
  group: SaveCandidateGroup,
  analysis: ConflictAnalysis,
  packageRoot: string
): Promise<ResolutionResult | null> {
  const strategy = analysis.recommendedStrategy;
  
  // Skip if no action needed
  if (strategy === 'skip') {
    return null;
  }
  
  // Sort candidates by mtime for consistent ordering
  const sortedCandidates = sortCandidatesByMtime(analysis.uniqueWorkspaceCandidates);
  
  switch (strategy) {
    case 'write-single':
      return resolveSingle(sortedCandidates[0]);
    
    case 'write-newest':
      return resolveIdentical(sortedCandidates);
    
    case 'force-newest':
      return resolveForce(sortedCandidates, group.registryPath);
    
    case 'interactive':
      return resolveInteractive(
        group.registryPath,
        sortedCandidates,
        analysis.isRootFile,
        group,
        packageRoot
      );
    
    default:
      logger.warn(`Unknown resolution strategy: ${strategy}`);
      return null;
  }
}

/**
 * Auto-resolve: single candidate
 * 
 * Only one workspace candidate exists - use it.
 */
function resolveSingle(
  candidate: SaveCandidate
): ResolutionResult {
  return {
    selection: candidate,
    platformSpecific: [],
    strategy: 'write-single',
    wasInteractive: false
  };
}

/**
 * Auto-resolve: multiple identical candidates (pick newest)
 * 
 * All workspace candidates have identical content.
 * Pick the newest one by mtime.
 */
function resolveIdentical(
  candidates: SaveCandidate[]
): ResolutionResult {
  const newest = getNewestCandidate(candidates);
  
  return {
    selection: newest,
    platformSpecific: [],
    strategy: 'write-newest',
    wasInteractive: false
  };
}

/**
 * Force-resolve: pick newest without prompting
 * 
 * Multiple differing candidates, but --force flag is set.
 * Auto-select the newest by mtime without user interaction.
 * 
 * Handles tie-breaking: if multiple files have the same mtime,
 * selects first alphabetically by displayPath.
 */
function resolveForce(
  candidates: SaveCandidate[],
  registryPath: string
): ResolutionResult {
  const newest = getNewestCandidate(candidates);
  
  // Check if there are ties (multiple with same mtime as newest)
  const maxMtime = newest.mtime;
  const tiedCandidates = candidates.filter(c => c.mtime === maxMtime);
  
  if (tiedCandidates.length > 1) {
    // Tie situation - log detailed explanation
    logger.info(
      `Force mode: Multiple files have same modification time (${formatTimestamp(maxMtime)})`
    );
    logger.info(`  Auto-selecting first alphabetically: ${newest.displayPath}`);
    logger.info('  Tied files:');
    tiedCandidates.forEach(c => {
      const marker = c === newest ? '→' : ' ';
      logger.info(`    ${marker} ${c.displayPath}`);
    });
    
    // Log skipped tied files
    const skippedTied = tiedCandidates.filter(c => c !== newest);
    skippedTied.forEach(c => {
      logger.info(`  Skipping: ${c.displayPath} (tied, not alphabetically first)`);
    });
    
    // Log older files
    const olderFiles = candidates.filter(c => c.mtime < maxMtime);
    olderFiles.forEach(c => {
      logger.info(`  Skipping: ${c.displayPath} (older)`);
    });
  } else {
    // Clear winner - simple logging
    logger.info(`Force mode: Auto-selecting newest (${newest.displayPath})`);
    
    // Log what we're skipping
    const skipped = candidates.filter(c => c !== newest);
    if (skipped.length > 0) {
      skipped.forEach(c => {
        logger.info(`  Skipping: ${c.displayPath} (older)`);
      });
    }
  }
  
  return {
    selection: newest,
    platformSpecific: [], // Force mode doesn't auto-create platform-specific
    strategy: 'force-newest',
    wasInteractive: false
  };
}

/**
 * Interactive resolve: prompt user
 * 
 * Multiple differing candidates require user input.
 * Delegates to interactive resolver for UI flow.
 */
async function resolveInteractive(
  registryPath: string,
  candidates: SaveCandidate[],
  isRootFile: boolean,
  group: SaveCandidateGroup,
  packageRoot: string
): Promise<ResolutionResult> {
  const result = await resolveInteractively({
    registryPath,
    workspaceCandidates: candidates,
    isRootFile,
    group,
    packageRoot
  });
  
  return {
    selection: result.selectedCandidate,
    platformSpecific: result.platformSpecificCandidates,
    strategy: 'interactive',
    wasInteractive: true
  };
}

/**
 * Format timestamp for human-readable display
 */
function formatTimestamp(mtime: number): string {
  const date = new Date(mtime);
  return date.toLocaleString();
}
