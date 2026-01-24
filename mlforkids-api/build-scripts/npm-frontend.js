#!/usr/bin/env node

/** Install frontend dependencies from npm packages */

const fs = require('fs');
const path = require('path');
const { ensureDir, copyDir } = require('./utils');

console.log('Installing frontend dependencies from npm...');

const baseDir = path.join(__dirname, '..');
const nodeModulesDir = path.join(baseDir, 'node_modules');
const destDir = path.join(baseDir, 'web', 'static', 'bower_components');

ensureDir(destDir);

/**
 * Copy a file from node_modules to bower_components directory
 */
function copyFile(fromPackage, fromPath, toPackage, toPath) {
    const src = path.join(nodeModulesDir, fromPackage, fromPath);
    const dest = path.join(destDir, toPackage, toPath);

    ensureDir(path.dirname(dest));

    if (!fs.existsSync(src)) {
        console.warn(`  ⚠ Warning: Source file not found: ${src}`);
        return false;
    }

    fs.copyFileSync(src, dest);
    return true;
}

/**
 * Copy an entire directory from node_modules to bower_components
 */
function copyDirectory(fromPackage, fromPath, toPackage, toPath) {
    const src = path.join(nodeModulesDir, fromPackage, fromPath);
    const dest = path.join(destDir, toPackage, toPath);

    if (!fs.existsSync(src)) {
        console.warn(`  ⚠ Warning: Source directory not found: ${src}`);
        return false;
    }

    ensureDir(path.dirname(dest));
    copyDir(src, dest);
    return true;
}

