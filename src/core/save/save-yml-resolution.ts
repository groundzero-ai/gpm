/**
 * Save YAML Frontmatter Resolution
 * Handles merging platform-specific frontmatter from workspace into universal files
 * with inline platform override blocks inside the universal markdown frontmatter.
 */

import { join } from 'path';
import { FILE_PATTERNS } from '../../constants/index.js';
import { exists, readTextFile, writeTextFile } from '../../utils/fs.js';
import { SaveCandidate } from './save-types.js';
import {
  splitFrontmatter,
  deepEqualYaml,
  subtractKeys,
  cloneYaml,
  composeMarkdown,
  normalizeFrontmatter,
  isPlainObject
} from '../../utils/markdown-frontmatter.js';
import { UTF8_ENCODING } from './constants.js';
import type { Platform } from '../platforms.js';
import type { SaveCandidateGroup } from './save-types.js';

// Re-export for backward compatibility
export type { SaveCandidateGroup };

interface WorkspaceFrontmatterEntry {
  platform: Platform;
  candidate: SaveCandidate;
  frontmatter: Record<string, any>;
  markdownBody: string;
}

export interface FrontmatterMergePlan {
  registryPath: string;
  workspaceEntries: WorkspaceFrontmatterEntry[];
  sharedFrontmatter: Record<string, any>;
  platformDiffs: Map<Platform, any>;
}


/**
 * Build frontmatter merge plans for all markdown files with platform-specific variants.
 * Uses the local universal frontmatter as the source of truth.
 */
export async function buildFrontmatterMergePlans(
  packageDir: string,
  groups: SaveCandidateGroup[]
): Promise<FrontmatterMergePlan[]> {
  const plans: FrontmatterMergePlan[] = [];

  for (const group of groups) {
    if (!group.registryPath.endsWith(FILE_PATTERNS.MD_FILES)) {
      continue;
    }

    // Only create merge plans for files that exist locally for this package
    // This prevents creating overrides for workspace-only files from other packages
    if (!group.local) {
      continue;
    }

    const universalPath = group.local.fullPath ?? join(packageDir, group.registryPath);
    if (!(await exists(universalPath))) {
      continue;
    }

    const platformMap = new Map<Platform, SaveCandidate>();
    for (const candidate of group.workspace) {
      if (!candidate.isMarkdown) continue;
      if (!candidate.platform || candidate.platform === 'ai') continue;

      const existing = platformMap.get(candidate.platform);
      if (!existing || candidate.mtime > existing.mtime) {
        platformMap.set(candidate.platform, candidate);
      }
    }

    if (platformMap.size === 0) {
      continue;
    }

    const workspaceEntries: WorkspaceFrontmatterEntry[] = [];
    for (const [platform, candidate] of platformMap.entries()) {
      const normalizedFrontmatter = normalizeFrontmatter(candidate.frontmatter);
      const markdownBody = candidate.markdownBody ?? candidate.content;
      workspaceEntries.push({
        platform,
        candidate,
        frontmatter: normalizedFrontmatter,
        markdownBody
      });
    }

    const sharedFrontmatter = computeSharedFrontmatter(workspaceEntries) ?? {};
    const platformDiffs = new Map<Platform, any>();

    for (const entry of workspaceEntries) {
      const base = cloneYaml(entry.frontmatter);
      const override = subtractKeys(base, sharedFrontmatter);
      const normalizedOverride =
        override && (!isPlainObject(override) || Object.keys(override).length > 0)
          ? override
          : undefined;
      platformDiffs.set(entry.platform, normalizedOverride);
    }

    plans.push({
      registryPath: group.registryPath,
      workspaceEntries,
      sharedFrontmatter,
      platformDiffs
    });
  }

  return plans;
}

/**
 * Compute shared frontmatter keys that are identical across all workspace entries.
 */
function computeSharedFrontmatter(entries: WorkspaceFrontmatterEntry[]): Record<string, any> | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  let shared: Record<string, any> | undefined = cloneYaml(entries[0].frontmatter);

  for (let i = 1; i < entries.length; i += 1) {
    if (!shared) {
      break;
    }
    shared = intersectFrontmatter(shared, entries[i].frontmatter);
  }

  if (!shared || Object.keys(shared).length === 0) {
    return undefined;
  }

  return shared;
}

/**
 * Intersect two frontmatter objects, keeping only keys with matching values.
 */
function intersectFrontmatter(
  base: Record<string, any>,
  other: Record<string, any>
): Record<string, any> | undefined {
  const result: Record<string, any> = {};

  for (const key of Object.keys(base)) {
    if (!Object.prototype.hasOwnProperty.call(other, key)) {
      continue;
    }

    const baseValue = base[key];
    const otherValue = other[key];

    if (isPlainObject(baseValue) && isPlainObject(otherValue)) {
      const nested = intersectFrontmatter(baseValue, otherValue);
      if (nested && Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      continue;
    }

    if (Array.isArray(baseValue) && Array.isArray(otherValue)) {
      if (deepEqualYaml(baseValue, otherValue)) {
        result[key] = cloneYaml(baseValue);
      }
      continue;
    }

    if (deepEqualYaml(baseValue, otherValue)) {
      result[key] = cloneYaml(baseValue);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Apply frontmatter merge plans: update universal files with inline platform blocks.
 */
export async function applyFrontmatterMergePlans(
  packageDir: string,
  plans: FrontmatterMergePlan[]
): Promise<void> {
  for (const plan of plans) {
      await updateUniversalMarkdown(packageDir, plan);
  }
}

/**
 * Update the universal markdown file with computed universal frontmatter.
 */
async function updateUniversalMarkdown(
  packageDir: string,
  plan: FrontmatterMergePlan
): Promise<void> {
  const universalPath = join(packageDir, plan.registryPath);

  if (!(await exists(universalPath))) {
    return;
  }

  const originalContent = await readTextFile(universalPath);
  const split = splitFrontmatter(originalContent);
  const inlineFrontmatter = buildInlineFrontmatter(plan.sharedFrontmatter, plan.platformDiffs);
  const updatedContent = composeMarkdown(inlineFrontmatter, split.body);

  if (updatedContent !== originalContent) {
    await writeTextFile(universalPath, updatedContent, UTF8_ENCODING);
  }
}

function buildInlineFrontmatter(
  shared: Record<string, any>,
  platformDiffs: Map<Platform, any>
): Record<string, any> {
  // Use shallow copy for base since we only add the openpackage key
  // shared is already a computed result safe for reuse here
  const base: Record<string, any> = { ...shared };
  const overrides: Record<string, any> = {};

  for (const [platform, diff] of platformDiffs.entries()) {
    if (diff !== undefined) {
      // Diff is already a fresh object from subtractKeys
      overrides[platform] = diff;
    }
  }

  if (Object.keys(overrides).length > 0) {
    base.openpackage = overrides;
  }

  return base;
}

