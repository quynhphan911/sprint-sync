#!/usr/bin/env node
const { spawn } = require('child_process');

const child = spawn('npx', ['vitest', 'run', 'property-4-passwords-match-commutative', '--reporter=verbose'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code);
});
