import { dirname, join } from 'path';
import { ensureDir, exists, readTextFile, writeTextFile } from '../../utils/fs.js';
import { logger } from '../../utils/logger.js';
import { createPlatformSpecificRegistryPath } from '../../utils/platform-specific-paths.js';
import { UTF8_ENCODING } from './constants.js';
import type { SaveCandidate, ResolutionResult, WriteOperation, WriteResult } from './save-types.js';

/**
 * Core responsibility: Write resolved content to source
 * Input: Resolution results
 * Output: Write operation results
 */

/**
 * Coordinate all writes for a resolution result
 * 
 * Writes both universal content and platform-specific content.
 * Returns detailed results for each write operation.
 * 
 * Note: Universal candidate can be null if user chose to save
 * only platform-specific variants.
 */
export async function writeResolution(
  packageRoot: string,
  registryPath: string,
  resolution: ResolutionResult,
  localCandidate?: SaveCandidate
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  
  // Write universal content (if selected)
  if (resolution.selection) {
    const universalResult = await writeUniversal(
      packageRoot,
      registryPath,
      resolution.selection,
      localCandidate
    );
    results.push(universalResult);
  } else {
    // No universal selected - log this
    logger.debug(`No universal content selected for ${registryPath} - keeping original untouched`);
  }
  
  // Write platform-specific content
  for (const platformCandidate of resolution.platformSpecific) {
    const platformResult = await writePlatformSpecific(
      packageRoot,
      registryPath,
      platformCandidate
    );
    results.push(platformResult);
  }
  
  return results;
}

/**
 * Write universal content to source
 * 
 * Writes the selected workspace candidate to the package source.
 * Optimizes by skipping write if content is identical to existing source.
 */
async function writeUniversal(
  packageRoot: string,
  registryPath: string,
  candidate: SaveCandidate,
  localCandidate?: SaveCandidate
): Promise<WriteResult> {
  const targetPath = join(packageRoot, registryPath);
  
  // Determine if write is needed
  const writeDecision = shouldWrite(candidate, localCandidate);
  
  const operation: WriteOperation = {
    registryPath,
    targetPath,
    content: candidate.content,
    operation: writeDecision.operation,
    isPlatformSpecific: false
  };
  
  // Skip if no write needed
  if (!writeDecision.needed) {
    logger.debug(`Skipping write for ${registryPath}: content identical to source`);
    return {
      operation,
      success: true
    };
  }
  
  // Perform write
  const writeResult = await safeWrite(targetPath, getContentToWrite(candidate));
  
  if (writeResult.success) {
    logger.debug(
      `${operation.operation === 'create' ? 'Created' : 'Updated'} ${registryPath}`
    );
  }
  
  return {
    operation,
    success: writeResult.success,
    error: writeResult.error
  };
}

/**
 * Write platform-specific content to source
 * 
 * Writes a platform-specific variant to a platform-specific path
 * (e.g., commands.cursor.md, CLAUDE.md).
 */
async function writePlatformSpecific(
  packageRoot: string,
  registryPath: string,
  candidate: SaveCandidate
): Promise<WriteResult> {
  const platform = candidate.platform;
  
  if (!platform || platform === 'ai') {
    return {
      operation: {
        registryPath,
        targetPath: '',
        content: '',
        operation: 'skip',
        isPlatformSpecific: true
      },
      success: false,
      error: new Error('Candidate has no platform association')
    };
  }
  
  const platformRegistryPath = createPlatformSpecificRegistryPath(registryPath, platform);
  if (!platformRegistryPath) {
    return {
      operation: {
        registryPath,
        targetPath: '',
        content: '',
        operation: 'skip',
        isPlatformSpecific: true,
        platform
      },
      success: false,
      error: new Error(`Could not create platform-specific path for ${platform}`)
    };
  }
  
  const targetPath = join(packageRoot, platformRegistryPath);
  
  // Determine operation type
  const fileExists = await exists(targetPath);
  const operationType: 'create' | 'update' = fileExists ? 'update' : 'create';
  
  const operation: WriteOperation = {
    registryPath: platformRegistryPath,
    targetPath,
    content: getContentToWrite(candidate),
    operation: operationType,
    isPlatformSpecific: true,
    platform
  };
  
  // Check if content matches existing (optimization)
  if (fileExists) {
    try {
      const existingContent = await readTextFile(targetPath, UTF8_ENCODING);
      if (existingContent === operation.content) {
        logger.debug(`Skipping write for ${platformRegistryPath}: content identical`);
        operation.operation = 'skip';
        return {
          operation,
          success: true
        };
      }
    } catch (error) {
      // Ignore read errors - will attempt write anyway
      logger.debug(`Could not read existing file ${platformRegistryPath}: ${error}`);
    }
  }
  
  // Perform write
  const writeResult = await safeWrite(targetPath, operation.content);
  
  if (writeResult.success) {
    logger.debug(
      `${operationType === 'create' ? 'Created' : 'Updated'} platform-specific file: ${platformRegistryPath}`
    );
  }
  
  return {
    operation,
    success: writeResult.success,
    error: writeResult.error
  };
}

/**
 * Determine if write is needed (optimization)
 * 
 * Compares candidate content with local (source) content.
 * Returns whether write is needed and what operation type.
 */
function shouldWrite(
  candidate: SaveCandidate,
  localCandidate?: SaveCandidate
): { needed: boolean; operation: 'create' | 'update' | 'skip' } {
  // No local candidate means file doesn't exist - create
  if (!localCandidate) {
    return { needed: true, operation: 'create' };
  }
  
  // Compare content hashes
  if (candidate.contentHash === localCandidate.contentHash) {
    // Content identical - skip write
    return { needed: false, operation: 'skip' };
  }
  
  // Content differs - update
  return { needed: true, operation: 'update' };
}

/**
 * Get content to write from candidate
 * 
 * For root files, uses sectionBody if available.
 * Otherwise uses full content.
 */
function getContentToWrite(candidate: SaveCandidate): string {
  if (candidate.isRootFile && candidate.sectionBody) {
    return candidate.sectionBody.trim();
  }
  return candidate.content;
}

/**
 * Safely write file with error handling
 * 
 * Ensures parent directory exists before writing.
 * Returns success/error result without throwing.
 */
async function safeWrite(
  targetPath: string,
  content: string
): Promise<{ success: boolean; error?: Error }> {
  try {
    // Ensure parent directory exists
    await ensureDir(dirname(targetPath));
    
    // Write file
    await writeTextFile(targetPath, content, UTF8_ENCODING);
    
    return { success: true };
  } catch (error) {
    logger.error(`Failed to write file ${targetPath}: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}


