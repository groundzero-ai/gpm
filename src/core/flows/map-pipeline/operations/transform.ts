/**
 * $pipeline Operation (MongoDB-aligned)
 * 
 * Pipeline transformation on a field.
 * Renamed from $transform for better MongoDB alignment.
 * All sub-operations now use $ prefix.
 */

import type { PipelineOperation, PipelineStep, MapContext } from '../types.js';
import { getNestedValue, setNestedValue } from '../utils.js';
import { resolveValue } from '../context.js';

/**
 * Execute $pipeline operation
 * 
 * Example:
 * {
 *   "$pipeline": {
 *     "field": "tools",
 *     "operations": [
 *       { "$filter": { "match": { "value": true } } },
 *       { "$objectToArray": { "extract": "keys" } },
 *       { "$map": { "each": "capitalize" } },
 *       { "$reduce": { "type": "join", "separator": ", " } }
 *     ]
 *   }
 * }
 */
export function executePipeline(
  document: any,
  operation: PipelineOperation,
  context: MapContext
): any {
  const result = { ...document };
  const { field, operations } = operation.$pipeline;

  // Get current value
  let value = getNestedValue(result, field);

  // Apply each operation in sequence
  for (const step of operations) {
    value = applyPipelineStep(value, step, context);
  }

  // If the transformed value is an empty string or empty array, unset the field
  // This prevents fields like "tools: ''" which are semantically invalid
  if (value === '' || (Array.isArray(value) && value.length === 0)) {
    // Delete the field entirely
    const pathParts = field.split('.');
    if (pathParts.length === 1) {
      delete result[field];
    } else {
      // For nested paths, we need to navigate and delete
      let current = result;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!(pathParts[i] in current)) {
          return result; // Path doesn't exist, nothing to delete
        }
        current = current[pathParts[i]];
      }
      delete current[pathParts[pathParts.length - 1]];
    }
  } else {
    // Set transformed value
    setNestedValue(result, field, value);
  }

  return result;
}

/**
 * Apply a single pipeline step
 */
function applyPipelineStep(value: any, step: PipelineStep, context: MapContext): any {
  if ('$filter' in step) {
    return applyFilter(value, step.$filter);
  }

  if ('$objectToArray' in step) {
    return applyObjectToArray(value, step.$objectToArray);
  }

  if ('$arrayToObject' in step) {
    return applyArrayToObject(value, step.$arrayToObject, context);
  }

  if ('$map' in step) {
    return applyMap(value, step.$map);
  }

  if ('$reduce' in step) {
    return applyReduce(value, step.$reduce);
  }

  if ('$replace' in step) {
    return applyReplace(value, step.$replace);
  }

  // Unknown step - return unchanged
  return value;
}

/**
 * $filter step: { "$filter": { "match": { "value": true } } }
 * Keeps entries where value or key matches
 * Matches MongoDB $filter semantics
 */
function applyFilter(value: any, config: { match?: { value?: any; key?: any } }): any {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const result: any = {};
  const match = config.match || {};

  for (const [key, val] of Object.entries(value)) {
    let keep = true;

    // Filter by value
    if ('value' in match && val !== match.value) {
      keep = false;
    }

    // Filter by key
    if ('key' in match && key !== match.key) {
      keep = false;
    }

    if (keep) {
      result[key] = val;
    }
  }

  return result;
}

/**
 * $objectToArray step (matches MongoDB $objectToArray)
 * 
 * Examples:
 * - { "$objectToArray": { "extract": "keys" } }      → ["a", "b"]
 * - { "$objectToArray": { "extract": "values" } }    → [1, 2]
 * - { "$objectToArray": { "extract": "entries" } }   → [["a", 1], ["b", 2]]
 * - { "$objectToArray": true }                       → [["a", 1], ["b", 2]] (default)
 */
function applyObjectToArray(
  value: any, 
  config: true | { extract?: 'keys' | 'values' | 'entries' }
): any {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  // Handle boolean shorthand
  if (config === true) {
    return Object.entries(value);
  }

  const extract = config.extract || 'entries';

  switch (extract) {
    case 'keys':
      return Object.keys(value);
    case 'values':
      return Object.values(value);
    case 'entries':
      return Object.entries(value);
    default:
      return Object.entries(value);
  }
}

