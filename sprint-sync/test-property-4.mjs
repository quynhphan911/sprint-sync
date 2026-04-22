import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTest() {
  try {
    console.log('Running Property 4 test...\n');
    const { stdout, stderr } = await execAsync(
      'npx vitest run property-4-passwords-match-commutative --reporter=verbose',
      { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
    );
    
    console.log('STDOUT:', stdout);
    if (stderr) console.error('STDERR:', stderr);
    
    process.exit(0);
  } catch (error) {
    console.error('Error running test:', error.message);
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.error('STDERR:', error.stderr);
    process.exit(1);
  }
}

runTest();
