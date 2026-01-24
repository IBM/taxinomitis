#!/usr/bin/env node

/** Copy custom bower component overrides */

const fs = require('fs');
const path = require('path');
const { copyDir, ensureDir, copyFiles } = require('./utils');
const CleanCSS = require('clean-css');

console.log('Copying bower component overrides...');

const baseDir = path.join(__dirname, '..');
const bowerDir = path.join(baseDir, 'web', 'static', 'bower_components');

// customwebcam
const webcamSrc = path.join(baseDir, 'public', 'third-party', 'webcam-directive', 'webcam.js');
const webcamDest = path.join(bowerDir, 'webcam-directive', 'dist');
ensureDir(webcamDest);
fs.copyFileSync(webcamSrc, path.join(webcamDest, 'webcam.js'));
console.log('  ✓ webcam-directive');

// custombootstrap
const bootstrapSrc = path.join(baseDir, 'public', 'third-party', 'bootstrap');
const bootstrapDest = path.join(bowerDir, 'bootstrap', 'dist');
ensureDir(bootstrapDest);
copyDir(bootstrapSrc, bootstrapDest);
console.log('  ✓ bootstrap');

// customangularmaterial - minify CSS
const angularMaterialSrc = path.join(baseDir, 'public', 'third-party', 'angular-material');
const angularMaterialDest = path.join(bowerDir, 'angular-material');
ensureDir(angularMaterialDest);

const cssFiles = fs.readdirSync(angularMaterialSrc).filter(f => f.endsWith('.css'));
for (const file of cssFiles) {
    const srcPath = path.join(angularMaterialSrc, file);
    const destPath = path.join(angularMaterialDest, file);
    const css = fs.readFileSync(srcPath, 'utf8');
    const minified = new CleanCSS().minify(css);
    fs.writeFileSync(destPath, minified.styles);
}
console.log('  ✓ angular-material');

// auth0-lock (pre-built file from third-party)
const auth0LockSrc = path.join(baseDir, 'public', 'third-party', 'auth0-lock');
const auth0LockDest = path.join(bowerDir, 'auth0-lock');
ensureDir(auth0LockDest);
copyDir(auth0LockSrc, auth0LockDest);
console.log('  ✓ auth0-lock');

// papaparse
const papaparseSrc = path.join(baseDir, 'node_modules', 'papaparse', 'papaparse.min.js');
const papaparseDest = path.join(bowerDir, 'papaparse');
ensureDir(papaparseDest);
fs.copyFileSync(papaparseSrc, path.join(papaparseDest, 'papaparse.min.js'));
console.log('  ✓ papaparse');

console.log('Bower overrides complete');
