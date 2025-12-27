import type { CommandResult, PackageFile, InstallOptions } from '../../types/index.js';
import { UNVERSIONED } from '../../constants/index.js';
import { performPlatformSync, type PlatformSyncResult } from '../sync/platform-sync.js';
import {
  detectPackageContext,
  getNoPackageDetectedMessage
} from '../package-context.js';
import { readPackageFilesForRegistry } from '../../utils/package-copy.js';
import { PACKAGE_PATHS } from '../../constants/index.js';
import { printPlatformSyncSummary } from '../sync/platform-sync-summary.js';

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
  const detectedContext = await detectPackageContext(cwd, packageName);
  if (!detectedContext) {
    return { success: false, error: getNoPackageDetectedMessage(packageName) };
  }

  const packageFiles = (await readPackageFilesForRegistry(detectedContext.packageRootDir)).filter(
    file => file.path !== PACKAGE_PATHS.INDEX_RELATIVE
  );

  const version = detectedContext.config.version ?? UNVERSIONED;
  const conflictStrategy = options.force ? 'overwrite' : options.conflictStrategy ?? 'ask';

  const syncResult = await performPlatformSync(
    cwd,
    detectedContext.config.name,
    version,
    packageFiles,
    {
      ...options,
      conflictStrategy,
      skipRootSync: detectedContext.location === 'root',
      packageLocation: detectedContext.location
    }
  );

  printPlatformSyncSummary({
    actionLabel: 'Applied',
    packageContext: detectedContext,
    version,
    packageFiles,
    syncResult
  });

  return {
    success: true,
    data: {
      config: { name: detectedContext.config.name, version },
      packageFiles,
      syncResult
    }
  };
}
