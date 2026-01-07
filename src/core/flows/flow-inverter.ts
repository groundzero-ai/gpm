/**
 * Flow Inverter Module
 * 
 * Inverts flow transformations to enable platform → universal conversions.
 * Key for converting Claude plugins and other platform-specific packages.
 */

import type { Flow } from '../../types/flows.js';
import type { Operation } from './map-pipeline/types.js';
import type { Platform } from '../platforms.js';
import { logger } from '../../utils/logger.js';

/**
 * Inverted flow with metadata
 */
export interface InvertedFlow extends Flow {
  _inverted: true;
  _originalFlow: Flow;
  _sourcePlatform: Platform;
}

/**
 * Invert a flow to reverse its transformation
 * 
 * Example:
 * Original: { from: "commands/**\/*.md", to: ".claude/commands/**\/*.md" }
 * Inverted: { from: ".claude/commands/**\/*.md", to: "commands/**\/*.md" }
 */
export function invertFlow(flow: Flow, sourcePlatform: Platform): InvertedFlow {
  logger.debug('Inverting flow', { 
    from: flow.from, 
    to: flow.to,
    sourcePlatform 
  });
  
  // Handle multi-target flows (not common for inversion, but supported)
  if (typeof flow.to !== 'string') {
    logger.warn('Multi-target flow inversion not fully supported', { flow });
    // For multi-target, invert the first target only
    const firstTarget = Object.keys(flow.to)[0];
    const firstOptions = flow.to[firstTarget];
    
    return {
      ...flow,
      from: firstTarget,
      to: flow.from,
      map: invertMapOperations(flow.map || firstOptions.map),
      pipe: invertPipeTransforms(flow.pipe || firstOptions.pipe),
      embed: undefined,  // Embedding becomes extraction
      section: undefined,
      _inverted: true,
      _originalFlow: flow,
      _sourcePlatform: sourcePlatform
    };
  }
  
  // Simple single-target flow inversion
  const inverted: InvertedFlow = {
    from: flow.to as string,
    to: flow.from,
    
    // Invert map operations
    map: invertMapOperations(flow.map),
    
    // Invert pipe transforms
    pipe: invertPipeTransforms(flow.pipe),
    
    // Preserve merge strategy (applies in reverse context)
    merge: flow.merge,
    
    // Remove embed/section (these become extractions in reverse)
    embed: undefined,
    section: undefined,
    
    // Preserve conditional logic
    when: flow.when,
    
    // Mark as inverted with metadata
    _inverted: true,
    _originalFlow: flow,
    _sourcePlatform: sourcePlatform
  };
  
  logger.debug('Flow inverted', {
    originalFrom: flow.from,
    originalTo: flow.to,
    invertedFrom: inverted.from,
    invertedTo: inverted.to
  });
  
  return inverted;
}

/**
 * Invert map operations
 */
function invertMapOperations(operations?: Operation[]): Operation[] | undefined {
  if (!operations || operations.length === 0) {
    return undefined;
  }
  
  // Process operations in reverse order
  const inverted: Operation[] = [];
  
  for (let i = operations.length - 1; i >= 0; i--) {
    const op = operations[i];
    const invertedOp = invertMapOperation(op);
    if (invertedOp) {
      inverted.push(invertedOp);
    }
  }
  
  return inverted.length > 0 ? inverted : undefined;
}

/**
 * Invert a single map operation
 */
