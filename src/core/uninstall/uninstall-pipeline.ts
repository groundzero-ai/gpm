import path from 'path';
import { readdir } from 'fs/promises';

import type { CommandResult, UninstallOptions } from '../../types/index.js';
import { ValidationError } from '../../utils/errors.js';
import { getLocalOpenPackageDir, getLocalPackageYmlPath } from '../../utils/paths.js';
import { readWorkspaceIndex, writeWorkspaceIndex } from '../../utils/workspace-index-yml.js';
import { removeWorkspaceIndexEntry } from '../../utils/workspace-index-ownership.js';
import { applyRootFileRemovals, computeRootFileRemovalPlan } from '../../utils/root-file-uninstaller.js';
import { exists, remove, walkFiles } from '../../utils/fs.js';
import { isDirKey } from '../../utils/package-index-yml.js';
import { removePackageFromOpenpackageYml } from '../../utils/package-management.js';
import { getPlatformRootFileNames } from '../../utils/platform-root-files.js';
import { getAllPlatforms } from '../platforms.js';
import { logger } from '../../utils/logger.js';
import { removeFileMapping } from './flow-aware-uninstaller.js';
import { getTargetPath } from '../../utils/workspace-index-helpers.js';
import { buildPreservedDirectoriesSet } from '../../utils/directory-preservation.js';
import type { WorkspaceIndexFileMapping } from '../../types/workspace-index.js';

interface FileRemoval {
  workspacePath: string;
  key: string;
}

function isRootFileKey(key: string, rootNames: Set<string>): boolean {
  const normalized = key.replace(/\\/g, '/');
  return rootNames.has(normalized);
}

async function expandFilesFromIndex(
  cwd: string,
  filesMapping: Record<string, (string | WorkspaceIndexFileMapping)[]>,
  rootNames: Set<string>
): Promise<FileRemoval[]> {
  const removals: FileRemoval[] = [];

  for (const [rawKey, targets] of Object.entries(filesMapping || {})) {
    if (!Array.isArray(targets) || targets.length === 0) continue;

    const isDir = isDirKey(rawKey);
    if (isDir) {
      for (const mapping of targets) {
        const targetDir = getTargetPath(mapping);
        const absDir = path.join(cwd, targetDir);
        if (!(await exists(absDir))) continue;
        for await (const filePath of walkFiles(absDir)) {
          removals.push({ workspacePath: filePath, key: rawKey });
        }
      }
      continue;
    }

    // file key
    if (isRootFileKey(rawKey, rootNames)) {
      continue; // handled by root-file uninstaller
    }

    for (const mapping of targets) {
      const targetPath = getTargetPath(mapping);
      removals.push({ workspacePath: path.join(cwd, targetPath), key: rawKey });
    }
  }

  // Dedupe by workspace path
  const seen = new Set<string>();
  return removals.filter(removal => {
    if (seen.has(removal.workspacePath)) return false;
    seen.add(removal.workspacePath);
    return true;
  });
}

/**
 * Clean up empty parent directories after file deletion.
 * 
 * Walks up the directory tree from each deleted file, removing empty directories
 * until hitting a preserved directory (platform root) or the workspace root.
 * 
 * For platform files (e.g., .cursor/commands/essentials/file.md):
 * - Removes empty subdirectories (essentials/, commands/)
 * - Stops at and preserves the platform root (.cursor/)
 * 
 * For root files (e.g., docs/guides/file.md):
 * - Removes all empty parent directories
 * - Stops only at workspace root
 * 
 * @param cwd - Workspace root directory
 * @param deletedPaths - Absolute paths of deleted files
 * @param preservedDirs - Set of absolute directory paths to preserve (never remove)
 */
