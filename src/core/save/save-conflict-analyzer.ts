import { FILE_PATTERNS } from '../../constants/index.js';
import type { SaveCandidate, SaveCandidateGroup, ResolutionStrategy } from './save-types.js';

/**
 * Core responsibility: Classify groups and determine what action is needed
 * Input: Candidate groups
 * Output: Analysis results with recommended strategy
 */

export type ConflictAnalysisType = 
  | 'no-action-needed'      // No workspace candidates
  | 'no-change-needed'      // Workspace matches source
  | 'auto-write'            // Single or identical workspace candidates
  | 'needs-resolution';     // Multiple differing workspace candidates

export interface ConflictAnalysis {
  registryPath: string;
  type: ConflictAnalysisType;
  workspaceCandidateCount: number;
  uniqueWorkspaceCandidates: SaveCandidate[];
  hasLocalCandidate: boolean;
  localMatchesWorkspace: boolean;
  isRootFile: boolean;
  hasPlatformCandidates: boolean;
  recommendedStrategy: ResolutionStrategy;
}

/**
 * Analyze a candidate group and determine resolution strategy
 * 
 * This function examines the workspace candidates and determines:
 * - Whether any action is needed
 * - What type of conflict exists (if any)
 * - What resolution strategy to use
 */
export function analyzeGroup(
  group: SaveCandidateGroup,
  force: boolean
): ConflictAnalysis {
  const registryPath = group.registryPath;
  const hasLocal = !!group.local;
  const workspaceCandidates = group.workspace;
  const workspaceCandidateCount = workspaceCandidates.length;
  
  // Check if this is a root file (AGENTS.md or similar)
  const isRootFile = 
    registryPath === FILE_PATTERNS.AGENTS_MD ||
    workspaceCandidates.some(c => c.isRootFile);
  
  // Check if any candidates are platform-specific
  const hasPlatformCandidates = workspaceCandidates.some(
    c => c.platform && c.platform !== 'ai'
  );
  
  // No workspace candidates - nothing to save
  if (workspaceCandidateCount === 0) {
    return {
      registryPath,
      type: 'no-action-needed',
      workspaceCandidateCount: 0,
      uniqueWorkspaceCandidates: [],
      hasLocalCandidate: hasLocal,
      localMatchesWorkspace: false,
      isRootFile,
      hasPlatformCandidates: false,
      recommendedStrategy: 'skip'
    };
  }
  
  // Deduplicate workspace candidates by content hash
  const uniqueWorkspace = deduplicateCandidates(workspaceCandidates);
  
  // Check if workspace content differs from local
  const localMatchesWorkspace = hasLocal && uniqueWorkspace.length === 1 
    ? uniqueWorkspace[0].contentHash === group.local!.contentHash
    : false;
  
  // No change needed - workspace identical to source
  if (localMatchesWorkspace) {
    return {
      registryPath,
      type: 'no-change-needed',
      workspaceCandidateCount,
      uniqueWorkspaceCandidates: uniqueWorkspace,
      hasLocalCandidate: hasLocal,
      localMatchesWorkspace: true,
      isRootFile,
      hasPlatformCandidates,
      recommendedStrategy: 'skip'
    };
  }
  
  // Single workspace candidate or all identical - auto write
  if (uniqueWorkspace.length === 1) {
    return {
      registryPath,
      type: 'auto-write',
      workspaceCandidateCount,
      uniqueWorkspaceCandidates: uniqueWorkspace,
      hasLocalCandidate: hasLocal,
      localMatchesWorkspace: false,
      isRootFile,
      hasPlatformCandidates,
      recommendedStrategy: 'write-single'
    };
  }
  
  // Multiple differing workspace candidates - needs resolution
  // Strategy depends on force flag
  const recommendedStrategy: ResolutionStrategy = force ? 'force-newest' : 'interactive';
  
  return {
    registryPath,
    type: 'needs-resolution',
    workspaceCandidateCount,
    uniqueWorkspaceCandidates: uniqueWorkspace,
    hasLocalCandidate: hasLocal,
    localMatchesWorkspace: false,
    isRootFile,
    hasPlatformCandidates,
    recommendedStrategy
  };
}

/**
 * Deduplicate candidates by content hash
 * 
 * Returns only candidates with unique content, preserving order.
 * First occurrence of each unique hash is kept.
 */
export function deduplicateCandidates(
  candidates: SaveCandidate[]
): SaveCandidate[] {
  const seen = new Set<string>();
  const unique: SaveCandidate[] = [];
  
  for (const candidate of candidates) {
    if (seen.has(candidate.contentHash)) {
      continue;
    }
    seen.add(candidate.contentHash);
    unique.push(candidate);
  }
  
  return unique;
}

/**
 * Check if workspace content differs from local
 * 
 * Returns true if any workspace candidate has different content than local.
 */
export function hasContentDifference(
  local: SaveCandidate | undefined,
  workspace: SaveCandidate[]
): boolean {
  if (!local) return true; // No local means creation, which is a difference
  if (workspace.length === 0) return false; // No workspace means no change
  
  // Check if any workspace candidate differs from local
  return workspace.some(w => w.contentHash !== local.contentHash);
}

/**
 * Get newest candidate by mtime
 * 
 * Returns the candidate with the most recent modification time.
 * If multiple have the same mtime, returns the first one.
 */
export function getNewestCandidate(
  candidates: SaveCandidate[]
): SaveCandidate {
  if (candidates.length === 0) {
    throw new Error('Cannot get newest candidate from empty array');
  }
  
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  let newest = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].mtime > newest.mtime) {
      newest = candidates[i];
    }
  }
  
  return newest;
}

/**
 * Sort candidates by mtime (newest first) and display path
 * 
 * Used to establish a consistent ordering for conflict resolution.
 */
export function sortCandidatesByMtime(
  candidates: SaveCandidate[]
): SaveCandidate[] {
  return [...candidates].sort((a, b) => {
    // Sort by mtime descending (newest first)
    if (b.mtime !== a.mtime) {
      return b.mtime - a.mtime;
    }
    // Tie-breaker: sort by display path alphabetically
    return a.displayPath.localeCompare(b.displayPath);
  });
}
