#!/usr/bin/env node

/** Process and minify HTML files */

const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const { ensureDir, getDeployment, isProd } = require('./utils');

console.log('Processing HTML...');

const baseDir = path.join(__dirname, '..');
const DEPLOYMENT = getDeployment();
const isForProd = isProd();

const htmlMinifyOptions = {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true
};

async function processHtml() {
    const indexSrc = path.join(baseDir, 'public', 'index.html');
    const indexDest = path.join(baseDir, 'web', 'dynamic', 'index.html');

    let indexHtml = fs.readFileSync(indexSrc, 'utf8');

    indexHtml = indexHtml.replace(/<%= DEPLOYMENT %>/g, DEPLOYMENT);
    if (isForProd) {
        // For production, replace with spaces to keep the script tag visible
        indexHtml = indexHtml.replace(/<%= USE_IN_PROD_ONLY %>/g, '         ');
        indexHtml = indexHtml.replace(/<%= AFTER_USE_IN_PROD_ONLY %>/g, '          ');
    } else {
        // For non-production, replace with HTML comments to hide the script tag
        indexHtml = indexHtml.replace(/<%= USE_IN_PROD_ONLY %>/g, '<!--');
        indexHtml = indexHtml.replace(/<%= AFTER_USE_IN_PROD_ONLY %>/g, '-->');
    }

    const minified = await minify(indexHtml, htmlMinifyOptions);
    ensureDir(path.dirname(indexDest));
    fs.writeFileSync(indexDest, minified);
    console.log('  ✓ index.html');

    if (isForProd) {
        const twitterSrc = path.join(baseDir, 'public', 'static-files', 'twitter-card.html');
        const twitterDest = path.join(baseDir, 'web', 'dynamic', 'twitter-card.html');
        fs.copyFileSync(twitterSrc, twitterDest);
        console.log('  ✓ twitter-card.html');
    }

    console.log('HTML processing complete');
}

processHtml().catch(error => {
    console.error('Error processing HTML:', error);
    process.exit(1);
});