function invertMapOperation(operation: Operation): Operation | null {
  // $rename: swap keys
  if ('$rename' in operation) {
    const renamed = operation.$rename;
    const inverted: Record<string, string> = {};
    
    for (const [oldKey, newKey] of Object.entries(renamed)) {
      // Type assertion since we know newKey is a string from Record<string, string>
      inverted[newKey as string] = oldKey;
    }
    
    return { $rename: inverted };
  }
  
  // $set: Cannot reliably invert without knowing original values
  // We skip $set in inversion as it's often context-dependent
  if ('$set' in operation) {
    logger.debug('Skipping $set operation in inversion (not reversible)');
    return null;
  }
  
  // $unset: Cannot invert (we don't know what was removed)
  if ('$unset' in operation) {
    logger.debug('Skipping $unset operation in inversion (not reversible)');
    return null;
  }
  
  // $switch: Reverse pattern matching
  if ('$switch' in operation) {
    const switchOp = operation.$switch;
    
    // Invert by swapping patterns and values
    const invertedCases = switchOp.cases.map((c: { pattern: any; value: any }) => ({
      pattern: c.value,
      value: c.pattern
    }));
    
    return {
      $switch: {
        field: switchOp.field,
        cases: invertedCases,
        default: switchOp.default
      }
    };
  }
  
  // $transform: Invert the transformation pipeline
  if ('$transform' in operation) {
    const transformOp = operation.$transform;
    const invertedSteps = invertTransformSteps(transformOp.steps);
    
    if (!invertedSteps || invertedSteps.length === 0) {
      logger.debug('Could not invert $transform operation', { field: transformOp.field });
      return null;
    }
    
    return {
      $transform: {
        field: transformOp.field,
        steps: invertedSteps
      }
    };
  }
  
  // $copy: Reverse source and destination
  if ('$copy' in operation) {
    const copyOp = operation.$copy;
    const inverted: any = {
      $copy: {
        from: copyOp.to,
        to: copyOp.from
      }
    };
    
    // Only include transform if it exists
    if (copyOp.transform) {
      inverted.$copy.transform = copyOp.transform;
    }
    
    return inverted;
  }
  
  logger.debug('Unknown map operation type, skipping inversion', { operation });
  return null;
}

/**
 * Invert transform steps for $transform operation
 * 
 * Example forward transformation:
 *   { filter: { value: true } } -> { keys: true } -> { join: ", " }
 *   Transforms: { Glob: true, Grep: true } -> ["Glob", "Grep"] -> "Glob, Grep"
 * 
 * Inverted transformation:
 *   { split: ", " } -> { arrayToObject: { value: true } }
 *   Transforms: "Glob, Grep" -> ["Glob", "Grep"] -> { Glob: true, Grep: true }
 */
function invertTransformSteps(steps: any[]): any[] | null {
  if (!steps || steps.length === 0) {
    return null;
  }
  
  // Check if first step is a negative lookahead (conditional filter)
  // If so, we'll need to handle prefix addition differently
  const hasConditionalFilter = steps.length > 0 && 
    'replace' in steps[0] && 
    steps[0].replace.pattern.includes('(?!');
  
  // Build inverted steps in reverse order
  const inverted: any[] = [];
  
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    
    // Invert join: split on the same separator
    if ('join' in step) {
      inverted.push({ split: step.join });
      continue;
    }
    
    // Invert keys: convert array to object with specified value
    // The previous step (before keys) should be filter with a specific value
    // We'll default to true if not found
    if ('keys' in step) {
      // Look ahead to find the filter value (it's before keys in forward, after in reverse)
      let filterValue = true;
      if (i > 0 && 'filter' in steps[i - 1]) {
        filterValue = steps[i - 1].filter.value ?? true;
      }
      
      inverted.push({ 
        arrayToObject: { 
          value: filterValue 
        } 
      });
      continue;
    }
    
    // Skip filter in inversion (it's handled by arrayToObject)
    if ('filter' in step) {
      continue;
    }
    
    // Invert map transformations
    if ('map' in step) {
      const mapType = step.map;
      // Can't reliably invert capitalize/uppercase/lowercase without original case info
      // Skip these for now
      logger.debug(`Cannot invert map transformation: ${mapType}`);
      continue;
    }
    
    // Values: cannot reliably invert (lose keys)
    if ('values' in step) {
      logger.debug('Cannot invert values transformation (keys lost)');
      return null;
    }
    
    // Entries: invert to object
    if ('entries' in step) {
      inverted.push({ fromEntries: true });
      continue;
    }
    
    // Replace: attempt to invert regex replacement
    if ('replace' in step) {
      const invertedReplace = invertReplaceStep(step.replace, hasConditionalFilter, i);
      if (invertedReplace) {
        inverted.push({ replace: invertedReplace });
      } else {
        // Check if this was intentionally skipped (not an error)
        const wasSkipped = hasConditionalFilter && i === 1 && 
          step.replace.pattern.startsWith('^') && step.replace.with === '';
        
        if (!wasSkipped) {
          logger.debug('Cannot invert replace step', { step });
          return null;
        }
        // If skipped intentionally, just continue without adding to inverted
      }
      continue;
    }
    
    // Unknown step
    logger.debug('Unknown transform step, cannot invert', { step });
  }
  
  return inverted.length > 0 ? inverted : null;
}

