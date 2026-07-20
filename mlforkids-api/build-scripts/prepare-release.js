#!/usr/bin/env node

/** Bump the deployment version number across all files that reference it */

const path = require('path');
const { readFile, writeFile } = require('./utils');

const ROOT = path.join(__dirname, '..');

const APP_ENV = path.join(ROOT, 'ops', 'app.env');
const APP_JS = path.join(ROOT, 'public', 'app.js');
const LOGGER_SERVICE_JS = path.join(ROOT, 'public', 'components', 'logger', 'logger.service.js');
const INDEX_HTML = path.join(ROOT, 'public', 'index.html');
const PROD_SENTRY_JS = path.join(ROOT, 'public', 'prod-sentry.js');

function getCurrentVersion() {
    const appEnv = readFile(APP_ENV);
    const match = appEnv.match(/DOCKER_VERSION=(\d+)/);
    if (!match) {
        console.error(`Could not find DOCKER_VERSION in ${APP_ENV}`);
        process.exit(1);
    }
    return parseInt(match[1], 10);
}

function replaceAll(content, oldStr, newStr, filePath) {
    const pattern = new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const updated = content.replace(pattern, newStr);
    if (updated === content) {
        console.error(`No occurrences of ${oldStr} found in ${filePath}`);
        process.exit(1);
    }
    return updated;
}

const currentVersion = getCurrentVersion();
const newVersion = currentVersion + 1;

console.log(`Bumping version ${currentVersion} -> ${newVersion}`);

writeFile(APP_ENV, readFile(APP_ENV).replace(
    `DOCKER_VERSION=${currentVersion}`, `DOCKER_VERSION=${newVersion}`));

writeFile(APP_JS, readFile(APP_JS).replace(
    `.json?v=${currentVersion}'`, `.json?v=${newVersion}'`));

writeFile(LOGGER_SERVICE_JS, readFile(LOGGER_SERVICE_JS).replace(
    `version v=${currentVersion}`, `version v=${newVersion}`));

writeFile(INDEX_HTML, replaceAll(readFile(INDEX_HTML), `?v=${currentVersion}`, `?v=${newVersion}`, INDEX_HTML));

writeFile(PROD_SENTRY_JS, readFile(PROD_SENTRY_JS).replace(
    `release: '${currentVersion}'`, `release: '${newVersion}'`));

console.log(`Release prepared: version ${newVersion}`);