/**
 * $arrayToObject step (matches MongoDB $arrayToObject)
 * Convert array of strings to object with specified value
 * 
 * Examples:
 * - { "$arrayToObject": { "value": true } }
 *   ["bash", "read"] → { bash: true, read: true }
 * 
 * - { "$arrayToObject": { "value": "$$filename" } }
 *   ["tool1", "tool2"] → { tool1: "code-reviewer", tool2: "code-reviewer" }
 */
function applyArrayToObject(value: any, config: { value: any }, context: MapContext): any {
  if (!Array.isArray(value)) {
    return value;
  }

  // Resolve context variables in the value
  const resolvedValue = resolveValue(config.value, context);

  const result: any = {};
  for (const key of value) {
    if (typeof key === 'string') {
      result[key] = resolvedValue;
    }
  }

  return result;
}

/**
 * $map step (matches MongoDB $map)
 * Transform each element in array
 * 
 * Examples:
 * - { "$map": { "each": "capitalize" } }
 * - { "$map": { "each": "uppercase" } }
 * - { "$map": { "each": "lowercase" } }
 */
function applyMap(value: any, config: { each: 'capitalize' | 'uppercase' | 'lowercase' }): any {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map(item => {
    if (typeof item !== 'string') {
      return item;
    }

    switch (config.each) {
      case 'capitalize':
        return item.charAt(0).toUpperCase() + item.slice(1);
      case 'uppercase':
        return item.toUpperCase();
      case 'lowercase':
        return item.toLowerCase();
      default:
        return item;
    }
  });
}

/**
 * $reduce step (inspired by MongoDB $reduce)
 * Reduces array using common patterns
 * 
 * Examples:
 * - { "$reduce": { "type": "join", "separator": ", " } }   → "a, b, c"
 * - { "$reduce": { "type": "split", "separator": ", " } }  → ["a", "b", "c"]
 * - { "$reduce": { "type": "sum" } }                       → 6
 * - { "$reduce": { "type": "count" } }                     → 3
 */
function applyReduce(
  value: any, 
  config: { type: 'join' | 'split' | 'sum' | 'count'; separator?: string }
): any {
  const { type, separator = '' } = config;

  switch (type) {
    case 'join':
      // Join array to string
      if (!Array.isArray(value)) {
        return value;
      }
      return value.join(separator);

    case 'split':
      // Split string to array (inverse of join)
      if (typeof value !== 'string') {
        return value;
      }
      return value.split(separator).map(s => s.trim()).filter(s => s.length > 0);

    case 'sum':
      // Sum array of numbers
      if (!Array.isArray(value)) {
        return value;
      }
      return value.reduce((sum, n) => sum + (Number(n) || 0), 0);

    case 'count':
      // Count array elements
      if (!Array.isArray(value)) {
        return 0;
      }
      return value.length;

    default:
      return value;
  }
}

/**
 * $replace step (similar to MongoDB $replaceOne/$replaceAll)
 * String replacement using regex with capture group support
 * 
 * Examples:
 * - { "$replace": { "pattern": "^anthropic/", "with": "" } }
 *   "anthropic/claude-sonnet" → "claude-sonnet"
 * 
 * - { "$replace": { "pattern": "(-[0-9]+)\\.([0-9]+)", "with": "$1-$2", "flags": "g" } }
 *   "claude-4.5" → "claude-4-5"
 * 
 * - { "$replace": { "pattern": "^(.*)$", "with": "anthropic/$1" } }
 *   "claude-sonnet" → "anthropic/claude-sonnet"
 */
function applyReplace(
  value: any, 
  config: { pattern: string; with: string; flags?: string }
): any {
  if (typeof value !== 'string') {
    return value;
  }

  const flags = config.flags || '';
  const regex = new RegExp(config.pattern, flags);
  
  return value.replace(regex, config.with);
}


/**
 * Validate $pipeline operation
 */
