/**
 * Manual test to verify $$targetRoot variable and path comparison logic
 */

import * as os from 'os';
import * as path from 'path';
import { smartEquals, smartNotEquals } from '../src/utils/path-comparison.js';

console.log('Testing $$targetRoot variable and path comparison logic\n');
console.log('='.repeat(60));

const homeDir = os.homedir();
console.log(`\nHome directory: ${homeDir}`);

// Test 1: Home directory comparison
console.log('\n--- Test 1: Home directory comparison ---');
const test1a = smartEquals(homeDir, '~/');
const test1b = smartEquals(homeDir, '~');
console.log(`smartEquals('${homeDir}', '~/'): ${test1a} (expected: true)`);
console.log(`smartEquals('${homeDir}', '~'): ${test1b} (expected: true)`);
console.log(`✓ ${test1a && test1b ? 'PASS' : 'FAIL'}`);

// Test 2: Non-home directory comparison
console.log('\n--- Test 2: Non-home directory comparison ---');
const workspaceDir = path.join(homeDir, 'my-project');
const test2a = smartNotEquals(workspaceDir, '~/');
const test2b = smartEquals(workspaceDir, '~/');
console.log(`smartNotEquals('${workspaceDir}', '~/'): ${test2a} (expected: true)`);
console.log(`smartEquals('${workspaceDir}', '~/'): ${test2b} (expected: false)`);
console.log(`✓ ${test2a && !test2b ? 'PASS' : 'FAIL'}`);

// Test 3: Glob pattern matching
console.log('\n--- Test 3: Glob pattern matching ---');
const tmpPath = '/tmp/test-workspace';
const test3a = smartEquals(tmpPath, '/tmp/*');
const test3b = smartEquals('/usr/local/bin', '/usr/*/bin');
console.log(`smartEquals('${tmpPath}', '/tmp/*'): ${test3a} (expected: true)`);
console.log(`smartEquals('/usr/local/bin', '/usr/*/bin'): ${test3b} (expected: true)`);
console.log(`✓ ${test3a && test3b ? 'PASS' : 'FAIL'}`);

// Test 4: Path normalization
console.log('\n--- Test 4: Path normalization ---');
const test4a = smartEquals('/usr/local/./bin', '/usr/local/bin');
const test4b = smartEquals('/usr/local/lib/../bin', '/usr/local/bin');
console.log(`smartEquals('/usr/local/./bin', '/usr/local/bin'): ${test4a} (expected: true)`);
console.log(`smartEquals('/usr/local/lib/../bin', '/usr/local/bin'): ${test4b} (expected: true)`);
console.log(`✓ ${test4a && test4b ? 'PASS' : 'FAIL'}`);

// Test 5: Simulated flow condition evaluation
console.log('\n--- Test 5: Simulated flow condition evaluation ---');
console.log('\nScenario: Installing to workspace directory');
const workspaceTarget = '/Users/john/my-project';
const shouldUseWorkspaceMCP = smartNotEquals(workspaceTarget, '~/');
const shouldUseGlobalMCP = smartEquals(workspaceTarget, '~/');
console.log(`  targetRoot: ${workspaceTarget}`);
console.log(`  Should install to .mcp.json (not home): ${shouldUseWorkspaceMCP} (expected: true)`);
console.log(`  Should install to .claude.json (is home): ${shouldUseGlobalMCP} (expected: false)`);
console.log(`  ✓ ${shouldUseWorkspaceMCP && !shouldUseGlobalMCP ? 'PASS' : 'FAIL'}`);

console.log('\nScenario: Installing to home directory (global)');
const globalTarget = homeDir;
const shouldUseWorkspaceMCP2 = smartNotEquals(globalTarget, '~/');
const shouldUseGlobalMCP2 = smartEquals(globalTarget, '~/');
console.log(`  targetRoot: ${globalTarget}`);
console.log(`  Should install to .mcp.json (not home): ${shouldUseWorkspaceMCP2} (expected: false)`);
console.log(`  Should install to .claude.json (is home): ${shouldUseGlobalMCP2} (expected: true)`);
console.log(`  ✓ ${!shouldUseWorkspaceMCP2 && shouldUseGlobalMCP2 ? 'PASS' : 'FAIL'}`);

console.log('\n' + '='.repeat(60));
console.log('\n✅ All manual tests completed!\n');
