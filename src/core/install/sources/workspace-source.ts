import { join } from 'path';
import type { PackageSourceLoader, LoadedPackage } from './base.js';
import type { PackageSource } from '../unified/context.js';
import type { InstallOptions } from '../../../types/index.js';
import { SourceLoadError } from './base.js';
import { readWorkspaceIndex } from '../../../utils/workspace-index-yml.js';
import { resolveDeclaredPath } from '../../../utils/path-resolution.js';
import { parsePackageYml } from '../../../utils/package-yml.js';

/**
 * Loads packages from workspace index (for apply command)
 */
export class WorkspaceSourceLoader implements PackageSourceLoader {
  canHandle(source: PackageSource): boolean {
    return source.type === 'workspace';
  }
  
  async load(
    source: PackageSource,
    options: InstallOptions
  ): Promise<LoadedPackage> {
    if (!source.packageName) {
      throw new SourceLoadError(source, 'Package name is required for workspace sources');
    }
    
    try {
      // Read workspace index
      const { index } = await readWorkspaceIndex(process.cwd());
      const entry = index.packages?.[source.packageName];
      
      if (!entry?.path) {
        throw new SourceLoadError(
          source,
          `Package '${source.packageName}' is not installed in this workspace. ` +
          `Run 'opkg install ${source.packageName}' to install it first.`
        );
      }
      
      // Resolve package path
      const resolved = resolveDeclaredPath(entry.path, process.cwd());
      const contentRoot = join(resolved.absolute, '/');
      
      // Load package metadata
      const manifestPath = join(contentRoot, 'openpackage.yml');
      const metadata = await parsePackageYml(manifestPath);
      
      const version = entry.version || metadata.version || '0.0.0';
      
      return {
        metadata,
        packageName: source.packageName,
        version,
        contentRoot,
        source: 'workspace'
      };
    } catch (error) {
      if (error instanceof SourceLoadError) {
        throw error;
      }
      
      throw new SourceLoadError(
        source,
        `Failed to load package '${source.packageName}' from workspace`,
        error as Error
      );
    }
  }
  
  getDisplayName(source: PackageSource): string {
    return `${source.packageName} (workspace)`;
  }
}
