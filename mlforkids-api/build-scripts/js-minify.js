#!/usr/bin/env node

/** Process, annotate, and minify JavaScript files */

const fs = require('fs');
const path = require('path');
const ngAnnotate = require('ng-annotate-patched');
const { minify } = require('terser');
const { ensureDir, getDeployment, isProd } = require('./utils');

console.log('Processing JavaScript...');

const baseDir = path.join(__dirname, '..');
const DEPLOYMENT = getDeployment();
const isForProd = isProd();

// Process app.js with template variables (Lodash template syntax: <%= DEPLOYMENT %>)
const appJsSrc = path.join(baseDir, 'public', 'app.js');
let appJs = fs.readFileSync(appJsSrc, 'utf8');
appJs = appJs.replace(/<%= DEPLOYMENT %>/g, DEPLOYMENT);

const appJsDest = path.join(baseDir, 'web', 'static', 'app.js');
ensureDir(path.dirname(appJsDest));
fs.writeFileSync(appJsDest, appJs);
console.log('  ✓ app.js');

// Determine which auth0 variables to use
let additionalVariables = [];
if (DEPLOYMENT === 'machinelearningforkids.co.uk') {
    if (isForProd) {
        additionalVariables = [
            path.join(baseDir, 'public', 'prod-sentry.js'),
            path.join(baseDir, 'public', 'auth0-prod-variables.js')
        ];
    } else {
        additionalVariables = [
            path.join(baseDir, 'public', 'auth0-variables.js')
        ];
    }
} else {
    additionalVariables = [
        path.join(baseDir, 'public', 'auth0-dev-variables.js')
    ];
}

// Collect all web JS files
const webJsFiles = [
    ...additionalVariables,
    path.join(baseDir, 'public', 'init.js'),
    path.join(baseDir, 'public', 'app.run.js')
];

// Add all component JS files
const componentsDir = path.join(baseDir, 'public', 'components');
function findJsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files.sort(); // Sort for consistent ordering
}

webJsFiles.push(...findJsFiles(componentsDir));

console.log(`  Processing ${webJsFiles.length} JavaScript files...`);

// Apply ng-annotate to each file individually and build sources object
const sources = {};
for (const file of webJsFiles) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        // Apply ng-annotate to this file
        const annotated = ngAnnotate(content, { add: true });
        if (annotated.errors) {
            console.error(`ng-annotate errors in ${file}:`, annotated.errors);
            process.exit(1);
        }

        // Use relative path from web/static for source map
        const relativePath = path.relative(path.join(baseDir, 'web', 'static'), file);
        sources[relativePath] = annotated.src;
    }
}

// Minify with Terser
(async () => {
    try {
        const minified = await minify(sources, {
            sourceMap: {
                filename: 'mlapp.min.js',
                url: 'mlapp.min.js.map',
                includeSources: true
            },
            compress: {
                dead_code: true,
                drop_console: false,
                drop_debugger: true
            },
            mangle: true
        });

        if (minified.error) {
            console.error('Terser error:', minified.error);
            process.exit(1);
        }

        // Write output
        const destDir = path.join(baseDir, 'web', 'static');
        ensureDir(destDir);
        fs.writeFileSync(path.join(destDir, 'mlapp.min.js'), minified.code);
        fs.writeFileSync(path.join(destDir, 'mlapp.min.js.map'), minified.map);

        console.log('  ✓ mlapp.min.js');
        console.log('  ✓ mlapp.min.js.map');
        console.log('JavaScript processing complete');
    } catch (error) {
        console.error('Error minifying JavaScript:', error);
        process.exit(1);
    }
})();


