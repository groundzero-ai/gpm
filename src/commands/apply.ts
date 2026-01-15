import { Command } from 'commander';
import type { CommandResult } from '../types/index.js';
import { withErrorHandling } from '../utils/errors.js';
import { buildApplyContext } from '../core/install/unified/context-builders.js';
import { runUnifiedInstallPipeline } from '../core/install/unified/pipeline.js';

/**
 * Main apply command handler
 */
async function applyCommand(
  packageName: string | undefined,
  options: { force?: boolean; dryRun?: boolean }
): Promise<CommandResult> {
  const cwd = process.cwd();
  
  // If no package specified, apply all
  if (!packageName) {
    return await applyAllPackages(cwd, options);
  }
  
  // Build context
  const ctx = await buildApplyContext(cwd, packageName, options);
  
  // Apply single package
  return await runUnifiedInstallPipeline(ctx);
}

/**
 * Apply all packages in workspace
 */
async function applyAllPackages(
  cwd: string,
  options: { force?: boolean; dryRun?: boolean }
): Promise<CommandResult> {
  const { readWorkspaceIndex } = await import('../utils/workspace-index-yml.js');
  const { index } = await readWorkspaceIndex(cwd);
  
  const packageNames = Object.keys(index.packages ?? {}).sort();
  
  if (packageNames.length === 0) {
    return {
      success: false,
      error:
        `No packages installed in this workspace.\n` +
        `Run 'opkg install <package-name>' to install a package first.`
    };
  }
  
  console.log(`✓ Applying ${packageNames.length} packages\n`);
  
  for (const name of packageNames) {
    const ctx = await buildApplyContext(cwd, name, options);
    const result = await runUnifiedInstallPipeline(ctx);
    
    if (!result.success) {
      return result; // Stop on first failure
    }
  }
  
  return { success: true };
}

/**
 * Setup apply command
 */
export function setupApplyCommand(program: Command): void {
  program
    .command('apply')
    .description('Apply/sync package across platforms')
    .argument(
      '[package-name]',
      'package name to apply (defaults to current/root package)'
    )
    .option('-f, --force', 'overwrite existing files without prompting')
    .option('--dry-run', 'plan apply without writing files')
    .action(
      withErrorHandling(async (packageName: string | undefined, options: any) => {
        const result = await applyCommand(packageName, options);
        
        if (!result.success) {
          throw new Error(result.error || 'Apply operation failed');
        }
      })
    );
}
