/**
 * Add-specific package context
 * 
 * Minimal context for add operations that only need to know where to copy files.
 * Unlike PackageContext, this doesn't include the 'location' property since add
 * operations don't update the package index - that's handled by install/apply.
 */

import type { PackageYml } from '../../types/index.js';

export interface AddPackageContext {
  /** Normalized package name */
  name: string;
  
  /** Package version from openpackage.yml */
  version?: string;
  
  /** Full config from openpackage.yml */
  config: PackageYml;
  
  /** Absolute path to openpackage.yml */
  packageYmlPath: string;
  
  /** 
   * Absolute path to the package root directory where files will be copied.
   * This is the directory containing openpackage.yml.
   */
  packageRootDir: string;
  
  /** 
   * Absolute path to the content directory (same as package root for add operations)
   */
  packageFilesDir: string;
}