/**
 * Invert a replace step
 * 
 * Handles common patterns:
 * 1. Prefix removal: "^prefix" -> "" becomes "^" -> "prefix"
 * 2. Suffix removal: "suffix$" -> "" becomes "$" -> "suffix"
 * 3. Character substitution with capture: "(-[0-9]+)\\.([0-9]+)" -> "$1-$2" becomes "(-[0-9]+)-([0-9]+)" -> "$1.$2"
 * 4. Wrapping: "^(.*)$" -> "prefix$1suffix" becomes "^prefix(.*)suffix$" -> "$1"
 */
function invertReplaceStep(
  replace: { pattern: string; with: string; flags?: string },
  hasConditionalFilter?: boolean,
  stepIndex?: number
): { pattern: string; with: string; flags?: string } | null {
  const { pattern, with: withStr, flags } = replace;
  
  // Pattern 0: Negative lookahead that sets non-matches to a constant
  // e.g., "^(?!anthropic/).*$" -> "default"
  // In reverse: We need to NOT add prefix to the constant value
  // Invert to: if NOT constant, add back the excluded prefix; if constant, keep as-is
  if (pattern.includes('(?!') && withStr !== '') {
    // Extract what we're NOT matching (the excluded pattern)
    const notMatch = pattern.match(/\(\?!([^)]+)\)/);
    if (notMatch) {
      // The excluded pattern is what should be added back in reverse
      // But only for non-constant values
      // Return a replacement that adds prefix to everything EXCEPT the constant
      return {
        pattern: `^(?!${escapeRegex(withStr)})(.*)$`,
        with: `${notMatch[1]}$1`,
        flags
      };
    }
  }
  
  // Pattern 1: Prefix removal "^anthropic/" -> ""
  if (pattern.startsWith('^') && withStr === '') {
    // If there's a conditional filter at the start, skip this unconditional prefix addition
    // because the conditional inversion will handle it
    if (hasConditionalFilter && stepIndex === 1) {
      logger.debug('Skipping unconditional prefix addition (handled by conditional filter)');
      return null;
    }
    
    const prefix = pattern.slice(1); // Remove ^
    return {
      pattern: '^',
      with: prefix,
      flags
    };
  }
  
  // Pattern 2: Suffix removal "suffix$" -> ""
  if (pattern.endsWith('$') && withStr === '') {
    const suffix = pattern.slice(0, -1); // Remove $
    return {
      pattern: '$',
      with: suffix,
      flags
    };
  }
  
  // Pattern 3: Character substitution in capture groups
  // e.g., "(-[0-9]+)\\.([0-9]+)" -> "$1-$2" inverts to "(-[0-9]+)-([0-9]+)" -> "$1.$2"
  if (pattern.includes('\\') && withStr.includes('$')) {
    // Try to swap escaped characters in pattern with characters in replacement
    // This is heuristic-based for common cases
    
    // Check if it's a dot-to-dash conversion (pattern has \., replacement has -)
    if (pattern.includes('\\.') && withStr.includes('-') && !withStr.includes('\\.')) {
      const invertedPattern = pattern.replace(/\\\./g, '-');
      const invertedWith = withStr.replace(/-/g, '.');
      return {
        pattern: invertedPattern,
        with: invertedWith,
        flags
      };
    }
    
    // Check if it's a dash-to-dot conversion (pattern has -, replacement has .)
    if (pattern.includes('-') && withStr.includes('.') && !pattern.includes('\\.')) {
      const invertedPattern = pattern.replace(/-/g, '\\.');
      const invertedWith = withStr.replace(/\./g, '-');
      return {
        pattern: invertedPattern,
        with: invertedWith,
        flags
      };
    }
  }
  
  // Pattern 4: Wrapping with full capture "^(.*)$" -> "prefix$1" or "$1suffix"
  if (pattern === '^(.*)$') {
    // Check if we're adding a prefix
    if (withStr.startsWith('$1')) {
      // Adding suffix, remove it
      const suffix = withStr.slice(2); // Remove $1
      return {
        pattern: `^(.*)${escapeRegex(suffix)}$`,
        with: '$1',
        flags
      };
    } else if (withStr.endsWith('$1')) {
      // Adding prefix, remove it
      const prefix = withStr.slice(0, -2); // Remove $1
      return {
        pattern: `^${escapeRegex(prefix)}(.*)$`,
        with: '$1',
        flags
      };
    }
  }
  
  // Pattern 5: Prefix addition "^" -> "prefix"
  if (pattern === '^' && withStr !== '') {
    return {
      pattern: `^${escapeRegex(withStr)}`,
      with: '',
      flags
    };
  }
  
  // Pattern 6: Suffix addition "$" -> "suffix"
  if (pattern === '$' && withStr !== '') {
    return {
      pattern: `${escapeRegex(withStr)}$`,
      with: '',
      flags
    };
  }
  
  // Cannot invert this replacement
  logger.debug('Cannot invert replace step automatically', { pattern, with: withStr });
  return null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Invert pipe transforms
 */
