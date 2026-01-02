/**
 * @fileoverview Command setup for 'opkg set'
 * 
 * Updates manifest fields in openpackage.yml for mutable packages.
 */

import { Command } from 'commander';
import { withErrorHandling } from '../utils/errors.js';
import { runSetPipeline } from '../core/set/set-pipeline.js';
import type { SetCommandOptions } from '../core/set/set-types.js';

/**
 * Setup the 'opkg set' command
 */
export function setupSetCommand(program: Command): void {
  program
    .command('set')
    .argument('[package]', 'package name or path (optional if cwd is a package)')
    .description(
      'Update manifest fields in openpackage.yml for mutable packages.\n\n' +
      'Updates can be made via CLI flags (batch mode) or interactively.\n' +
      'Interactive mode prompts for each field, showing current values as defaults.\n\n' +
      'The set command works with mutable package sources:\n' +
      '  - Current directory (if it contains openpackage.yml)\n' +
      '  - Workspace packages: ./.openpackage/packages/\n' +
      '  - Global packages: ~/.openpackage/packages/\n\n' +
      'Registry packages are immutable and cannot be modified.\n\n' +
      'Usage examples:\n' +
      '  opkg set                                    # Interactive: update CWD package\n' +
      '  opkg set my-package                         # Interactive: update named package\n' +
      '  opkg set my-package --ver 1.2.0             # Update version field\n' +
      '  opkg set --ver 0.5.0                        # Update CWD package version\n' +
      '  opkg set my-package --ver 1.0.0 --description "New description"\n' +
      '  opkg set my-package --keywords "ai coding assistant"\n' +
      '  opkg set my-package --private               # Mark as private\n' +
      '  opkg set my-package --force                 # Skip confirmation'
    )
    .option('--ver <version>', 'set package version (must be valid semver)')
    .option('--name <name>', 'set package name')
    .option('--description <desc>', 'set description')
    .option('--keywords <keywords>', 'set keywords (space-separated)')
    .option('--author <author>', 'set author')
    .option('--license <license>', 'set license')
    .option('--homepage <url>', 'set homepage URL')
    .option('--private', 'mark as private package')
    .option('-f, --force', 'skip confirmation prompts')
    .option('--non-interactive', 'require flags, no prompting (for CI/CD)')
    .action(
      withErrorHandling(async (packageInput: string | undefined, options: SetCommandOptions) => {
        const result = await runSetPipeline(packageInput, options);
        if (!result.success) {
          throw new Error(result.error || 'Set operation failed');
        }
      })
    );
}
