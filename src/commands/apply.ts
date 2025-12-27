import { Command } from 'commander';

import type { CommandResult } from '../types/index.js';
import { withErrorHandling } from '../utils/errors.js';
import { runApplyPipeline, type ApplyPipelineOptions } from '../core/apply/apply-pipeline.js';

export function setupApplyCommand(program: Command): void {
  program
    .command('apply')
    .description('Apply/sync the current (or specified) package across detected platforms.')
    .argument('[package-name]', 'package name to apply (defaults to current/root package)')
    .option('-f, --force', 'overwrite existing files without prompting')
    .option('--dry-run', 'plan apply without writing files')
    .action(
      withErrorHandling(async (packageName: string | undefined, options: ApplyPipelineOptions) => {
        const result: CommandResult = await runApplyPipeline(packageName, options ?? {});
        if (!result.success) throw new Error(result.error || 'Apply operation failed');
      })
    );
}
