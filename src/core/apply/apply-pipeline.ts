import { dirname, isAbsolute, join, relative, sep } from 'path';

import type { CommandResult, PackageFile, InstallOptions } from '../../types/index.js';
import { UNVERSIONED } from '../../constants/index.js';
import { readPackageFilesForRegistry } from '../../utils/package-copy.js';
import { PACKAGE_PATHS } from '../../constants/index.js';
import { getDetectedPlatforms } from '../platforms.js';
import { readWorkspaceIndex } from '../../utils/workspace-index-yml.js';
import { stripRootCopyPrefix, isRootCopyPath } from '../../utils/platform-root-files.js';
import { ensureDir, writeTextFile } from '../../utils/fs.js';
import { syncRootFiles } from '../sync/root-files-sync.js';
import { normalizePathForProcessing } from '../../utils/path-normalization.js';
import type { PlatformSyncResult } from '../sync/platform-sync.js';
import { resolveDeclaredPath } from '../../utils/path-resolution.js';
import { installPackageByIndexWithFlows } from '../../utils/flow-index-installer.js';

export interface ApplyPipelineOptions extends InstallOptions {}

export interface ApplyPipelineResult {
  config: { name: string; version: string };
  packageFiles: PackageFile[];
  syncResult: PlatformSyncResult;
}

export async function runApplyPipeline(
  packageName: string | undefined,
  options: ApplyPipelineOptions = {}
): Promise<CommandResult<ApplyPipelineResult>> {
  const cwd = process.cwd();
  const { index } = await readWorkspaceIndex(cwd);
  const targets =
    packageName !== undefined ? [packageName] : Object.keys(index.packages ?? {}).sort();

  if (targets.length === 0) {
    return {
      success: false,
      error:
        `No packages installed in this workspace.\n` +
        `Run 'opkg install <package-name>' to install a package first.`
    };
  }

  const results: ApplyPipelineResult[] = [];
  for (const target of targets) {
    const outcome = await applySinglePackage(cwd, target, options);
    if (!outcome.success) {
      return outcome;
    }
    results.push(outcome.data!);
  }

  // Return last applied package summary for compatibility
  return {
    success: true,
    data: results[results.length - 1]
  };
}

async function applySinglePackage(
  cwd: string,
  packageName: string,
  options: ApplyPipelineOptions
): Promise<CommandResult<ApplyPipelineResult>> {
  const { index } = await readWorkspaceIndex(cwd);
  const entry = index.packages?.[packageName];
  if (!entry?.path) {
    return {
      success: false,
      error:
        `Package '${packageName}' is not installed in this workspace.\n` +
        `Run 'opkg install ${packageName}' to install it first.`
    };
  }

  const resolved = resolveDeclaredPath(entry.path, cwd);
  const absolutePath = join(resolved.absolute, sep);
  const version = entry.version ?? UNVERSIONED;
  const platforms = await getDetectedPlatforms(cwd);
  
  const installResult = await installPackageByIndexWithFlows(
    cwd,
    packageName,
    version,
    platforms,
    {
      ...options,
      // Apply should behave like reinstall - no prompts, just overwrite
      force: true,
      dryRun: options.dryRun ?? false
    },
    undefined, // includePaths
    absolutePath, // contentRoot
    undefined // packageFormat
  );

  // Read package files for summary display
  const packageFiles = (await readPackageFilesForRegistry(absolutePath)).filter(
    file => file.path !== PACKAGE_PATHS.INDEX_RELATIVE
  );

  // Handle root files and root/** copy-to-root content
  const rootSyncResult = await syncRootFiles(cwd, packageFiles, packageName, platforms);
  const rootCopyTargets = await syncRootCopyContent(cwd, packageFiles, options);

  const displayPaths = buildDisplayPaths({
    cwd,
    flowTargets: installResult.installedFiles,
    rootSyncCreated: rootSyncResult.created,
    rootSyncUpdated: rootSyncResult.updated,
    rootCopyTargets
  });

  printApplySummary({
    packageName,
    version,
    updatedFiles: displayPaths,
    removedFiles: normalizeWorkspacePaths(cwd, installResult.deletedFiles)
  });

  return {
    success: true,
    data: {
      config: { name: packageName, version },
      packageFiles,
      syncResult: {
        created: installResult.installedFiles.concat(rootSyncResult.created),
        updated: installResult.updatedFiles.concat(rootSyncResult.updated),
        deleted: installResult.deletedFiles
      }
    }
  };
}

function buildDisplayPaths({
  cwd,
  flowTargets,
  rootSyncCreated,
  rootSyncUpdated,
  rootCopyTargets
}: {
  cwd: string;
  flowTargets: string[];
  rootSyncCreated: string[];
  rootSyncUpdated: string[];
  rootCopyTargets: string[];
}): string[] {
  const toWorkspaceRel = (absPath: string) => relative(cwd, absPath).replace(/\\/g, '/');

  const allAbsTargets = [
    ...(flowTargets ?? []),
    ...(rootSyncCreated ?? []).map(p => join(cwd, p)),
    ...(rootSyncUpdated ?? []).map(p => join(cwd, p)),
    ...(rootCopyTargets ?? [])
  ];

  return Array.from(new Set(allAbsTargets.map(toWorkspaceRel))).sort();
}

function normalizeWorkspacePaths(cwd: string, paths: string[] | undefined): string[] {
  if (!paths || paths.length === 0) return [];

  const normalized = paths.map(p => {
    const rel = isAbsolute(p) ? relative(cwd, p) : p;
    return rel.replace(/\\/g, '/');
  });

  return Array.from(new Set(normalized)).sort();
}

function printApplySummary({
  packageName,
  version,
  updatedFiles,
  removedFiles
}: {
  packageName: string;
  version: string;
  updatedFiles: string[];
  removedFiles: string[];
}): void {
  console.log(`✓ Applied ${packageName}@${version}`);

  if (updatedFiles.length > 0) {
    console.log(`✓ Updated files: ${updatedFiles.length}`);
    for (const file of [...updatedFiles].sort()) {
      console.log(`   ├── ${file}`);
    }
  }

  if (removedFiles.length > 0) {
    console.log(`✓ Removed files: ${removedFiles.length}`);
    for (const file of [...removedFiles].sort()) {
      console.log(`   ├── ${file}`);
    }
  }
}

async function syncRootCopyContent(
  cwd: string,
  packageFiles: PackageFile[],
  options: InstallOptions
): Promise<string[]> {
  const rootCopyFiles = packageFiles.filter(file => isRootCopyPath(file.path));
  const targets: string[] = [];
  for (const file of rootCopyFiles) {
    const stripped = stripRootCopyPrefix(normalizePathForProcessing(file.path) || '');
    if (!stripped) continue;
    const absTarget = join(cwd, stripped);
    targets.push(absTarget);
    if (options.dryRun) continue;
    await ensureDir(dirname(absTarget));
    await writeTextFile(absTarget, file.content, (file.encoding as BufferEncoding) ?? 'utf8');
  }

  return targets;
}
