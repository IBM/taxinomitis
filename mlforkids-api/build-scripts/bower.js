#!/usr/bin/env node

/** Install bower dependencies */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ensureDir } = require('./utils');

console.log('Installing bower dependencies...');

const baseDir = path.join(__dirname, '..');
const publicDir = path.join(baseDir, 'public');
const destDir = path.join(baseDir, 'web', 'static', 'bower_components');
const bowerBin = path.join(baseDir, 'node_modules', '.bin', 'bower');

ensureDir(destDir);

// Create a temporary .bowerrc in the public directory to specify the install location
const bowerrcPath = path.join(publicDir, '.bowerrc');
const bowerrcContent = JSON.stringify({
    directory: '../web/static/bower_components'
}, null, 2);

const hadBowerrc = fs.existsSync(bowerrcPath);
const originalBowerrc = hadBowerrc ? fs.readFileSync(bowerrcPath, 'utf8') : null;

try {
    // Write .bowerrc to specify install directory
    fs.writeFileSync(bowerrcPath, bowerrcContent);

    // Run bower install from the public directory using local bower
    // This will read public/bower.json and install to ../web/static/bower_components
    execSync(`"${bowerBin}" install`, {
        cwd: publicDir,
        stdio: 'inherit',
        env: {
            ...process.env,
        }
    });

    console.log('Bower dependencies installed successfully');
}
catch (error) {
    console.error('Error installing bower dependencies:', error.message);
    process.exit(1);
}
finally {
    // Restore or remove .bowerrc
    if (hadBowerrc && originalBowerrc) {
        fs.writeFileSync(bowerrcPath, originalBowerrc);
    }
    else if (!hadBowerrc) {
        fs.unlinkSync(bowerrcPath);
    }
}
