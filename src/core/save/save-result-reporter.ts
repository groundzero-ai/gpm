import type { CommandResult } from '../../types/index.js';
import type { ConflictAnalysis } from './save-conflict-analyzer.js';
import type { WriteResult } from './save-types.js';

/**
 * Core responsibility: Format results for user consumption
 * Input: Write results, analysis results
 * Output: Formatted CommandResult with messages
 */

export interface SaveOperationSummary {
  packageName: string;
  totalGroups: number;
  processedGroups: number;
  skippedGroups: number;
  createdFiles: number;
  updatedFiles: number;
  platformSpecificFiles: number;
  errorCount: number;
  interactivePrompts: number;
}

export interface SaveReportResult {
  summary: SaveOperationSummary;
  operations: WriteResult[];
  analyses: ConflictAnalysis[];
}

/**
 * Build save operation report
 * 
 * Aggregates analysis and write results into a comprehensive report.
 */
export function buildSaveReport(
  packageName: string,
  analyses: ConflictAnalysis[],
  writeResults: WriteResult[][]
): SaveReportResult {
  const flattenedResults = writeResults.flat();
  
  // Count operations
  const createdFiles = flattenedResults.filter(
    r => r.success && r.operation.operation === 'create' && !r.operation.isPlatformSpecific
  ).length;
  
  const updatedFiles = flattenedResults.filter(
    r => r.success && r.operation.operation === 'update' && !r.operation.isPlatformSpecific
  ).length;
  
  const platformSpecificFiles = flattenedResults.filter(
    r => r.success && r.operation.isPlatformSpecific && r.operation.operation !== 'skip'
  ).length;
  
  const errorCount = flattenedResults.filter(r => !r.success).length;
  
  // Count interactive prompts
  const interactivePrompts = analyses.filter(
    a => a.recommendedStrategy === 'interactive'
  ).length;
  
  // Count groups
  const totalGroups = analyses.length;
  const skippedGroups = analyses.filter(
    a => a.type === 'no-action-needed' || a.type === 'no-change-needed'
  ).length;
  const processedGroups = totalGroups - skippedGroups;
  
  const summary: SaveOperationSummary = {
    packageName,
    totalGroups,
    processedGroups,
    skippedGroups,
    createdFiles,
    updatedFiles,
    platformSpecificFiles,
    errorCount,
    interactivePrompts
  };
  
  return {
    summary,
    operations: flattenedResults,
    analyses
  };
}

/**
 * Format save report for console output
 * 
 * Returns array of message lines to display to user.
 */
export function formatSaveReport(
  report: SaveReportResult
): string[] {
  const lines: string[] = [];
  const { summary, operations } = report;
  
  // Success header
  if (summary.errorCount === 0) {
    lines.push(`✓ Saved ${summary.packageName}`);
  } else {
    lines.push(`⚠ Saved ${summary.packageName} with ${summary.errorCount} error(s)`);
  }
  
  // No changes case
  if (summary.processedGroups === 0 && summary.errorCount === 0) {
    lines.push('  No workspace changes detected');
    return lines;
  }
  
  // File operations
  const fileOperations: string[] = [];
  
  if (summary.createdFiles > 0) {
    fileOperations.push(`${summary.createdFiles} created`);
  }
  
  if (summary.updatedFiles > 0) {
    fileOperations.push(`${summary.updatedFiles} updated`);
  }
  
  if (summary.platformSpecificFiles > 0) {
    fileOperations.push(`${summary.platformSpecificFiles} platform-specific`);
  }
  
  if (fileOperations.length > 0) {
    lines.push(`  ${fileOperations.join(', ')}`);
  }
  
  // List individual operations (limited)
  const successfulOps = operations.filter(
    op => op.success && op.operation.operation !== 'skip'
  );
  
  const maxDisplay = 10;
  for (let i = 0; i < Math.min(successfulOps.length, maxDisplay); i++) {
    const result = successfulOps[i];
    lines.push(`  ${formatWriteOperation(result)}`);
  }
  
  if (successfulOps.length > maxDisplay) {
    lines.push(`  ... and ${successfulOps.length - maxDisplay} more`);
  }
  
  // List errors if any
  if (summary.errorCount > 0) {
    const errorMessages = formatErrors(operations);
    lines.push('');
    lines.push('Errors:');
    lines.push(...errorMessages);
  }
  
  return lines;
}

/**
 * Create CommandResult from report
 * 
 * Converts report into the standard CommandResult format.
 */
export function createCommandResult(
  report: SaveReportResult
): CommandResult {
  const messages = formatSaveReport(report);
  const message = messages.join('\n');
  
  // Consider operation successful if no errors
  const success = report.summary.errorCount === 0;
  
  // Print the message to console
  console.log(message);
  
  return {
    success,
    error: success ? undefined : `Save completed with ${report.summary.errorCount} error(s)`
  };
}

/**
 * Format write operation for display
 * 
 * Returns a user-friendly string describing the operation.
 */
function formatWriteOperation(
  result: WriteResult
): string {
  const op = result.operation;
  
  let prefix = '';
  switch (op.operation) {
    case 'create':
      prefix = op.isPlatformSpecific ? '+ Platform' : '+ Created';
      break;
    case 'update':
      prefix = op.isPlatformSpecific ? '↻ Platform' : '↻ Updated';
      break;
    case 'skip':
      prefix = '- Skipped';
      break;
  }
  
  const path = op.registryPath;
  const platformSuffix = op.platform ? ` (${op.platform})` : '';
  
  return `${prefix}: ${path}${platformSuffix}`;
}

/**
 * Format error messages
 * 
 * Returns array of formatted error message lines.
 */
function formatErrors(
  results: WriteResult[]
): string[] {
  const errors: string[] = [];
  
  const failedResults = results.filter(r => !r.success);
  
  for (const result of failedResults) {
    const path = result.operation.registryPath || result.operation.targetPath;
    const message = result.error?.message || 'Unknown error';
    errors.push(`  ✗ ${path}: ${message}`);
  }
  
  return errors;
}

/**
 * Create minimal success result
 * 
 * Convenience function for simple success cases.
 */
export function createSuccessResult(
  packageName: string,
  message?: string
): CommandResult {
  const msg = message || `✓ Saved ${packageName}`;
  console.log(msg);
  return {
    success: true
  };
}

/**
 * Create error result
 * 
 * Convenience function for error cases.
 */
export function createErrorResult(
  error: string
): CommandResult {
  return {
    success: false,
    error
  };
}
