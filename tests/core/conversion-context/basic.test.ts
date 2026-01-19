/**
 * Basic Conversion Context Tests
 * 
 * Tests for context creation, validation, and serialization.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  createContextFromFormat,
  createPlatformContext,
  createUniversalContext,
  updateContextAfterConversion,
  withTargetPlatform,
  validateNewContext,
  validateContextTransition,
  validateContextHistory,
  contextToJSON,
  contextFromJSON
} from '../../../src/core/conversion-context/index.js';
import type { PackageFormat } from '../../../src/core/install/format-detector.js';

describe('Conversion Context - Creation', () => {
  it('creates context from claude-plugin format', () => {
    const format: PackageFormat = {
      type: 'platform-specific',
      platform: 'claude-plugin',
      confidence: 1.0,
      analysis: {
        universalFiles: 0,
        platformSpecificFiles: 5,
        detectedPlatforms: new Map([['claude-plugin', 5]]),
        totalFiles: 5,
        samplePaths: {
          universal: [],
          platformSpecific: ['.claude-plugin/plugin.json']
        }
      }
    };
    
    const context = createContextFromFormat(format);
    
    assert.strictEqual(context.originalFormat.type, 'platform-specific');
    assert.strictEqual(context.originalFormat.platform, 'claude-plugin');
    assert.strictEqual(context.currentFormat.type, 'platform-specific');
    assert.strictEqual(context.currentFormat.platform, 'claude-plugin');
    assert.strictEqual(context.conversionHistory.length, 0);
    assert.strictEqual(context.targetPlatform, undefined);
  });
  
  it('creates context for universal format', () => {
    const context = createUniversalContext();
    
    assert.strictEqual(context.originalFormat.type, 'universal');
    assert.strictEqual(context.originalFormat.platform, undefined);
    assert.strictEqual(context.currentFormat.type, 'universal');
  });
  
  it('creates context for specific platform', () => {
    const context = createPlatformContext('claude', 0.95);
    
    assert.strictEqual(context.originalFormat.type, 'platform-specific');
    assert.strictEqual(context.originalFormat.platform, 'claude');
    assert.strictEqual(context.originalFormat.confidence, 0.95);
  });
});

describe('Conversion Context - Updates', () => {
  it('updates context with target platform', () => {
    const context = createPlatformContext('claude-plugin');
    const withTarget = withTargetPlatform(context, 'cursor');
    
    assert.strictEqual(withTarget.targetPlatform, 'cursor');
    // Original context unchanged
    assert.strictEqual(context.targetPlatform, undefined);
  });
  
  it('updates context after conversion', () => {
    const context = createPlatformContext('claude-plugin');
    const withTarget = withTargetPlatform(context, 'claude');
    
    const updated = updateContextAfterConversion(
      withTarget,
      { type: 'universal', platform: undefined },
      'claude'
    );
    
    // Original format unchanged
    assert.strictEqual(updated.originalFormat.platform, 'claude-plugin');
    
    // Current format updated
    assert.strictEqual(updated.currentFormat.type, 'universal');
    assert.strictEqual(updated.currentFormat.platform, undefined);
    
    // History recorded
    assert.strictEqual(updated.conversionHistory.length, 1);
    assert.strictEqual(updated.conversionHistory[0].from.platform, 'claude-plugin');
    assert.strictEqual(updated.conversionHistory[0].to.type, 'universal');
    assert.strictEqual(updated.conversionHistory[0].targetPlatform, 'claude');
  });
});

describe('Conversion Context - Validation', () => {
  it('validates new context successfully', () => {
    const context = createPlatformContext('claude-plugin');
    assert.doesNotThrow(() => validateNewContext(context));
  });
  
  it('detects missing originalFormat', () => {
    const invalidContext: any = {
      currentFormat: { type: 'universal' },
      conversionHistory: []
    };
    
    assert.throws(
      () => validateNewContext(invalidContext),
      /missing originalFormat/
    );
  });
  
  it('validates context transition', () => {
    const before = createPlatformContext('claude-plugin');
    const after = updateContextAfterConversion(
      before,
      { type: 'universal', platform: undefined },
      'claude'
    );
    
    assert.doesNotThrow(() => validateContextTransition(before, after));
  });
  
  it('detects originalFormat mutation', () => {
    const before = createPlatformContext('claude-plugin');
    const after: any = {
      ...before,
      originalFormat: {
        ...before.originalFormat,
        platform: 'cursor'  // Changed!
      }
    };
    
    assert.throws(
      () => validateContextTransition(before, after),
      /originalFormat changed/
    );
  });
  
  it('validates conversion history chain', () => {
    const context = createPlatformContext('claude-plugin');
    const step1 = updateContextAfterConversion(
      context,
      { type: 'universal', platform: undefined },
      'claude'
    );
    
    assert.doesNotThrow(() => validateContextHistory(step1));
  });
});

describe('Conversion Context - Serialization', () => {
  it('serializes and deserializes context', () => {
    const original = createPlatformContext('claude-plugin');
    const withHistory = updateContextAfterConversion(
      original,
      { type: 'universal', platform: undefined },
      'claude'
    );
    
    const json = contextToJSON(withHistory);
    const restored = contextFromJSON(json);
    
    assert.strictEqual(restored.originalFormat.platform, 'claude-plugin');
    assert.strictEqual(restored.currentFormat.type, 'universal');
    assert.strictEqual(restored.conversionHistory.length, 1);
    assert.strictEqual(restored.conversionHistory[0].targetPlatform, 'claude');
  });
  
  it('round-trip preserves dates', () => {
    const original = createPlatformContext('claude-plugin');
    const json = contextToJSON(original);
    const restored = contextFromJSON(json);
    
    assert.ok(restored.originalFormat.detectedAt instanceof Date);
    assert.strictEqual(
      restored.originalFormat.detectedAt.toISOString(),
      original.originalFormat.detectedAt.toISOString()
    );
  });
  
  it('validates deserialized context', () => {
    const original = createPlatformContext('claude-plugin');
    const json = contextToJSON(original);
    
    // Should not throw - validation happens during deserialization
    assert.doesNotThrow(() => contextFromJSON(json));
  });
});

describe('Conversion Context - Immutability', () => {
  it('originalFormat is readonly at type level', () => {
    const context = createPlatformContext('claude-plugin');
    
    // TypeScript prevents mutation at compile time
    // This test verifies the type definition exists and is readonly
    
    // @ts-expect-error - Should fail TypeScript compilation
    const attempt = () => { context.originalFormat = {} as any; };
    
    // At runtime, the assignment might succeed (JavaScript doesn't enforce readonly)
    // but TypeScript catches it at compile time, which is what matters
    assert.ok(context.originalFormat);
    assert.strictEqual(context.originalFormat.platform, 'claude-plugin');
  });
  
  it('context updates create new objects', () => {
    const context = createPlatformContext('claude-plugin');
    const updated = withTargetPlatform(context, 'claude');
    
    // Should be different objects
    assert.notStrictEqual(context, updated);
    
    // Original unchanged
    assert.strictEqual(context.targetPlatform, undefined);
    assert.strictEqual(updated.targetPlatform, 'claude');
  });
});
