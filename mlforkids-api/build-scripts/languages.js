#!/usr/bin/env node

/** Copy and optionally minify language files */

const fs = require('fs');
const path = require('path');
const { ensureDir, isProd } = require('./utils');

console.log('Processing language files...');

const baseDir = path.join(__dirname, '..');
const srcDir = path.join(baseDir, 'public', 'languages');
const destDir = path.join(baseDir, 'web', 'static', 'languages');
const isForProd = isProd();

function processLanguageFiles(srcDir, destDir) {
    ensureDir(destDir);

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            count += processLanguageFiles(srcPath, destPath);
        }
        else if (entry.name.endsWith('.json')) {
            if (isForProd) {
                const json = fs.readFileSync(srcPath, 'utf8');
                const parsed = JSON.parse(json);
                const minified = JSON.stringify(parsed);
                fs.writeFileSync(destPath, minified);
            }
            else {
                fs.copyFileSync(srcPath, destPath);
            }
            count++;
        }
        else {
            fs.copyFileSync(srcPath, destPath);
            count++;
        }
    }

    return count;
}

const count = processLanguageFiles(srcDir, destDir);
console.log(`  ✓ Processed ${count} language files${isForProd ? ' (minified)' : ''}`);
console.log('Language files processing complete');
