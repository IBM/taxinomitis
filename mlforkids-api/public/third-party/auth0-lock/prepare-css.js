#!/usr/bin/env node

/**
 * Regenerates auth0-lock.min.css from the installed auth0-lock npm package.
 *
 * Run this after upgrading auth0-lock:
 *   node public/third-party/auth0-lock/prepare-css.js
 *
 * auth0-lock does not publish a stylesheet. It carries its CSS as a string
 * constant in lib/core.js, which injectStyles() writes into a <style> element
 * at runtime. We block that write for CSP reasons (see auth0-lock-csp-shim.js)
 * and load the same CSS from an external stylesheet instead, so this script
 * lifts that string out of the package and writes it to disk.
 *
 * It replaces an earlier prepare-css.html tool, which ran Lock in a browser and
 * copied the generated CSS off the page by hand. This produces byte-identical
 * output - it was verified against the auth0-lock 11.35.1 stylesheet that the
 * browser tool had produced - without the manual steps.
 */

const fs = require('fs');
const path = require('path');

// The --vh custom property is normally set on <html> by Lock's
// setWindowHeightStyle(), which the CSP shim blocks. This provides it in CSS
// instead: svh is the spec-correct unit for the iOS Safari viewport bug Lock
// was working around, with vh for browsers that don't support svh.
const VH_FALLBACK = ':root{--vh:1svh}@supports not (height:1svh){:root{--vh:1vh}}';

const baseDir = path.join(__dirname, '..', '..', '..');
const corePath = path.join(baseDir, 'node_modules', 'auth0-lock', 'lib', 'core.js');
const outPath = path.join(__dirname, 'auth0-lock.min.css');

const core = fs.readFileSync(corePath, 'utf8');

// lib/core.js declares the stylesheet as a single quoted string literal:
//   var css = '...';   (auth0-lock 11)
//   var css = "...";   (auth0-lock 15)
const match = core.match(/^var css = ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*');$/m);
if (!match) {
    console.error('Could not find the css string in ' + corePath + '.');
    console.error('auth0-lock may have changed how it stores its stylesheet - ' +
                  'check lib/core.js and update this script.');
    process.exit(1);
}

const css = JSON.parse(match[1][0] === "'"
    // JSON.parse only accepts double-quoted strings
    ? JSON.stringify(match[1].slice(1, -1).replace(/\\'/g, "'"))
    : match[1]);

const version = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'node_modules', 'auth0-lock', 'package.json'), 'utf8')
).version;

fs.writeFileSync(outPath, css.trimEnd() + '\n' + VH_FALLBACK);

console.log('Wrote ' + path.relative(baseDir, outPath) +
            ' from auth0-lock@' + version +
            ' (' + css.length + ' chars of CSS + --vh fallback)');
