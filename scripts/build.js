import { execSync } from 'child_process';
import { readdirSync, renameSync } from 'fs';
import { join } from 'path';

// Compile ESM
execSync('tsc -p tsconfig.esm.json', { stdio: 'inherit' });

// Compile CJS
execSync('tsc -p tsconfig.cjs.json', { stdio: 'inherit' });

// Rename .js -> .cjs in CJS folder
const cjsDir = join(process.cwd(), 'lib/cjs');
readdirSync(cjsDir).forEach((file) => {
  if (file.endsWith('.js')) {
    const oldPath = join(cjsDir, file);
    const newPath = join(cjsDir, file.replace(/\.js$/, '.cjs'));
    renameSync(oldPath, newPath);
  }
});

// Rename .js -> .mjs in ESM folder
const esmDir = join(process.cwd(), 'lib/esm');
readdirSync(esmDir).forEach((file) => {
  if (file.endsWith('.js')) {
    const oldPath = join(esmDir, file);
    const newPath = join(esmDir, file.replace(/\.js$/, '.mjs'));
    renameSync(oldPath, newPath);
  }
});

console.log('✅ Build complete: ESM (.js) + CJS (.cjs)');