async function cleanupEmptyParents(
  cwd: string,
  deletedPaths: string[],
  preservedDirs: Set<string>
): Promise<void> {
  const candidateDirs = new Set<string>();

  // Collect all parent directories from deleted files
  for (const deletedPath of deletedPaths) {
    let current = path.dirname(deletedPath);
    
    // Walk up the directory tree
    while (current.startsWith(cwd) && current !== cwd) {
      // Stop at preserved directories (platform roots)
      if (preservedDirs.has(current)) {
        break;
      }
      
      candidateDirs.add(current);
      current = path.dirname(current);
    }
  }

  // Sort by depth (deepest first) to ensure we process child directories before parents
  const sorted = Array.from(candidateDirs).sort((a, b) => b.length - a.length);
  
  // Remove empty directories
  for (const dir of sorted) {
    try {
      const entries = await readdir(dir);
      
      // Only remove if directory is empty and not preserved
      if (entries.length === 0 && !preservedDirs.has(dir)) {
        await remove(dir);
        logger.debug(`Removed empty directory: ${path.relative(cwd, dir)}`);
      }
    } catch (error) {
      // Ignore errors (directory may not exist, permission issues, etc.)
      logger.debug(`Could not process directory ${dir}: ${error}`);
    }
  }
}

export interface UninstallPipelineResult {
  removedFiles: string[];
  rootFilesUpdated: string[];
}

export async function runUninstallPipeline(
  packageName: string,
  options: UninstallOptions = {}
): Promise<CommandResult<UninstallPipelineResult>> {
  const cwd = process.cwd();
  const openpkgDir = getLocalOpenPackageDir(cwd);
  const manifestPath = getLocalPackageYmlPath(cwd);

  if (!(await exists(openpkgDir)) || !(await exists(manifestPath))) {
    throw new ValidationError(
      `No .openpackage/openpackage.yml found in ${cwd}.`
    );
  }

  const { index, path: indexPath } = await readWorkspaceIndex(cwd);
  const pkgEntry = index.packages?.[packageName];

  if (!pkgEntry) {
    return { success: false, error: `Package '${packageName}' not found in workspace index.` };
  }

  const rootNames = getPlatformRootFileNames(getAllPlatforms(undefined, cwd), cwd);
  const plannedRemovals = await expandFilesFromIndex(cwd, pkgEntry.files || {}, rootNames);
  const rootPlan = await computeRootFileRemovalPlan(cwd, [packageName]);

  if (options.dryRun) {
    console.log(`(dry-run) Would remove ${plannedRemovals.length} files for ${packageName}`);
    for (const removal of plannedRemovals) {
      console.log(` - ${removal.workspacePath}`);
    }
    if (rootPlan.toUpdate.length > 0) {
      console.log(`Root files to update:`);
      rootPlan.toUpdate.forEach(f => console.log(` - ${f}`));
    }
    return {
      success: true,
      data: {
        removedFiles: plannedRemovals.map(r => r.workspacePath),
        rootFilesUpdated: rootPlan.toUpdate
      }
    };
  }

  const deleted: string[] = [];
  const updated: string[] = [];

  // Process file mappings using flow-aware removal
  for (const [sourceKey, mappings] of Object.entries(pkgEntry.files || {})) {
    for (const mapping of mappings) {
      const result = await removeFileMapping(cwd, mapping, packageName);
      deleted.push(...result.removed);
      updated.push(...result.updated);
    }
  }

  const rootResult = await applyRootFileRemovals(cwd, [packageName]);

  // Update workspace index
  removeWorkspaceIndexEntry(index, packageName);
  await writeWorkspaceIndex({ path: indexPath, index });

  // Update openpackage.yml
  await removePackageFromOpenpackageYml(cwd, packageName);

  // Cleanup empty directories (preserve platform roots from detection patterns)
  const preservedDirs = buildPreservedDirectoriesSet(cwd);
  // Convert relative paths to absolute paths for cleanup
  const deletedAbsolutePaths = deleted.map(relativePath => path.join(cwd, relativePath));
  await cleanupEmptyParents(cwd, deletedAbsolutePaths, preservedDirs);

  logger.info(`Uninstalled ${packageName}: removed ${deleted.length} files, updated ${updated.length} merged files`);

  return {
    success: true,
    data: {
      removedFiles: deleted,
      rootFilesUpdated: [...rootResult.updated, ...updated]
    }
  };
}
