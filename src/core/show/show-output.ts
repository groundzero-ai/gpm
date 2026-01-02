/**
 * @fileoverview Display/output logic for the show command
 * 
 * Handles formatting and displaying package information to the console.
 * Separated from business logic for easy testing and customization.
 */

import { formatPathForDisplay } from '../../utils/formatters.js';
import { describeVersionRange, isExactVersion } from '../../utils/version-ranges.js';
import { formatVersionLabel } from '../../utils/package-versioning.js';
import type { ShowPackageInfo, ShowResolutionInfo, ScopeHintInfo } from './show-types.js';

/**
 * Display package information to console
 */
export function displayPackageInfo(
  info: ShowPackageInfo, 
  cwd: string, 
  scopeHintInfo?: ScopeHintInfo
): void {
  const { name, version, unversioned, source, metadata, files, isPartial } = info;

  // Package name and version
  console.log(`✓ Package: ${name}`);

  if (!unversioned && version) {
    console.log(`✓ Version: ${version}`);
  }

  // Source information
  const displayPath = formatPathForDisplay(source.path, cwd);
  console.log(`✓ Source: ${source.label} (${displayPath})`);
  console.log(`✓ Type: ${source.isMutable ? 'mutable' : 'immutable'}`);

  // Metadata fields
  if (metadata.description) {
    console.log(`✓ Description: ${metadata.description}`);
  }

  if (metadata.keywords && metadata.keywords.length > 0) {
    console.log(`✓ Keywords: ${metadata.keywords.join(', ')}`);
  }

  if (metadata.author) {
    console.log(`✓ Author: ${metadata.author}`);
  }

  if (metadata.license) {
    console.log(`✓ License: ${metadata.license}`);
  }

  if (metadata.homepage) {
    console.log(`✓ Homepage: ${metadata.homepage}`);
  }

  if (metadata.repository) {
    const repo = metadata.repository;
    const repoDir = repo.directory ? ` (directory: ${repo.directory})` : '';
    console.log(`✓ Repository: ${repo.type} - ${repo.url}${repoDir}`);
  }

  console.log(`✓ Private: ${metadata.private ? 'Yes' : 'No'}`);

  if (isPartial) {
    console.log('✓ Partial: Yes');
  }

  // Dependencies section
  displayDependencies(metadata);

  // Files section
  displayFileList(files);

  // Scope hint section (if package exists in multiple scopes)
  if (scopeHintInfo) {
    displayScopeHint(scopeHintInfo);
  }
}

/**
 * Display dependencies (packages and dev-packages)
 */
function displayDependencies(metadata: any): void {
  // Production packages
  if (metadata.packages && metadata.packages.length > 0) {
    console.log(`✓ Imported Packages (${metadata.packages.length}):`);
    for (const dep of metadata.packages) {
      const versionLabel = formatVersionLabel(dep.version);
      const rangeDescription = dep.version && !isExactVersion(dep.version)
        ? ` (${describeVersionRange(dep.version)})`
        : '';
      console.log(`  • ${dep.name}@${versionLabel}${rangeDescription}`);
    }
  }

  // Dev packages
  if (metadata['dev-packages'] && metadata['dev-packages'].length > 0) {
    console.log(`✓ Imported Dev Packages (${metadata['dev-packages'].length}):`);
    for (const dep of metadata['dev-packages']) {
      const versionLabel = formatVersionLabel(dep.version);
      const rangeDescription = dep.version && !isExactVersion(dep.version)
        ? ` (${describeVersionRange(dep.version)})`
        : '';
      console.log(`  • ${dep.name}@${versionLabel}${rangeDescription}`);
    }
  }
}

/**
 * Display file list
 */
function displayFileList(files: string[]): void {
  console.log(`✓ Files: ${files.length}`);
  for (const filePath of files) {
    console.log(`   ├── ${filePath}`);
  }
}

/**
 * Display resolution information when multiple candidates were found
 */
export function displayResolutionInfo(info: ShowResolutionInfo): void {
  const { candidates, selected, reason } = info;

  if (candidates.length <= 1) {
    return;
  }

  console.log(`\nResolved from multiple sources:`);

  for (const candidate of candidates) {
    const marker = candidate.path === selected.path ? '✓' : ' ';
    const versionLabel = candidate.version || 'unversioned';
    console.log(`  ${marker} ${getSourceLabel(candidate.type)}: ${versionLabel}`);
  }

  const reasonText = getReasonText(reason);
  if (reasonText) {
    console.log(`Selection reason: ${reasonText}\n`);
  }
}

/**
 * Get source label for display
 */
function getSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'cwd':
      return 'current directory';
    case 'workspace':
      return 'workspace packages';
    case 'global':
      return 'global packages';
    case 'registry':
      return 'local registry';
    case 'path':
      return 'path';
    case 'git':
      return 'git repository';
    case 'tarball':
      return 'tarball';
    default:
      return sourceType;
  }
}

/**
 * Get human-readable text for resolution reason
 */
function getReasonText(reason: string): string {
  switch (reason) {
    case 'cwd-match':
      return 'current directory has matching package';
    case 'workspace-override':
      return 'workspace packages always override';
    case 'newer-version':
      return 'higher version selected';
    case 'same-version-prefer-mutable':
      return 'same version, prefer mutable';
    case 'only-source':
      return 'only source found';
    default:
      return '';
  }
}

/**
 * Display scope hint when package exists in multiple scopes
 */
function displayScopeHint(scopeHintInfo: ScopeHintInfo): void {
  console.log('');
  console.log('💡 This package also exists in other scopes:');
  
  for (const otherScope of scopeHintInfo.otherScopes) {
    const scopeLabel = getSourceLabel(otherScope.scope);
    const versionInfo = otherScope.version ? ` (v${otherScope.version})` : '';
    console.log(`   • ${scopeLabel}${versionInfo}`);
    console.log(`     View with: ${otherScope.showCommand}`);
  }
}
