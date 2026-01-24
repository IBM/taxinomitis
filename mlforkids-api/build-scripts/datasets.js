#!/usr/bin/env node

/** Minify and copy dataset JSON files */

const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./utils');

console.log('Processing datasets...');

const baseDir = path.join(__dirname, '..');
const srcDir = path.join(baseDir, 'resources', 'datasets');
const destDir = path.join(baseDir, 'web', 'static', 'datasets');

function processJsonFiles(srcDir, destDir) {
    ensureDir(destDir);

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            count += processJsonFiles(srcPath, destPath);
        } else if (entry.name.endsWith('.json')) {
            const json = fs.readFileSync(srcPath, 'utf8');
            const parsed = JSON.parse(json);
            const minified = JSON.stringify(parsed);
            fs.writeFileSync(destPath, minified);
            count++;
        }
    }

    return count;
}

const count = processJsonFiles(srcDir, destDir);
console.log(`  ✓ Processed ${count} dataset files`);
console.log('Datasets processing complete');
