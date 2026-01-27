import assert from 'node:assert/strict';
import type { InstallOptions } from '../../src/types/index.js';

// Test: InstallOptions accepts plugins array
{
  const options: InstallOptions = {
    plugins: ['plugin-1', 'plugin-2']
  };
  assert.deepEqual(options.plugins, ['plugin-1', 'plugin-2']);
}

// Test: plugins is optional
{
  const options: InstallOptions = {};
  assert.equal(options.plugins, undefined);
}

console.log('install-plugins-flag type tests passed');

// Test: parsePluginsOption parses comma-separated string
import { parsePluginsOption } from '../../src/commands/install.js';

{
  const result = parsePluginsOption('plugin-1,plugin-2,plugin-3');
  assert.deepEqual(result, ['plugin-1', 'plugin-2', 'plugin-3']);
}

// Test: parsePluginsOption trims whitespace
{
  const result = parsePluginsOption('plugin-1, plugin-2 , plugin-3');
  assert.deepEqual(result, ['plugin-1', 'plugin-2', 'plugin-3']);
}

// Test: parsePluginsOption handles single plugin
{
  const result = parsePluginsOption('single-plugin');
  assert.deepEqual(result, ['single-plugin']);
}

// Test: parsePluginsOption returns undefined for empty string
{
  const result = parsePluginsOption('');
  assert.equal(result, undefined);
}

// Test: parsePluginsOption returns undefined for undefined input
{
  const result = parsePluginsOption(undefined);
  assert.equal(result, undefined);
}

console.log('parsePluginsOption tests passed');
