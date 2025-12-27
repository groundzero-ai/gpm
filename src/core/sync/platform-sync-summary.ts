import type { PackageFile } from '../../types/index.js';
import type { PackageContext } from '../package-context.js';
import type { PlatformSyncResult } from './platform-sync.js';
import { formatRegistryPathForDisplay } from '../../utils/registry-paths.js';

export interface PrintPlatformSyncSummaryOptions {
  /** e.g. "Saved" or "Applied" */
  actionLabel: string;
  packageContext: PackageContext;
  version: string;
  packageFiles: PackageFile[];
  /** When omitted, platform sync sections will not be printed */
  syncResult?: PlatformSyncResult;
  /** When syncResult is omitted, optionally print a hint line */
  noSyncHint?: string;
}

export function printPlatformSyncSummary({
  actionLabel,
  packageContext,
  version,
  packageFiles,
  syncResult,
  noSyncHint
}: PrintPlatformSyncSummaryOptions): void {
  const name = packageContext.config.name;
  const type = packageContext.location === 'root' ? 'root package' : 'package';

  console.log(`✓ ${actionLabel} ${name}@${version} (${type}, ${packageFiles.length} files):`);

  if (packageFiles.length > 0) {
    for (const path of [...packageFiles.map(f => f.path)].sort()) {
      console.log(`   ├── ${formatRegistryPathForDisplay(path)}`);
    }
  }

  const printList = (label: string, files: string[] | undefined) => {
    if (!files || files.length === 0) return;
    console.log(`✓ Platform sync ${label} ${files.length} files:`);
    for (const f of [...files].sort()) console.log(`   ├── ${f}`);
  };

  if (syncResult) {
    printList('created', syncResult.created);
    printList('updated', syncResult.updated);
    printList('removed', syncResult.deleted ?? []);
  } else if (noSyncHint) {
    console.log(noSyncHint);
  }
}

