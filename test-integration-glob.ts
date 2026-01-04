/**
 * Integration test: Verify platforms.jsonc loads correctly with glob patterns
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPlatformDefinition, clearPlatformsCache } from './src/core/platforms.js';
import { DefaultFlowExecutor } from './src/core/flows/flow-executor.js';
import type { FlowContext } from './src/types/flows.js';

const testRoot = join(tmpdir(), 'opkg-integration-glob');
const packageRoot = join(testRoot, 'package');
const workspaceRoot = join(testRoot, 'workspace');

async function setup() {
  clearPlatformsCache();
  
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(workspaceRoot, { recursive: true });
  
  // Create test files matching built-in platform flows
  await fs.mkdir(join(packageRoot, 'rules'), { recursive: true });
  await fs.writeFile(join(packageRoot, 'rules/typescript.md'), '# TypeScript Rules', 'utf8');
  await fs.writeFile(join(packageRoot, 'rules/python.md'), '# Python Rules', 'utf8');
  
  await fs.mkdir(join(packageRoot, 'commands'), { recursive: true });
  await fs.writeFile(join(packageRoot, 'commands/deploy.md'), '# Deploy Command', 'utf8');
  
  console.log('✅ Setup complete');
}

async function testCursorPlatform() {
  console.log('\n🧪 Testing Cursor platform with glob patterns...');
  
  const cursorDef = getPlatformDefinition('cursor');
  console.log(`  Platform name: ${cursorDef.name}`);
  console.log(`  Root dir: ${cursorDef.rootDir}`);
  console.log(`  Number of flows: ${cursorDef.flows?.length || 0}`);
  
  // Check that flows use glob patterns
  const rulesFlow = cursorDef.flows?.find(f => f.from.includes('rules'));
  console.log(`  Rules flow from: ${rulesFlow?.from}`);
  console.log(`  Rules flow to: ${rulesFlow?.to}`);
  
  if (rulesFlow?.from.includes('*')) {
    console.log('✅ Cursor platform uses glob patterns');
  } else {
    console.log('❌ Cursor platform does NOT use glob patterns');
    throw new Error('Cursor platform should use glob patterns');
  }
  
  // Execute the flow
  const executor = new DefaultFlowExecutor();
  const context: FlowContext = {
    packageRoot,
    workspaceRoot,
    platform: 'cursor',
    packageName: '@test/integration',
    direction: 'install',
    variables: {},
  };
  
  if (rulesFlow) {
    const result = await executor.executeFlow(rulesFlow, context);
    console.log(`  Flow execution: ${result.success ? '✅ Success' : '❌ Failed'}`);
    
    if (result.success) {
      // Check files were created
      const files = await fs.readdir(join(workspaceRoot, '.cursor/rules'));
      console.log(`  Files created: ${files.join(', ')}`);
      
      if (files.includes('typescript.mdc') && files.includes('python.mdc')) {
        console.log('✅ Extension transformation working (.md → .mdc)');
      } else {
        throw new Error('Extension transformation failed');
      }
    } else {
      throw new Error(`Flow execution failed: ${result.error?.message}`);
    }
  }
}

async function testAntigravityPlatform() {
  console.log('\n🧪 Testing Antigravity platform (commands → workflows)...');
  
  const antigravityDef = getPlatformDefinition('antigravity');
  const commandsFlow = antigravityDef.flows?.find(f => f.from.includes('commands'));
  
  console.log(`  Commands flow from: ${commandsFlow?.from}`);
  console.log(`  Commands flow to: ${commandsFlow?.to}`);
  
  if (commandsFlow) {
    const executor = new DefaultFlowExecutor();
    const context: FlowContext = {
      packageRoot,
      workspaceRoot,
      platform: 'antigravity',
      packageName: '@test/integration',
      direction: 'install',
      variables: {},
    };
    
    const result = await executor.executeFlow(commandsFlow, context);
    console.log(`  Flow execution: ${result.success ? '✅ Success' : '❌ Failed'}`);
    
    if (result.success) {
      const files = await fs.readdir(join(workspaceRoot, '.agent/workflows'));
      console.log(`  Files created: ${files.join(', ')}`);
      
      if (files.includes('deploy.md')) {
        console.log('✅ Directory mapping working (commands → workflows)');
      } else {
        throw new Error('Directory mapping failed');
      }
    }
  }
}

async function testGlobalFlow() {
  console.log('\n🧪 Testing global flow (AGENTS.md)...');
  
  // Create AGENTS.md in package
  await fs.writeFile(join(packageRoot, 'AGENTS.md'), '# Universal Agent Instructions', 'utf8');
  
  // Create AGENTS.md in workspace (condition requirement)
  await fs.writeFile(join(workspaceRoot, 'AGENTS.md'), '# Existing', 'utf8');
  
  // Get global flows from built-in config
  const { getPlatformsConfig } = await import('./src/core/platforms.js');
  const config = getPlatformsConfig();
  
  if (config.global?.flows) {
    console.log(`  Number of global flows: ${config.global.flows.length}`);
    
    const agentsFlow = config.global.flows.find(f => f.from === 'AGENTS.md');
    if (agentsFlow) {
      console.log(`  AGENTS.md flow to: ${agentsFlow.to}`);
      
      if (agentsFlow.to === 'AGENTS.md') {
        console.log('✅ Global flow uses explicit file mapping (no {rootFile})');
      } else {
        throw new Error('Global flow should use explicit file mapping');
      }
      
      // Execute flow
      const executor = new DefaultFlowExecutor();
      const context: FlowContext = {
        packageRoot,
        workspaceRoot,
        platform: 'cursor',
        packageName: '@test/integration',
        direction: 'install',
        variables: {},
      };
      
      const result = await executor.executeFlow(agentsFlow, context);
      console.log(`  Flow execution: ${result.success ? '✅ Success' : '❌ Failed'}`);
      
      if (result.success) {
        const content = await fs.readFile(join(workspaceRoot, 'AGENTS.md'), 'utf8');
        if (content === '# Universal Agent Instructions') {
          console.log('✅ Global flow executed correctly');
        } else {
          throw new Error('Global flow content mismatch');
        }
      }
    }
  }
}

async function cleanup() {
  await fs.rm(testRoot, { recursive: true, force: true });
  console.log('\n🧹 Cleanup complete');
}

console.log('🚀 Starting integration tests for glob patterns...\n');

setup()
  .then(testCursorPlatform)
  .then(testAntigravityPlatform)
  .then(testGlobalFlow)
  .then(() => {
    console.log('\n✅ All integration tests passed!');
  })
  .catch((error) => {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  })
  .finally(cleanup);
