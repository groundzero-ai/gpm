import { join } from 'path';
import { safePrompts } from '../../utils/prompts.js';
import { sortCandidatesByMtime } from './save-conflict-analyzer.js';
import { logger } from '../../utils/logger.js';
import { exists, readTextFile } from '../../utils/fs.js';
import { calculateFileHash } from '../../utils/hash-utils.js';
import { createPlatformSpecificRegistryPath } from '../../utils/platform-specific-paths.js';
import type { SaveCandidate, SaveCandidateGroup } from './save-types.js';

/**
 * Core responsibility: Interactive user prompts for conflict resolution
 * 
 * Simplified single-step flow with parity checking:
 * 1. Check if candidates are already at parity (skip if so)
 * 2. For each remaining file (ordered by mtime), prompt for action
 * 3. After universal selected, auto-skip identical files
 * 4. Continue prompting for remaining differing files
 */

export interface InteractiveResolutionInput {
  registryPath: string;
  workspaceCandidates: SaveCandidate[];
  isRootFile: boolean;
  group: SaveCandidateGroup;
  packageRoot: string;
}

export interface InteractiveResolutionOutput {
  selectedCandidate: SaveCandidate | null;
  platformSpecificCandidates: SaveCandidate[];
}

export type CandidateAction = 'universal' | 'platform-specific' | 'skip';

interface ParityCheck {
  atParity: boolean;
  reason?: string;
}

/**
 * Run interactive resolution flow
 * 
 * Enhanced with parity checking to skip files that already match source.
 */
export async function resolveInteractively(
  input: InteractiveResolutionInput
): Promise<InteractiveResolutionOutput> {
  const { registryPath, workspaceCandidates, group, packageRoot } = input;
  
  // Sort by mtime descending (newest first), with alphabetical tie-breaker
  const sortedCandidates = sortCandidatesByMtime(workspaceCandidates);
  
  // Display header
  displayConflictHeader(registryPath, sortedCandidates);
  
  // Track selections
  let universalSelected: SaveCandidate | null = null;
  const platformSpecificCandidates: SaveCandidate[] = [];
  const skippedCandidates: SaveCandidate[] = [];
  
  // Iterate through each candidate
  for (const candidate of sortedCandidates) {
    // Check if candidate is already at parity with source
    const parityCheck = await isAtParity(candidate, group, packageRoot);
    if (parityCheck.atParity) {
      console.log(`\n  ✓ ${candidate.displayPath}`);
      console.log(`    ${parityCheck.reason} - auto-skipping\n`);
      skippedCandidates.push(candidate);
      continue;
    }
    
    // If universal already selected, check if this candidate is identical
    if (universalSelected && candidate.contentHash === universalSelected.contentHash) {
      console.log(`\n  ✓ ${candidate.displayPath}`);
      console.log(`    Identical to universal - auto-skipping\n`);
      skippedCandidates.push(candidate);
      continue;
    }
    
    // Prompt for action
    const action = await promptCandidateAction(
      candidate,
      registryPath,
      universalSelected !== null
    );
    
    // Handle action
    switch (action) {
      case 'universal':
        universalSelected = candidate;
        console.log(`\n  ✓ Selected as universal: ${candidate.displayPath}\n`);
        break;
      
      case 'platform-specific':
        platformSpecificCandidates.push(candidate);
        console.log(`\n  ✓ Marked as platform-specific: ${candidate.displayPath}\n`);
        break;
      
      case 'skip':
        skippedCandidates.push(candidate);
        console.log(`\n  ✓ Skipped: ${candidate.displayPath}\n`);
        break;
    }
  }
  
  // Display summary
  displayResolutionSummary(universalSelected, platformSpecificCandidates, skippedCandidates);
  
  return {
    selectedCandidate: universalSelected,
    platformSpecificCandidates
  };
}

/**
 * Check if candidate is already at parity with source
 * 
 * A candidate is at parity if it matches either:
 * 1. The universal source file (same content hash)
 * 2. Its corresponding platform-specific source file (if exists)
 * 
 * Returns true if no action is needed for this candidate.
 */
