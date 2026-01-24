#!/usr/bin/env node

/** Clean build directories */

const fs = require('fs');
const path = require('path');

function deleteRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`Deleted: ${dirPath}`);
    }
}

console.log('Cleaning build directories...');

const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
const outDir = tsconfig.compilerOptions.outDir || 'dist';

deleteRecursive(path.join(__dirname, '..', outDir));
deleteRecursive(path.join(__dirname, '..', 'web'));

console.log('Clean complete');
