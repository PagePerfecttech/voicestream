const { spawn } = require('child_process');
const path = require('path');

// Use ts-node to run TypeScript directly
const tsNodePath = path.join(__dirname, 'node_modules', '.bin', 'ts-node');
const appPath = path.join(__dirname, 'src', 'index.ts');

console.log('🚀 Starting application with ts-node...');

const child = spawn('node', [
  '--require', 'ts-node/register',
  '--require', 'tsconfig-paths/register',
  appPath
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    TS_NODE_PROJECT: './tsconfig.json',
    TS_NODE_TRANSPILE_ONLY: 'true',
    TS_NODE_IGNORE: 'false'
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Application exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  child.kill('SIGINT');
});