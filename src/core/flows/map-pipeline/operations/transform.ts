/**
 * $transform Operation
 * 
 * Pipeline transformation on a field.
 * Converts objects/arrays through a series of steps.
 */

import type { TransformOperation, TransformStep } from '../types.js';
import { getNestedValue, setNestedValue } from '../utils.js';

/**
 * Execute $transform operation
 * 
 * Example:
 * {
 *   "$transform": {
 *     "field": "tools",
 *     "steps": [
 *       { "filter": { "value": true } },
 *       { "keys": true },
 *       { "map": "capitalize" },
 *       { "join": ", " }
 *     ]
 *   }
 * }
 */
export function executeTransform(
  document: any,
  operation: TransformOperation
): any {
  const result = { ...document };
  const { field, steps } = operation.$transform;

  // Get current value
  let value = getNestedValue(result, field);

  // Apply each step in sequence
  for (const step of steps) {
    value = applyTransformStep(value, step);
  }

  // If the transformed value is an empty string or empty array, unset the field
  // This prevents fields like "tools: ''" which are semantically invalid
  if (value === '' || (Array.isArray(value) && value.length === 0)) {
    // Delete the field entirely using the utils function
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
 * Apply a single transform step
 */
function applyTransformStep(value: any, step: TransformStep): any {
  if ('filter' in step) {
    return applyFilter(value, step.filter);
  }

  if ('keys' in step) {
    return applyKeys(value);
  }

  if ('values' in step) {
    return applyValues(value);
  }

  if ('entries' in step) {
    return applyEntries(value);
  }

  if ('map' in step) {
    return applyMap(value, step.map);
  }

  if ('join' in step) {
    return applyJoin(value, step.join);
  }

  if ('split' in step) {
    return applySplit(value, step.split);
  }

  if ('arrayToObject' in step) {
    return applyArrayToObject(value, step.arrayToObject);
  }

  if ('fromEntries' in step) {
    return applyFromEntries(value);
  }

  if ('replace' in step) {
    return applyReplace(value, step.replace);
  }

  // Unknown step - return unchanged
  return value;
}

/**
 * Filter step: { "filter": { "value": true } }
 * Keeps entries where value or key matches
 */
function applyFilter(value: any, filter: { value?: any; key?: any }): any {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const result: any = {};

  for (const [key, val] of Object.entries(value)) {
    let keep = true;

    // Filter by value
    if ('value' in filter && val !== filter.value) {
      keep = false;
    }

    // Filter by key
    if ('key' in filter && key !== filter.key) {
      keep = false;
    }

    if (keep) {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Keys step: { "keys": true }
 * Extract object keys to array
 */
function applyKeys(value: any): any {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.keys(value);
}

/**
 * Values step: { "values": true }
 * Extract object values to array
 */
function applyValues(value: any): any {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.values(value);
}

/**
 * Entries step: { "entries": true }
 * Convert object to entries array [[key, value], ...]
 */
function applyEntries(value: any): any {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value);
}

/**
 * Map step: { "map": "capitalize" }
 * Transform each element in array
 */
function applyMap(value: any, transform: 'capitalize' | 'uppercase' | 'lowercase'): any {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map(item => {
    if (typeof item !== 'string') {
      return item;
    }

    switch (transform) {
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
 * Join step: { "join": ", " }
 * Join array to string
 */
function applyJoin(value: any, separator: string): any {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.join(separator);
}

/**
 * Split step: { "split": ", " }
 * Split string to array (inverse of join)
 */
function applySplit(value: any, separator: string): any {
  if (typeof value !== 'string') {
    return value;
  }

  return value.split(separator).map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * ArrayToObject step: { "arrayToObject": { "value": true } }
 * Convert array of strings to object with specified value (inverse of keys)
 * 
 * Example: ["Glob", "Grep", "LS"] -> { Glob: true, Grep: true, LS: true }
 */
function applyArrayToObject(value: any, config: { value: any }): any {
  if (!Array.isArray(value)) {
    return value;
  }

  const result: any = {};
  for (const key of value) {
    if (typeof key === 'string') {
      result[key] = config.value;
    }
  }

  return result;
}

/**
 * FromEntries step: { "fromEntries": true }
 * Convert entries array to object (inverse of entries)
 * 
 * Example: [["key1", "val1"], ["key2", "val2"]] -> { key1: "val1", key2: "val2" }
 */
function applyFromEntries(value: any): any {
  if (!Array.isArray(value)) {
    return value;
  }

  const result: any = {};
  for (const entry of value) {
    if (Array.isArray(entry) && entry.length >= 2) {
      result[entry[0]] = entry[1];
    }
  }

  return result;
}

/**
 * Replace step: { "replace": { "pattern": "...", "with": "...", "flags": "g" } }
 * String replacement using regex with capture group support
 * 
 * Examples:
 * - { "replace": { "pattern": "^anthropic/", "with": "" } }
 *   "anthropic/claude-sonnet" -> "claude-sonnet"
 * 
 * - { "replace": { "pattern": "(-[0-9]+)\\.([0-9]+)", "with": "$1-$2", "flags": "g" } }
 *   "claude-4.5" -> "claude-4-5"
 * 
 * - { "replace": { "pattern": "^(.*)$", "with": "anthropic/$1" } }
 *   "claude-sonnet" -> "anthropic/claude-sonnet"
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
 * Validate $transform operation
 */
export function validateTransform(operation: TransformOperation): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!operation.$transform || typeof operation.$transform !== 'object') {
    errors.push('$transform must be an object');
    return { valid: false, errors };
  }

  const config = operation.$transform;

  if (!config.field || typeof config.field !== 'string') {
    errors.push('$transform.field must be a non-empty string');
  }

  if (!config.steps || !Array.isArray(config.steps)) {
    errors.push('$transform.steps must be an array');
    return { valid: errors.length === 0, errors };
  }

  if (config.steps.length === 0) {
    errors.push('$transform.steps must have at least one step');
  }

  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i];
    
    if (!step || typeof step !== 'object') {
      errors.push(`$transform.steps[${i}] must be an object`);
      continue;
    }

    const stepKeys = Object.keys(step);
    if (stepKeys.length !== 1) {
      errors.push(`$transform.steps[${i}] must have exactly one operation`);
      continue;
    }

    const operation = stepKeys[0];
    const validOps = ['filter', 'keys', 'values', 'entries', 'map', 'join', 'split', 'arrayToObject', 'fromEntries', 'replace'];
    
    if (!validOps.includes(operation)) {
      errors.push(
        `$transform.steps[${i}] has unknown operation "${operation}". ` +
        `Valid: ${validOps.join(', ')}`
      );
    }

    // Validate specific operations
    if (operation === 'map') {
      const mapType = (step as any).map;
      const validMaps = ['capitalize', 'uppercase', 'lowercase'];
      if (!validMaps.includes(mapType)) {
        errors.push(
          `$transform.steps[${i}].map must be one of: ${validMaps.join(', ')}`
        );
      }
    }

    if (operation === 'join') {
      const separator = (step as any).join;
      if (typeof separator !== 'string') {
        errors.push(`$transform.steps[${i}].join must be a string`);
      }
    }

    if (operation === 'split') {
      const separator = (step as any).split;
      if (typeof separator !== 'string') {
        errors.push(`$transform.steps[${i}].split must be a string`);
      }
    }

    if (operation === 'arrayToObject') {
      const config = (step as any).arrayToObject;
      if (!config || typeof config !== 'object') {
        errors.push(`$transform.steps[${i}].arrayToObject must be an object`);
      } else if (!('value' in config)) {
        errors.push(`$transform.steps[${i}].arrayToObject must have a 'value' property`);
      }
    }

    if (operation === 'replace') {
      const config = (step as any).replace;
      if (!config || typeof config !== 'object') {
        errors.push(`$transform.steps[${i}].replace must be an object`);
      } else {
        if (typeof config.pattern !== 'string') {
          errors.push(`$transform.steps[${i}].replace.pattern must be a string`);
        }
        if (typeof config.with !== 'string') {
          errors.push(`$transform.steps[${i}].replace.with must be a string`);
        }
        if (config.flags !== undefined && typeof config.flags !== 'string') {
          errors.push(`$transform.steps[${i}].replace.flags must be a string`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
