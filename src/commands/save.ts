import { Command } from 'commander';
import { SaveOptions, CommandResult } from '../types/index.js';
import { withErrorHandling } from '../utils/errors.js';
import { runSavePipeline } from '../core/save/save-pipeline.js';
import { runAddPipeline, type AddPipelineOptions } from '../core/add/add-pipeline.js';

type SaveCommandOptions = SaveOptions & AddPipelineOptions;

async function savePackageCommand(
  packageName: string | undefined,
  pathArg: string | undefined,
  options: SaveCommandOptions = {}
): Promise<CommandResult> {
  const hasPath = Boolean(pathArg);

  if (hasPath && !packageName) {
    throw new Error(
      "When providing a path, you must also specify a package name. " +
      "To add files without saving, run: opkg add <package-name> <path>"
    );
  }

  if (hasPath) {
    const addResult = await runAddPipeline(packageName, pathArg, {
      platformSpecific: options.platformSpecific
    });
    if (!addResult.success) throw new Error(addResult.error || 'Add operation failed');
  }

  return runSavePipeline(packageName, {
    mode: 'wip',
    force: options.force,
    rename: options.rename,
    apply: options.apply
  });
}

export function setupSaveCommand(program: Command): void {
  program
    .command('save')
    .alias('s')
    .argument('[package-name]', 'package name (required when providing a path)')
    .argument('[path]', 'file or directory to add before saving')
    .description(
      'Save a package snapshot for this workspace.\n' +
      'Usage:\n' +
      '  opkg save                  # Save cwd package (requires .openpackage/package.yml)\n' +
      '  opkg save <package-name>   # Save specific package by name\n' +
      '  opkg save <package-name> <path>   # Add path to package, then save snapshot\n' +
      'Use `opkg pack` to create a stable copy in the registry.'
    )
    .option('-f, --force', 'overwrite existing version or skip confirmations')
    .option('--rename <newName>', 'Rename package during save')
    .option('--platform-specific', 'Save platform-specific variants for platform subdir inputs')
    .option('--apply', 'Apply/sync saved snapshot into workspace platforms after saving')
    .action(
      withErrorHandling(async (packageName: string | undefined, path: string | undefined, options?: SaveCommandOptions) => {
        const result = await savePackageCommand(packageName, path, options ?? {});
        if (!result.success) throw new Error(result.error || 'Save operation failed');
      })
    );
}
