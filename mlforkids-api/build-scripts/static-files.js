#!/usr/bin/env node

/** Copy static files (images, robots.txt, stories, etc.) */

const fs = require('fs');
const path = require('path');
const { copyDir, ensureDir } = require('./utils');

const task = process.argv[2] || 'all';
const baseDir = path.join(__dirname, '..');

function copyImages() {
    console.log('Copying images...');
    const srcDir = path.join(baseDir, 'public', 'images');
    const destDir = path.join(baseDir, 'web', 'static', 'images');
    ensureDir(destDir);

    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    console.log('  ✓ Images copied');
}

function copyRobotsTxt() {
    console.log('Copying robots.txt, sitemap.xml, favicon...');
    const destDir = path.join(baseDir, 'web', 'dynamic');
    ensureDir(destDir);

    const files = [
        { src: path.join(baseDir, 'public', 'static-files', 'robots.txt'), dest: 'robots.txt' },
        { src: path.join(baseDir, 'public', 'static-files', 'sitemap.xml'), dest: 'sitemap.xml' },
        { src: path.join(baseDir, 'public', 'images', 'favicon.ico'), dest: 'favicon.ico' }
    ];

    for (const { src, dest } of files) {
        fs.copyFileSync(src, path.join(destDir, dest));
    }
    console.log('  ✓ Robots.txt and related files copied');
}

function copyStories() {
    console.log('Copying stories...');
    const srcDir = path.join(baseDir, 'public', 'static-files', 'stories');
    const destDir = path.join(baseDir, 'web', 'static', 'stories');
    ensureDir(destDir);

    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
    }
    console.log('  ✓ Stories copied');
}

function copyScratchblocks() {
    console.log('Copying scratchblocks...');
    const src = path.join(baseDir, 'public', 'third-party', 'scratchblocks-v3.1-min.js');
    const dest = path.join(baseDir, 'web', 'static', 'scratchblocks-v3.1-min.js');
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log('  ✓ Scratchblocks copied');
}

function copyScratch3() {
    console.log('Copying Scratch 3 files...');
    const destDir = path.join(baseDir, 'web', 'scratch3');
    ensureDir(destDir);

    const scratch3Src = path.join(baseDir, 'public', 'scratch3');
    if (fs.existsSync(scratch3Src)) {
        copyDir(scratch3Src, destDir);
    }

    const scratchComponentsSrc = path.join(baseDir, 'public', 'scratch-components');

    if (fs.existsSync(scratchComponentsSrc)) {
        const files = fs.readdirSync(scratchComponentsSrc);

        for (const file of files) {
            if (file.startsWith('help-scratch3') ||
                file === 'help-scratch.css' ||
                file === 'teachablemachinepose.html') {
                const src = path.join(scratchComponentsSrc, file);
                fs.copyFileSync(src, path.join(destDir, file));
            }
        }
    }

    console.log('  ✓ Scratch 3 files copied');
}


switch (task) {
    case 'images':
        copyImages();
        break;
    case 'robots':
        copyRobotsTxt();
        break;
    case 'stories':
        copyStories();
        break;
    case 'scratchblocks':
        copyScratchblocks();
        break;
    case 'scratch3':
        copyScratch3();
        break;
    case 'all':
        copyImages();
        copyRobotsTxt();
        copyStories();
        copyScratchblocks();
        copyScratch3();
        break;
    default:
        console.error(`Unknown task: ${task}`);
        process.exit(1);
}

console.log('Static files processing complete');