function invertPipeTransforms(pipe?: string[]): string[] | undefined {
  if (!pipe || pipe.length === 0) {
    return undefined;
  }
  
  // Most transforms are idempotent or don't need inversion
  // Format converters (jsonc, yaml, toml) work bidirectionally
  // Filtering transforms should be skipped in reverse
  
  const inverted: string[] = [];
  
  for (const transform of pipe) {
    // Format converters: keep as-is (bidirectional)
    if (['jsonc', 'yaml', 'toml', 'xml', 'ini'].includes(transform)) {
      inverted.push(transform);
      continue;
    }
    
    // Merge transforms: keep as-is
    if (['merge', 'merge-shallow', 'replace'].includes(transform)) {
      inverted.push(transform);
      continue;
    }
    
    // Filtering: skip in reverse (we don't want to filter in reverse)
    if (transform.startsWith('filter-')) {
      logger.debug(`Skipping filter transform in inversion: ${transform}`);
      continue;
    }
    
    // Markdown transforms: keep as-is
    if (['sections', 'frontmatter', 'body'].includes(transform)) {
      inverted.push(transform);
      continue;
    }
    
    // Validation: skip in reverse
    if (transform.startsWith('validate')) {
      logger.debug(`Skipping validation transform in inversion: ${transform}`);
      continue;
    }
    
    // Unknown transform: keep as-is with warning
    logger.debug(`Unknown transform type, keeping as-is: ${transform}`);
    inverted.push(transform);
  }
  
  return inverted.length > 0 ? inverted : undefined;
}

/**
 * Check if a flow is inverted
 */
export function isInvertedFlow(flow: Flow): flow is InvertedFlow {
  return '_inverted' in flow && flow._inverted === true;
}

/**
 * Get original flow from inverted flow
 */
export function getOriginalFlow(flow: InvertedFlow): Flow {
  return flow._originalFlow;
}

/**
 * Batch invert multiple flows
 */
export function invertFlows(flows: Flow[], sourcePlatform: Platform): InvertedFlow[] {
  return flows.map(flow => invertFlow(flow, sourcePlatform));
}
