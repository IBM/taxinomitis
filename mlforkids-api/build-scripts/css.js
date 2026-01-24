#!/usr/bin/env node

/** Process and minify CSS files */

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const autoprefixer = require('autoprefixer');
const postcss = require('postcss');
const { ensureDir } = require('./utils');

console.log('Processing CSS...');

const baseDir = path.join(__dirname, '..');
const cssFiles = [
    path.join(baseDir, 'public', 'app.css')
];

const componentsDir = path.join(baseDir, 'public', 'components');
function findCssFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findCssFiles(fullPath));
        }
        else if (entry.name.endsWith('.css')) {
            files.push(fullPath);
        }
    }

    return files;
}

cssFiles.push(...findCssFiles(componentsDir));

let concatenated = '';
for (const file of cssFiles) {
    concatenated += fs.readFileSync(file, 'utf8') + '\n';
}

(async () => {
    try {
        const result = await postcss([autoprefixer]).process(concatenated, { from: undefined });

        const minified = new CleanCSS().minify(result.css);
        if (minified.errors.length > 0) {
            console.error('CSS minification errors:', minified.errors);
            process.exit(1);
        }

        const destDir = path.join(baseDir, 'web', 'static');
        ensureDir(destDir);
        fs.writeFileSync(path.join(destDir, 'style.min.css'), minified.styles);

        console.log(`  ✓ Processed ${cssFiles.length} CSS files`);
        console.log('CSS processing complete');
    }
    catch (error) {
        console.error('Error processing CSS:', error);
        process.exit(1);
    }
})();
