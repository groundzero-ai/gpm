import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DefaultFlowExecutor } from './src/core/flows/flow-executor.js';
import type { Flow, FlowContext } from './src/types/flows.js';

const testRoot = join(tmpdir(), 'opkg-glob-debug');
const packageRoot = join(testRoot, 'package');
const workspaceRoot = join(testRoot, 'workspace');

async function setup() {
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(workspaceRoot, { recursive: true });
  
  // Create test files
  await fs.mkdir(join(packageRoot, 'rules'), { recursive: true });
  await fs.writeFile(join(packageRoot, 'rules/typescript.md'), '# TypeScript', 'utf8');
  await fs.writeFile(join(packageRoot, 'rules/python.md'), '# Python', 'utf8');
  
  console.log('Created files:');
  const files = await fs.readdir(join(packageRoot, 'rules'));
  console.log(files);
}

async function test() {
  const executor = new DefaultFlowExecutor();
  
  const flow: Flow = {
    from: 'rules/*.md',
    to: '.cursor/rules/*.mdc',
  };
  
  const context: FlowContext = {
    packageRoot,
    workspaceRoot,
    platform: 'cursor',
    packageName: '@test/debug',
    direction: 'install',
    variables: {},
  };
  
  console.log('\nExecuting flow...');
  const result = await executor.executeFlow(flow, context);
  
  console.log('\nResult:', result);
  
  console.log('\nWorkspace files:');
  try {
    const cursorDir = join(workspaceRoot, '.cursor/rules');
    const wsFiles = await fs.readdir(cursorDir);
    console.log(wsFiles);
  } catch (err) {
    console.log('No files created');
  }
}

async function cleanup() {
  await fs.rm(testRoot, { recursive: true, force: true });
}

setup()
  .then(test)
  .then(cleanup)
  .catch(console.error);
