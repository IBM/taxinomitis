#!/usr/bin/env node

/** Copy custom bower component overrides */

const fs = require('fs');
const path = require('path');
const { copyDir, ensureDir } = require('./utils');
const CleanCSS = require('clean-css');
const { minify } = require('terser');

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

// Copy most files as-is
const auth0LockFiles = fs.readdirSync(auth0LockSrc);
for (const file of auth0LockFiles) {
    const srcPath = path.join(auth0LockSrc, file);
    const destPath = path.join(auth0LockDest, file);

    // Skip files that shouldn't be deployed
    if (file === 'auth0-lock-csp-shim.js') {
        continue; // Minified separately below
    }
    if (file === 'prepare-css.html') {
        continue; // Development tool, not for production
    }

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
        copyDir(srcPath, destPath);
    } else {
        fs.copyFileSync(srcPath, destPath);
    }
}

// Minify the CSP shim file
(async () => {
    try {
        const shimSrc = path.join(auth0LockSrc, 'auth0-lock-csp-shim.js');
        const shimDest = path.join(auth0LockDest, 'auth0-lock-csp-shim.js');
        const shimCode = fs.readFileSync(shimSrc, 'utf8');

        const minified = await minify(shimCode, {
            compress: {
                dead_code: true,
                drop_console: false,
                drop_debugger: true
            },
            mangle: true
        });

        if (minified.error) {
            console.error('Terser error minifying auth0-lock-csp-shim.js:', minified.error);
            process.exit(1);
        }

        fs.writeFileSync(shimDest, minified.code);
        console.log('  ✓ auth0-lock (with minified CSP shim)');
    } catch (error) {
        console.error('Error minifying auth0-lock-csp-shim.js:', error);
        process.exit(1);
    }
})();

// papaparse
const papaparseSrc = path.join(baseDir, 'node_modules', 'papaparse', 'papaparse.min.js');
const papaparseDest = path.join(bowerDir, 'papaparse');
ensureDir(papaparseDest);
fs.copyFileSync(papaparseSrc, path.join(papaparseDest, 'papaparse.min.js'));
console.log('  ✓ papaparse');

console.log('Bower overrides complete');