async function isAtParity(
  candidate: SaveCandidate,
  group: SaveCandidateGroup,
  packageRoot: string
): Promise<ParityCheck> {
  // Check universal parity
  if (group.local && candidate.contentHash === group.local.contentHash) {
    return {
      atParity: true,
      reason: 'Already matches universal'
    };
  }
  
  // Check platform-specific parity (if candidate has platform)
  if (candidate.platform && candidate.platform !== 'ai') {
    const platformPath = createPlatformSpecificRegistryPath(
      group.registryPath,
      candidate.platform
    );
    
    if (platformPath) {
      const platformFullPath = join(packageRoot, platformPath);
      
      // Check if platform-specific file exists
      if (await exists(platformFullPath)) {
        try {
          const platformContent = await readTextFile(platformFullPath);
          const platformHash = await calculateFileHash(platformContent);
          
          if (candidate.contentHash === platformHash) {
            return {
              atParity: true,
              reason: 'Already matches platform-specific file'
            };
          }
        } catch (error) {
          // If we can't read the platform file, treat as not at parity
          // This is safer - user will be prompted
          logger.debug(`Could not read platform file ${platformFullPath}: ${error}`);
        }
      }
    }
  }
  
  return { atParity: false };
}

/**
 * Prompt for action on a single candidate
 * 
 * Shows different options based on whether universal is already selected:
 * - Before universal: [Set as universal] [Mark as platform-specific] [Skip]
 * - After universal: [Mark as platform-specific] [Skip]
 */
async function promptCandidateAction(
  candidate: SaveCandidate,
  registryPath: string,
  universalAlreadySelected: boolean
): Promise<CandidateAction> {
  const candidateLabel = formatCandidateLabel(candidate, true);
  
  // Build options based on state
  const choices = universalAlreadySelected
    ? [
        { title: 'Mark as platform-specific', value: 'platform-specific' as const },
        { title: 'Skip', value: 'skip' as const }
      ]
    : [
        { title: 'Set as universal', value: 'universal' as const },
        { title: 'Mark as platform-specific', value: 'platform-specific' as const },
        { title: 'Skip', value: 'skip' as const }
      ];
  
  const response = await safePrompts({
    type: 'select',
    name: 'action',
    message: `  ${candidateLabel}\n  What should we do with this file?`,
    choices,
    hint: 'Arrow keys to navigate, Enter to select'
  });
  
  return response.action as CandidateAction;
}

/**
 * Display conflict resolution header
 */
function displayConflictHeader(
  registryPath: string,
  candidates: SaveCandidate[]
): void {
  console.log(`\n⚠️  Multiple workspace versions found for ${registryPath}`);
  console.log(`   Resolving conflicts for ${candidates.length} file(s)...\n`);
}

/**
 * Display resolution summary
 */
function displayResolutionSummary(
  universal: SaveCandidate | null,
  platformSpecific: SaveCandidate[],
  skipped: SaveCandidate[]
): void {
  console.log('─'.repeat(60));
  console.log('Resolution summary:');
  
  if (universal) {
    console.log(`  ✓ Universal: ${universal.displayPath}`);
  } else {
    console.log('  ℹ No universal content selected');
  }
  
  if (platformSpecific.length > 0) {
    console.log(`  ✓ Platform-specific: ${platformSpecific.length} file(s)`);
    platformSpecific.forEach(c => {
      const platform = c.platform ? `(${c.platform})` : '';
      console.log(`    • ${c.displayPath} ${platform}`);
    });
  }
  
  if (skipped.length > 0) {
    console.log(`  • Skipped: ${skipped.length} file(s)`);
  }
  
  console.log('─'.repeat(60) + '\n');
}

/**
 * Format candidate label for display
 * 
 * Shows: path, platform (if any), timestamp, and newest indicator
 */
function formatCandidateLabel(
  candidate: SaveCandidate,
  includeTimestamp: boolean = false
): string {
  const parts: string[] = [];
  
  // Path
  parts.push(candidate.displayPath);
  
  // Platform (if present)
  if (candidate.platform && candidate.platform !== 'ai') {
    parts.push(`(${candidate.platform})`);
  }
  
  // Timestamp
  if (includeTimestamp) {
    const date = new Date(candidate.mtime);
    const timestamp = date.toLocaleString();
    parts.push(`[${timestamp}]`);
  }
  
  return parts.join(' ');
}
