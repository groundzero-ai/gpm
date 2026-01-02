/**
 * @fileoverview Output formatting and display for the set command
 */

import { formatPathForDisplay } from '../../utils/formatters.js';
import type { PackageYml } from '../../types/index.js';
import type { ConfigChange, SetPipelineResult } from './set-types.js';

/**
 * Display changes that will be applied to the manifest
 */
export function displayConfigChanges(changes: ConfigChange[]): void {
  if (changes.length === 0) {
    console.log('\nNo changes detected.');
    return;
  }

  console.log('\n📝 Changes to apply:');
  
  for (const change of changes) {
    const oldDisplay = formatValue(change.oldValue);
    const newDisplay = formatValue(change.newValue);
    console.log(`  ${change.field}: ${oldDisplay} → ${newDisplay}`);
  }
}

/**
 * Format a value for display in change output
 */
function formatValue(value: any): string {
  if (value === undefined || value === null) {
    return '(not set)';
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return `[${value.join(', ')}]`;
  }
  
  if (typeof value === 'boolean') {
    return value.toString();
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  return JSON.stringify(value);
}

/**
 * Display success message after updating manifest
 */
export function displaySetSuccess(
  result: SetPipelineResult,
  cwd: string
): void {
  const displayPath = formatPathForDisplay(result.packagePath, cwd);
  
  console.log(`\n✓ Updated ${result.packageName} manifest`);
  console.log(`  Path: ${displayPath}`);
  console.log(`  Type: ${result.sourceType} package`);
  
  if (result.updatedFields.length > 0) {
    const fieldList = result.updatedFields.join(', ');
    console.log(`  Updated: ${fieldList}`);
  }
}

/**
 * Display current package configuration for interactive mode
 */
export function displayCurrentConfig(config: PackageYml, packagePath: string): void {
  console.log(`\nCurrent package: ${config.name}`);
  
  if (config.version) {
    console.log(`Version: ${config.version}`);
  }
  
  console.log(`Path: ${packagePath}`);
  console.log('\nLeave blank to keep current value, or enter new value:\n');
}

/**
 * Display no-changes message
 */
export function displayNoChanges(packageName: string): void {
  console.log(`\n✓ No changes made to ${packageName}`);
  console.log('  Manifest unchanged');
}
