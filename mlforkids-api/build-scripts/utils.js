#!/usr/bin/env node

/** Shared utility functions for build scripts */

const fs = require('fs');
const path = require('path');
const https = require('https');


/** Copy directory recursively */
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/** Download a file from a URL */
async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }
            else {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    }
    catch (err) {
        console.error(`Error reading ${filePath}:`, err.message);
        process.exit(1);
    }
}

function writeFile(filePath, content) {
    try {
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
    }
    catch (err) {
        console.error(`Error writing ${filePath}:`, err.message);
        process.exit(1);
    }
}

function getDeployment() {
    return process.env.DEPLOYMENT || 'local';
}

function isProd() {
    return process.argv.includes('--prod');
}

module.exports = {
    copyDir,
    downloadFile,
    ensureDir,
    readFile,
    writeFile,
    getDeployment,
    isProd
};
