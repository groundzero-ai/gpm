import type { InstallOptions, CommandResult } from '../../types/index.js';
import type { ResolvedPackage } from '../dependency-resolver.js';
import { CONFLICT_RESOLUTION } from '../../constants/index.js';

/**
 * Handle dry run mode for package installation
 */
export async function handleDryRunMode(
  resolvedPackages: ResolvedPackage[],
  packageName: string,
  targetDir: string,
  options: InstallOptions,
  packageYmlExists: boolean
): Promise<CommandResult> {
  console.log(`✓ Dry run - showing what would be installed:\n`);

  const mainPackage = resolvedPackages.find(f => f.isRoot);
  if (mainPackage) {
    console.log(`Package: ${mainPackage.name} v${mainPackage.version}`);
    if (mainPackage.pkg.metadata.description) {
      console.log(`Description: ${mainPackage.pkg.metadata.description}`);
    }
    console.log('');
  }

  // Show what would be installed
  for (const resolved of resolvedPackages) {
    if (resolved.conflictResolution === CONFLICT_RESOLUTION.SKIPPED) {
      console.log(`✓ Would skip ${resolved.name}@${resolved.version} (user would decline overwrite)`);
      continue;
    }

    if (resolved.conflictResolution === CONFLICT_RESOLUTION.KEPT) {
      console.log(`✓ Would skip ${resolved.name}@${resolved.version} (same or newer version already installed)`);
      continue;
    }

    console.log(`✓ Would install ${resolved.name}@${resolved.version} to workspace`);
  }

  // Show openpackage.yml update
  if (packageYmlExists) {
    console.log(`\n✓ Would add to .openpackage/openpackage.yml: ${packageName}@${resolvedPackages.find(f => f.isRoot)?.version}`);
  } else {
    console.log('\nNo .openpackage/openpackage.yml found - skipping dependency addition');
  }

  return {
    success: true,
    data: {
      dryRun: true,
      resolvedPackages,
      totalPackages: resolvedPackages.length
    }
  };
}
