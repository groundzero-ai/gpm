/**
 * @fileoverview Type definitions for the show command
 */

import type { PackageYml } from '../../types/index.js';
import type { PackageSourceType } from '../../utils/package-name-resolution.js';

/**
 * Source type for show command (extends package source types with additional path/git options)
 */
export type ShowSourceType = PackageSourceType | 'path' | 'git' | 'tarball';

/**
 * Information about where a package was resolved from
 */
export interface ShowPackageSource {
  /** Type of source */
  type: ShowSourceType;
  /** Absolute path to the package */
  path: string;
  /** Whether the package is mutable (can be edited with save/add) */
  isMutable: boolean;
  /** Display label for the source type */
  label: string;
}

/**
 * Complete package information for display
 */
export interface ShowPackageInfo {
  /** Package name */
  name: string;
  /** Package version (may be empty for unversioned) */
  version: string;
  /** Whether the version is unversioned */
  unversioned: boolean;
  /** Source information */
  source: ShowPackageSource;
  /** Package metadata from openpackage.yml */
  metadata: PackageYml;
  /** List of file paths in the package */
  files: string[];
  /** Whether this is a partial package */
  isPartial: boolean;
}

/**
 * Resolution information when multiple candidates exist
 */
export interface ShowResolutionInfo {
  /** List of all candidates found */
  candidates: Array<{
    type: ShowSourceType;
    version: string;
    path: string;
  }>;
  /** The selected candidate */
  selected: {
    type: ShowSourceType;
    version: string;
    path: string;
  };
  /** Reason for selection */
  reason: 'only-source' | 'cwd-match' | 'workspace-override' | 'newer-version' | 'same-version-prefer-mutable';
}
