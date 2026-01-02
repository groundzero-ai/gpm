/**
 * @fileoverview Show command implementation
 * 
 * Displays detailed information about a package from any source.
 * Supports package names, paths, git URLs, and tarballs.
 */

import { Command } from 'commander';
import { withErrorHandling } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { runShowPipeline } from '../core/show/show-pipeline.js';

/**
 * Show package details command
 */
async function showPackageCommand(packageInput: string): Promise<void> {
  logger.debug('Show command invoked', { packageInput });

  const cwd = process.cwd();
  const result = await runShowPipeline(packageInput, cwd);

  if (!result.success) {
    throw new Error(result.error || 'Show operation failed');
  }
}

/**
 * Setup the show command
 */
export function setupShowCommand(program: Command): void {
  program
    .command('show')
    .description(
      'Show details of a package from any source.\n' +
      'Supports:\n' +
      '  - Package names: show my-package, show my-package@1.0.0\n' +
      '  - Paths: show ./path/to/package, show .openpackage/packages/my-pkg\n' +
      '  - Git: show git:https://github.com/user/repo.git#ref\n' +
      '  - Tarballs: show ./package.tgz\n\n' +
      'Resolution priority for package names (like pack):\n' +
      '  1. Current directory (if name matches)\n' +
      '  2. Workspace packages (.openpackage/packages/)\n' +
      '  3. Global packages (~/.openpackage/packages/)\n' +
      '  4. Local registry (~/.openpackage/registry/)'
    )
    .argument('<package>', 'package name, path, git URL, or tarball')
    .action(withErrorHandling(async (packageInput: string) => {
      await showPackageCommand(packageInput);
    }));
}
