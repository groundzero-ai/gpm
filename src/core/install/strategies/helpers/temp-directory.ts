/**
 * Temp Directory Helpers Module
 * 
 * Utilities for managing temporary directories during package conversion.
 */

import { join, dirname } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { ensureDir, writeTextFile, readTextFile } from '../../../../utils/fs.js';
import { logger } from '../../../../utils/logger.js';
import type { PackageConversionContext } from '../../../../types/conversion-context.js';
import { contextToJSON, contextFromJSON } from '../../../conversion-context/index.js';
import { existsSync } from 'fs';

/**
 * Create a temporary directory for package conversion
 * 
 * @param prefix - Prefix for temp directory name
 * @returns Absolute path to created temp directory
 */
export async function createTempPackageDirectory(prefix: string = 'opkg-converted-'): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), prefix));
  logger.debug('Created temporary directory', { tempDir });
  return tempDir;
}

/**
 * Write package files to temporary directory
 * 
 * @param files - Array of files to write
 * @param tempDir - Temporary directory path
 */
export async function writeTempPackageFiles(
  files: Array<{ path: string; content: string }>,
  tempDir: string
): Promise<void> {
  for (const file of files) {
    const filePath = join(tempDir, file.path);
    await ensureDir(dirname(filePath));
    await writeTextFile(filePath, file.content);
  }
  
  logger.debug(
    `Wrote ${files.length} converted files to temp directory`,
    { tempDir }
  );
}

/**
 * Write conversion context to temporary directory
 * 
 * @param context - Conversion context to write
 * @param tempDir - Temporary directory path
 */
export async function writeConversionContext(
  context: PackageConversionContext,
  tempDir: string
): Promise<void> {
  const contextPath = join(tempDir, '.opkg-conversion-context.json');
  const contextJson = contextToJSON(context);
  await writeTextFile(contextPath, contextJson);
  
  logger.debug('Wrote conversion context to temp directory', {
    tempDir,
    originalPlatform: context.originalFormat.platform,
    conversions: context.conversionHistory.length
  });
}

/**
 * Read conversion context from temporary directory
 * 
 * @param tempDir - Temporary directory path
 * @returns Conversion context, or null if not found
 */
export async function readConversionContext(
  tempDir: string
): Promise<PackageConversionContext | null> {
  const contextPath = join(tempDir, '.opkg-conversion-context.json');
  
  if (!existsSync(contextPath)) {
    logger.debug('No conversion context found in temp directory', { tempDir });
    return null;
  }
  
  try {
    const contextJson = await readTextFile(contextPath);
    const context = contextFromJSON(contextJson);
    
    logger.debug('Read conversion context from temp directory', {
      tempDir,
      originalPlatform: context.originalFormat.platform,
      conversions: context.conversionHistory.length
    });
    
    return context;
  } catch (error) {
    logger.warn('Failed to read conversion context', { tempDir, error });
    return null;
  }
}

/**
 * Cleanup temporary directory with error handling
 * 
 * @param tempDir - Directory to cleanup
 */
export async function cleanupTempDirectory(tempDir: string | null): Promise<void> {
  if (!tempDir) {
    return;
  }
  
  try {
    await rm(tempDir, { recursive: true, force: true });
    logger.debug('Cleaned up temporary directory', { tempDir });
  } catch (error) {
    logger.warn('Failed to cleanup temp directory', {
      tempDir,
      error
    });
  }
}
