#!/usr/bin/env node

/** Minify Angular component HTML templates */

const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const { ensureDir } = require('./utils');

console.log('Processing Angular component templates...');

const baseDir = path.join(__dirname, '..');
const componentsDir = path.join(baseDir, 'public', 'components');
const destDir = path.join(baseDir, 'web', 'static', 'components');

const htmlMinifyOptions = {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true
};

async function processHtmlFiles(srcDir, destDir) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            ensureDir(destPath);
            count += await processHtmlFiles(srcPath, destPath);
        }
        else if (entry.name.endsWith('.html')) {
            const html = fs.readFileSync(srcPath, 'utf8');
            const minified = await minify(html, htmlMinifyOptions);
            fs.writeFileSync(destPath, minified);
            count++;
        }
    }
    return count;
}


(async () => {
    try {
        const count = await processHtmlFiles(componentsDir, destDir);
        console.log(`  ✓ Processed ${count} HTML templates`);
        console.log('Angular components processing complete');
    }
    catch (error) {
        console.error('Error processing Angular components:', error);
        process.exit(1);
    }
})();
