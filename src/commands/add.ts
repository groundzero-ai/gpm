import { Command } from 'commander';

import { withErrorHandling } from '../utils/errors.js';
import { runAddToSourcePipeline, type AddToSourceOptions, type AddToSourceResult } from '../core/add/add-to-source-pipeline.js';
import { readWorkspaceIndex } from '../utils/workspace-index-yml.js';
import { formatPathForDisplay } from '../utils/formatters.js';

/**
 * Display add operation results in install-style format
 */
function displayAddResults(data: AddToSourceResult, options: AddToSourceOptions): void {
  const cwd = process.cwd();
  const { filesAdded, sourcePath, sourceType, packageName: resolvedName, addedFilePaths } = data;
  
  // Determine if this is a workspace root add
  const displayPath = formatPathForDisplay(sourcePath, cwd);
  const isWorkspaceRoot = displayPath.includes('.openpackage') && !displayPath.includes('.openpackage/packages');
  
  // Main success message
  if (isWorkspaceRoot) {
    console.log(`✓ Added to workspace package`);
  } else {
    console.log(`✓ Added to ${resolvedName}`);
  }
  
  // Display added files in install-style format
  if (addedFilePaths && addedFilePaths.length > 0) {
    console.log(`✓ Added files: ${addedFilePaths.length}`);
    const sortedFiles = [...addedFilePaths].sort((a, b) => a.localeCompare(b));
    for (const file of sortedFiles) {
      console.log(`   ├── ${formatPathForDisplay(file, cwd)}`);
    }
  } else {
    console.log(`✓ Added files: ${filesAdded}`);
  }
  
  // Show hints only for non-workspace-root adds
  if (!options.apply && !isWorkspaceRoot) {
    // Check if package is installed in workspace
    readWorkspaceIndex(cwd).then(workspaceIndexRecord => {
      const isInstalled = !!workspaceIndexRecord.index.packages[resolvedName];
      
      if (isInstalled) {
        console.log(`\n💡 Changes not synced to workspace.`);
        console.log(`   To sync changes, run:`);
        console.log(`     opkg apply ${resolvedName}`);
      } else {
        console.log(`\n💡 Package not installed in workspace.`);
        console.log(`   To install and sync, run:`);
        console.log(`     opkg install ${resolvedName}`);
      }
    }).catch(() => {
      // Ignore errors reading workspace index
    });
  }
}

export function setupAddCommand(program: Command): void {
  program
    .command('add')
    .argument('[package-name]', 'package name (optional - defaults to workspace package)')
    .argument('[path]', 'file or directory to add')
    .description('Add files to a mutable package source or workspace package')
    .option('--platform-specific', 'Save platform-specific variants for platform subdir inputs')
    .option('--apply', 'Apply changes to workspace immediately (requires package to be installed)')
    .action(
      withErrorHandling(async (packageName: string | undefined, pathArg: string | undefined, options: AddToSourceOptions) => {
        const result = await runAddToSourcePipeline(packageName, pathArg, options);
        if (!result.success) {
          throw new Error(result.error || 'Add operation failed');
        }
        
        // Display results
        if (result.data) {
          displayAddResults(result.data, options);
        }
      })
    );
}
