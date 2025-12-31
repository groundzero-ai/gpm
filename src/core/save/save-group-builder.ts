import type { SaveCandidate, SaveCandidateGroup } from './save-types.js';

/**
 * Core responsibility: Build candidate groups from local and workspace candidates
 * Input: Local and workspace candidates
 * Output: Groups organized by registry path
 */

/**
 * Build candidate groups from local and workspace candidates
 * 
 * Groups candidates by registry path, associating:
 * - One optional local (source) candidate
 * - Zero or more workspace candidates
 */
export function buildCandidateGroups(
  localCandidates: SaveCandidate[],
  workspaceCandidates: SaveCandidate[]
): SaveCandidateGroup[] {
  const map = new Map<string, SaveCandidateGroup>();
  
  // Add local candidates
  for (const candidate of localCandidates) {
    const group = ensureGroup(map, candidate.registryPath);
    group.local = candidate;
  }
  
  // Add workspace candidates
  for (const candidate of workspaceCandidates) {
    const group = ensureGroup(map, candidate.registryPath);
    group.workspace.push(candidate);
  }
  
  return Array.from(map.values());
}

/**
 * Filter groups to only those with workspace candidates
 * 
 * Since save is workspace → source, we only care about groups
 * that have workspace candidates to save.
 */
export function filterGroupsWithWorkspace(
  groups: SaveCandidateGroup[]
): SaveCandidateGroup[] {
  return groups.filter(group => group.workspace.length > 0);
}

/**
 * Ensure a group exists for the given registry path
 * 
 * Helper function to get or create a group in the map.
 */
function ensureGroup(
  map: Map<string, SaveCandidateGroup>,
  registryPath: string
): SaveCandidateGroup {
  let group = map.get(registryPath);
  if (!group) {
    group = {
      registryPath,
      workspace: []
    };
    map.set(registryPath, group);
  }
  return group;
}
