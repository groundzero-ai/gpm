import { Command } from 'commander';

import { CommandResult } from '../types/index.js';
import { withErrorHandling, ValidationError } from '../utils/errors.js';
import { runStatusPipeline, type StatusPackageReport } from '../core/status/status-pipeline.js';
import { logger } from '../utils/logger.js';

interface CommandOptions {
  verbose?: boolean;
}

function printPackageLine(
  pkg: StatusPackageReport,
  verbose: boolean
): void {
  const icon = pkg.state === 'synced' ? '✅' : pkg.state === 'missing' ? '❌' : '⚠️';
  const version = pkg.version ? `@${pkg.version}` : '';
  console.log(`${icon} ${pkg.name}${version}  ${pkg.state}  ${pkg.path}`);

  if (verbose && pkg.diffs.length > 0) {
    for (const diff of pkg.diffs) {
      const reason = diff.reason === 'missing' ? 'missing' : 'changed';
      console.log(`   - ${reason}: ${diff.workspacePath || diff.sourcePath}`);
    }
  }
}

async function statusCommand(options: CommandOptions = {}): Promise<CommandResult> {
  const cwd = process.cwd();
  logger.info(`Checking package status for directory: ${cwd}`);

  try {
    const result = await runStatusPipeline();
    const packages = result.data?.packages ?? [];

    console.log(`✓ Package status for: ${cwd}`);
    
    if (packages.length === 0) {
      console.log('(no packages in index)');
      return { success: true, data: { packages: [] } };
    }

    for (const pkg of packages) {
      printPackageLine(pkg, Boolean(options.verbose));
    }

    const synced = packages.filter(p => p.state === 'synced').length;
    console.log(`Summary: ${synced}/${packages.length} synced`);

    return { success: true, data: { packages } };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw error;
  }
}

export function setupStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show package sync state based on .openpackage/openpackage.index.yml')
    .option('--verbose', 'show file-level differences')
    .action(withErrorHandling(async (options: CommandOptions) => {
      await statusCommand(options);
    }));
}

