import type { PackageSourceLoader, LoadedPackage } from './base.js';
import type { PackageSource } from '../unified/context.js';
import type { InstallOptions } from '../../../types/index.js';
import { SourceLoadError } from './base.js';
import { parsePackageYml } from '../../../utils/package-yml.js';
import { resolvePackageContentRoot } from '../local-source-resolution.js';
import { join } from 'path';

/**
 * Loads packages from the local registry
 */
export class RegistrySourceLoader implements PackageSourceLoader {
  canHandle(source: PackageSource): boolean {
    return source.type === 'registry';
  }
  
  async load(
    source: PackageSource,
    options: InstallOptions,
    cwd: string
  ): Promise<LoadedPackage> {
    if (!source.packageName) {
      throw new SourceLoadError(source, 'Package name is required for registry sources');
    }
    
    if (!source.version) {
      throw new SourceLoadError(source, 'Version is required for registry sources');
    }
    
    try {
      // Resolve content root
      const contentRoot = await resolvePackageContentRoot({
        cwd,
        packageName: source.packageName,
        version: source.version
      });
      
      // Load package metadata
      const manifestPath = join(contentRoot, 'openpackage.yml');
      const metadata = await parsePackageYml(manifestPath);
      
      return {
        metadata,
        packageName: source.packageName,
        version: source.version,
        contentRoot,
        source: 'registry'
      };
    } catch (error) {
      throw new SourceLoadError(
        source,
        `Failed to load package ${source.packageName}@${source.version} from registry`,
        error as Error
      );
    }
  }
  
  getDisplayName(source: PackageSource): string {
    return source.version
      ? `${source.packageName}@${source.version}`
      : source.packageName;
  }
}