// Copy mapping configuration
const copyOperations = [
    // Angular core
    {
        name: 'angular',
        operations: [
            { type: 'file', from: 'angular', fromPath: 'angular.min.js', to: 'angular', toPath: 'angular.min.js' },
            { type: 'file', from: 'angular', fromPath: 'angular.min.js.map', to: 'angular', toPath: 'angular.min.js.map' }
        ]
    },

    // Angular modules
    {
        name: 'angular-animate',
        operations: [
            { type: 'file', from: 'angular-animate', fromPath: 'angular-animate.min.js', to: 'angular-animate', toPath: 'angular-animate.min.js' },
            { type: 'file', from: 'angular-animate', fromPath: 'angular-animate.min.js.map', to: 'angular-animate', toPath: 'angular-animate.min.js.map' }
        ]
    },
    {
        name: 'angular-aria',
        operations: [
            { type: 'file', from: 'angular-aria', fromPath: 'angular-aria.min.js', to: 'angular-aria', toPath: 'angular-aria.min.js' },
            { type: 'file', from: 'angular-aria', fromPath: 'angular-aria.min.js.map', to: 'angular-aria', toPath: 'angular-aria.min.js.map' }
        ]
    },
    {
        name: 'angular-messages',
        operations: [
            { type: 'file', from: 'angular-messages', fromPath: 'angular-messages.min.js', to: 'angular-messages', toPath: 'angular-messages.min.js' },
            { type: 'file', from: 'angular-messages', fromPath: 'angular-messages.min.js.map', to: 'angular-messages', toPath: 'angular-messages.min.js.map' }
        ]
    },
    {
        name: 'angular-sanitize',
        operations: [
            { type: 'file', from: 'angular-sanitize', fromPath: 'angular-sanitize.min.js', to: 'angular-sanitize', toPath: 'angular-sanitize.min.js' },
            { type: 'file', from: 'angular-sanitize', fromPath: 'angular-sanitize.min.js.map', to: 'angular-sanitize', toPath: 'angular-sanitize.min.js.map' }
        ]
    },

    // Angular Material (source maps don't exist in npm package, only main files)
    {
        name: 'angular-material',
        operations: [
            { type: 'file', from: 'angular-material', fromPath: 'angular-material.min.js', to: 'angular-material', toPath: 'angular-material.min.js' },
            { type: 'file', from: 'angular-material', fromPath: 'angular-material.min.css', to: 'angular-material', toPath: 'angular-material.min.css' }
        ]
    },

    // Angular UI Router (special case - scoped package to non-scoped directory)
    {
        name: 'angular-ui-router',
        operations: [
            { type: 'file', from: '@uirouter/angularjs', fromPath: 'release/angular-ui-router.min.js', to: 'angular-ui-router', toPath: 'release/angular-ui-router.min.js' }
        ]
    },

    // Angular extensions
    {
        name: 'angular-scroll',
        operations: [
            { type: 'file', from: 'angular-scroll', fromPath: 'angular-scroll.min.js', to: 'angular-scroll', toPath: 'angular-scroll.min.js' }
        ]
    },
    {
        name: 'angular-timeago',
        operations: [
            { type: 'file', from: 'angular-timeago', fromPath: 'dist/angular-timeago.min.js', to: 'angular-timeago', toPath: 'dist/angular-timeago.min.js' }
        ]
    },
    {
        name: 'angular-translate',
        operations: [
            { type: 'file', from: 'angular-translate', fromPath: 'dist/angular-translate.min.js', to: 'angular-translate', toPath: 'angular-translate.min.js' }
        ]
    },
    {
        name: 'angular-translate-loader-static-files',
        operations: [
            { type: 'file', from: 'angular-translate-loader-static-files', fromPath: 'angular-translate-loader-static-files.min.js', to: 'angular-translate-loader-static-files', toPath: 'angular-translate-loader-static-files.min.js' }
        ]
    },

    // Auth0
    {
        name: 'auth0.js',
        operations: [
            { type: 'file', from: 'auth0-js', fromPath: 'dist/auth0.min.js', to: 'auth0.js', toPath: 'dist/auth0.min.js' }
        ]
    },
    // Note: auth0-lock is handled by boweroverrides.js (pre-built file from public/third-party)
    {
        name: 'angular-lock',
        operations: [
            { type: 'file', from: 'angular-lock', fromPath: 'dist/angular-lock.min.js', to: 'angular-lock', toPath: 'dist/angular-lock.min.js' }
        ]
    },
    {
        name: 'angular-jwt',
        operations: [
            { type: 'file', from: 'angular-jwt', fromPath: 'dist/angular-jwt.min.js', to: 'angular-jwt', toPath: 'dist/angular-jwt.min.js' }
        ]
    },

    // Bootstrap (copy entire dist directory)
    {
        name: 'bootstrap',
        operations: [
            { type: 'dir', from: 'bootstrap', fromPath: 'dist', to: 'bootstrap', toPath: 'dist' }
        ]
    },

    // jQuery
    {
        name: 'jquery',
        operations: [
            { type: 'file', from: 'jquery', fromPath: 'dist/jquery.min.js', to: 'jquery', toPath: 'dist/jquery.min.js' }
        ]
    },

    // D3
    {
        name: 'd3',
        operations: [
            { type: 'file', from: 'd3', fromPath: 'dist/d3.min.js', to: 'd3', toPath: 'd3.min.js' }
        ]
    },

    // Blueimp Canvas to Blob
    {
        name: 'blueimp-canvas-to-blob',
        operations: [
            { type: 'file', from: 'blueimp-canvas-to-blob', fromPath: 'js/canvas-to-blob.min.js', to: 'blueimp-canvas-to-blob', toPath: 'js/canvas-to-blob.min.js' }
        ]
    }
];

// Execute copy operations
let successCount = 0;
let failCount = 0;

for (const pkg of copyOperations) {
    let pkgSuccess = true;

    for (const op of pkg.operations) {
        let result;
        if (op.type === 'file') {
            result = copyFile(op.from, op.fromPath, op.to, op.toPath);
        } else if (op.type === 'dir') {
            result = copyDirectory(op.from, op.fromPath, op.to, op.toPath);
        }

        if (!result) {
            pkgSuccess = false;
        }
    }

    if (pkgSuccess) {
        console.log(`  ✓ ${pkg.name}`);
        successCount++;
    } else {
        console.log(`  ✗ ${pkg.name} (some files missing)`);
        failCount++;
    }
}

console.log(`\nFrontend dependencies installed: ${successCount} successful, ${failCount} with warnings`);

if (failCount > 0) {
    console.warn('\nSome files were not found. This may be expected if package structures differ.');
    console.warn('Please verify the application works correctly.');
}
