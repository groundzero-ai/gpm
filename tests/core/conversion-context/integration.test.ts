/**
 * Integration Tests for Conversion Context
 * 
 * End-to-end tests for conversion context flowing through the entire pipeline:
 * 1. Package loading
 * 2. Format detection
 * 3. Conversion
 * 4. Temp directory persistence
 * 5. Installation
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import {
  createContextFromFormat,
  createPlatformContext,
  createUniversalContext,
  updateContextAfterConversion,
  withTargetPlatform,
  contextToJSON,
  contextFromJSON
} from '../../../src/core/conversion-context/index.js';
import {
  writeConversionContext,
  readConversionContext
} from '../../../src/core/install/strategies/helpers/temp-directory.js';
import { detectPackageFormat } from '../../../src/core/install/format-detector.js';
import type { Package, PackageFile } from '../../../src/types/index.js';
import type { PackageConversionContext } from '../../../src/types/conversion-context.js';
import { createPlatformConverter } from '../../../src/core/flows/platform-converter.js';

describe('Conversion Context - Integration', () => {
  describe('End-to-End Flow', () => {
    it('context flows from detection → conversion → persistence', async () => {
      // Step 1: Detect format from files
      const files: PackageFile[] = [
        { path: '.claude-plugin/plugin.json', content: '{}', encoding: 'utf8' },
        { path: 'commands/test.md', content: '# Test', encoding: 'utf8' }
      ];
      
      const format = detectPackageFormat(files);
      assert.strictEqual(format.type, 'platform-specific');
      assert.strictEqual(format.platform, 'claude-plugin');
      
      // Step 2: Create context from format
      const context = createContextFromFormat(format);
      assert.strictEqual(context.originalFormat.platform, 'claude-plugin');
      assert.strictEqual(context.currentFormat.platform, 'claude-plugin');
      
      // Step 3: Set target platform
      const withTarget = withTargetPlatform(context, 'cursor');
      assert.strictEqual(withTarget.targetPlatform, 'cursor');
      
      // Step 4: Simulate conversion
      const afterConversion = updateContextAfterConversion(
        withTarget,
        { type: 'universal', platform: undefined },
        'cursor'
      );
      
      // Verify context state
      assert.strictEqual(afterConversion.originalFormat.platform, 'claude-plugin'); // Immutable
      assert.strictEqual(afterConversion.currentFormat.type, 'universal');
      assert.strictEqual(afterConversion.conversionHistory.length, 1);
      assert.strictEqual(afterConversion.conversionHistory[0].from.platform, 'claude-plugin');
      assert.strictEqual(afterConversion.conversionHistory[0].targetPlatform, 'cursor');
      
      // Step 5: Persist to temp directory
      const tempDir = await mkdtemp(join(tmpdir(), 'test-context-'));
      try {
        await writeConversionContext(afterConversion, tempDir);
        
        // Step 6: Read back from temp directory
        const restored = await readConversionContext(tempDir);
        
        // Verify all fields preserved
        assert.strictEqual(restored.originalFormat.platform, 'claude-plugin');
        assert.strictEqual(restored.currentFormat.type, 'universal');
        assert.strictEqual(restored.targetPlatform, 'cursor');
        assert.strictEqual(restored.conversionHistory.length, 1);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
    
    it('handles universal package without conversion', async () => {
      // Universal format doesn't need conversion
      const files: PackageFile[] = [
        { path: 'commands/test.md', content: '# Test', encoding: 'utf8' },
        { path: 'agents/helper.md', content: '# Helper', encoding: 'utf8' }
      ];
      
      const format = detectPackageFormat(files);
      assert.strictEqual(format.type, 'universal');
      
      const context = createContextFromFormat(format);
      assert.strictEqual(context.originalFormat.type, 'universal');
      assert.strictEqual(context.conversionHistory.length, 0);
      
      // Even for universal, context persists through temp directory
      const tempDir = await mkdtemp(join(tmpdir(), 'test-universal-'));
      try {
        await writeConversionContext(context, tempDir);
        const restored = await readConversionContext(tempDir);
        
        assert.strictEqual(restored.originalFormat.type, 'universal');
        assert.strictEqual(restored.conversionHistory.length, 0);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
    
    it('tracks multiple conversion steps in history', async () => {
      let context = createPlatformContext('claude-plugin');
      context = withTargetPlatform(context, 'cursor');
      
      // First conversion: platform → universal
      context = updateContextAfterConversion(
        context,
        { type: 'universal', platform: undefined },
        'cursor'
      );
      
      assert.strictEqual(context.conversionHistory.length, 1);
      assert.strictEqual(context.conversionHistory[0].from.platform, 'claude-plugin');
      assert.strictEqual(context.conversionHistory[0].to.type, 'universal');
      
      // Second conversion: universal → platform (simulated)
      context = updateContextAfterConversion(
        context,
        { type: 'platform-specific', platform: 'cursor' },
        'cursor'
      );
      
      assert.strictEqual(context.conversionHistory.length, 2);
      assert.strictEqual(context.conversionHistory[1].from.type, 'universal');
      assert.strictEqual(context.conversionHistory[1].to.platform, 'cursor');
      
      // Original format never changes
      assert.strictEqual(context.originalFormat.platform, 'claude-plugin');
    });
  });
  
  describe('Temp Directory Persistence', () => {
    it('survives serialization with complex history', async () => {
      let context = createPlatformContext('claude-plugin', 1.0);
      context = withTargetPlatform(context, 'claude');
      context = updateContextAfterConversion(
        context,
        { type: 'universal', platform: undefined },
        'claude'
      );
      context = updateContextAfterConversion(
        context,
        { type: 'platform-specific', platform: 'claude' },
        'claude'
      );
      
      const tempDir = await mkdtemp(join(tmpdir(), 'test-complex-'));
      try {
        await writeConversionContext(context, tempDir);
        const restored = await readConversionContext(tempDir);
        
        assert.strictEqual(restored.conversionHistory.length, 2);
        assert.strictEqual(restored.originalFormat.platform, 'claude-plugin');
        assert.strictEqual(restored.currentFormat.platform, 'claude');
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
    
    it('handles missing context file gracefully', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'test-missing-'));
      try {
        // No context file exists - should return null
        const result = await readConversionContext(tempDir);
        assert.strictEqual(result, null);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
    
    it('handles corrupted context file gracefully', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'test-corrupt-'));
      try {
        // Write invalid JSON
        const fs = await import('fs/promises');
        await fs.writeFile(
          join(tempDir, '.opkg-conversion-context.json'),
          'invalid json {'
        );
        
        // Should return null and log warning
        const result = await readConversionContext(tempDir);
        assert.strictEqual(result, null);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
    
    it('validates context structure after deserialization', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'test-validate-'));
      try {
        // Write incomplete context
        const fs = await import('fs/promises');
        await fs.writeFile(
          join(tempDir, '.opkg-conversion-context.json'),
          JSON.stringify({ currentFormat: { type: 'universal' } })
        );
        
        // contextFromJSON should throw validation error
        const result = await readConversionContext(tempDir);
        // The function catches errors and returns null
        assert.strictEqual(result, null);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
  
  describe('Flow Variable Integration', () => {
    it('provides correct $$source for conditional flows', () => {
      const context = createPlatformContext('claude-plugin');
      
      // $$source should always be originalFormat.platform
      assert.strictEqual(context.originalFormat.platform, 'claude-plugin');
      
      // Even after conversion
      const converted = updateContextAfterConversion(
        context,
        { type: 'universal', platform: undefined },
        'cursor'
      );
      
      assert.strictEqual(converted.originalFormat.platform, 'claude-plugin');
      assert.strictEqual(converted.currentFormat.type, 'universal');
    });
    
    it('provides correct $$platform for conditional flows', () => {
      const context = withTargetPlatform(
        createPlatformContext('claude-plugin'),
        'cursor'
      );
      
      // $$platform should be targetPlatform
      assert.strictEqual(context.targetPlatform, 'cursor');
    });
    
    it('distinguishes source from target in cross-platform install', () => {
      const context = withTargetPlatform(
        createPlatformContext('claude-plugin'),
        'cursor'
      );
      
      // For claude-plugin → cursor install:
      // $$source = 'claude-plugin' (original format)
      // $$platform = 'cursor' (target platform)
      assert.strictEqual(context.originalFormat.platform, 'claude-plugin');
      assert.strictEqual(context.targetPlatform, 'cursor');
    });
  });
  
  describe('Error Handling', () => {
    it('detects originalFormat mutation attempts', async () => {
      const context = createPlatformContext('claude-plugin');
      
      // TypeScript prevents this, but verify at runtime
      const mutated: any = {
        ...context,
        originalFormat: {
          ...context.originalFormat,
          platform: 'cursor' // Changed!
        }
      };
      
      // Validation should catch this
      const { validateContextTransition } = await import('../../../src/core/conversion-context/validation.js');
      
      assert.throws(
        () => validateContextTransition(context, mutated),
        /originalFormat changed/
      );
    });
    
    it('validates conversion history consistency', () => {
      const context = createPlatformContext('claude-plugin');
      const converted = updateContextAfterConversion(
        context,
        { type: 'universal', platform: undefined },
        'cursor'
      );
      
      // History should match current format
      const lastEntry = converted.conversionHistory[converted.conversionHistory.length - 1];
      assert.strictEqual(lastEntry.to.type, converted.currentFormat.type);
      assert.strictEqual(lastEntry.to.platform, converted.currentFormat.platform);
    });
  });
});