export function validatePipeline(operation: PipelineOperation): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!operation.$pipeline || typeof operation.$pipeline !== 'object') {
    errors.push('$pipeline must be an object');
    return { valid: false, errors };
  }

  const config = operation.$pipeline;

  if (!config.field || typeof config.field !== 'string') {
    errors.push('$pipeline.field must be a non-empty string');
  }

  if (!config.operations || !Array.isArray(config.operations)) {
    errors.push('$pipeline.operations must be an array');
    return { valid: errors.length === 0, errors };
  }

  if (config.operations.length === 0) {
    errors.push('$pipeline.operations must have at least one operation');
  }

  for (let i = 0; i < config.operations.length; i++) {
    const step = config.operations[i];
    
    if (!step || typeof step !== 'object') {
      errors.push(`$pipeline.operations[${i}] must be an object`);
      continue;
    }

    const stepKeys = Object.keys(step);
    if (stepKeys.length !== 1) {
      errors.push(`$pipeline.operations[${i}] must have exactly one operation`);
      continue;
    }

    const operation = stepKeys[0];
    const validOps = ['$filter', '$objectToArray', '$arrayToObject', '$map', '$reduce', '$replace'];
    
    if (!validOps.includes(operation)) {
      errors.push(
        `$pipeline.operations[${i}] has unknown operation "${operation}". ` +
        `Valid: ${validOps.join(', ')}`
      );
    }

    // Validate specific operations
    if (operation === '$filter') {
      const filterConfig = (step as any).$filter;
      if (filterConfig && typeof filterConfig === 'object' && filterConfig.match) {
        const match = filterConfig.match;
        if (typeof match !== 'object') {
          errors.push(`$pipeline.operations[${i}].$filter.match must be an object`);
        }
      }
    }

    if (operation === '$objectToArray') {
      const config = (step as any).$objectToArray;
      if (config !== true && typeof config !== 'object') {
        errors.push(`$pipeline.operations[${i}].$objectToArray must be true or an object`);
      } else if (typeof config === 'object' && config.extract) {
        const validExtracts = ['keys', 'values', 'entries'];
        if (!validExtracts.includes(config.extract)) {
          errors.push(
            `$pipeline.operations[${i}].$objectToArray.extract must be one of: ${validExtracts.join(', ')}`
          );
        }
      }
    }

    if (operation === '$arrayToObject') {
      const config = (step as any).$arrayToObject;
      if (!config || typeof config !== 'object') {
        errors.push(`$pipeline.operations[${i}].$arrayToObject must be an object`);
      } else if (!('value' in config)) {
        errors.push(`$pipeline.operations[${i}].$arrayToObject must have a 'value' property`);
      }
    }

    if (operation === '$map') {
      const config = (step as any).$map;
      if (!config || typeof config !== 'object') {
        errors.push(`$pipeline.operations[${i}].$map must be an object`);
      } else if (!config.each) {
        errors.push(`$pipeline.operations[${i}].$map must have an 'each' property`);
      } else {
        const validMaps = ['capitalize', 'uppercase', 'lowercase'];
        if (!validMaps.includes(config.each)) {
          errors.push(
            `$pipeline.operations[${i}].$map.each must be one of: ${validMaps.join(', ')}`
          );
        }
      }
    }

    if (operation === '$reduce') {
      const config = (step as any).$reduce;
      if (!config || typeof config !== 'object') {
        errors.push(`$pipeline.operations[${i}].$reduce must be an object`);
      } else if (!config.type) {
        errors.push(`$pipeline.operations[${i}].$reduce must have a 'type' property`);
      } else {
        const validTypes = ['join', 'split', 'sum', 'count'];
        if (!validTypes.includes(config.type)) {
          errors.push(
            `$pipeline.operations[${i}].$reduce.type must be one of: ${validTypes.join(', ')}`
          );
        }
        if ((config.type === 'join' || config.type === 'split') && config.separator !== undefined && typeof config.separator !== 'string') {
          errors.push(`$pipeline.operations[${i}].$reduce.separator must be a string`);
        }
      }
    }

    if (operation === '$replace') {
      const config = (step as any).$replace;
      if (!config || typeof config !== 'object') {
        errors.push(`$pipeline.operations[${i}].$replace must be an object`);
      } else {
        if (typeof config.pattern !== 'string') {
          errors.push(`$pipeline.operations[${i}].$replace.pattern must be a string`);
        }
        if (typeof config.with !== 'string') {
          errors.push(`$pipeline.operations[${i}].$replace.with must be a string`);
        }
        if (config.flags !== undefined && typeof config.flags !== 'string') {
          errors.push(`$pipeline.operations[${i}].$replace.flags must be a string`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
