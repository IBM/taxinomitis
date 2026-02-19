# Auth0 Lock Pre-built Files

## Why This Directory Exists

The `auth0-lock` npm package does not include pre-built browser-ready files. It only contains source code that needs to be built.

Since we need the pre-built `lock.min.js` file for browser use, we maintain a copy of the built version here.

Pre-built CSS is not provided, as auth0-lock dynamically generates CSS from a folder of .styl files and injects this into a <style> element in the web page. The `auth0-lock.min.css` file here was manually created using the prepare-css.html tool which runs an unmodified version of auth0-lock in a browser and extracts the generated CSS from it.

A reference to the auth0-lock npm package is left in package.json as a reminder that it is a dependency, and as a way to get notified when new versions are available.

## Source

This file was originally obtained from the Bower package `auth0-lock@11.35.1`, which includes pre-built JS files in its `build/` directory.

## Updating

To update to a newer version of auth0-lock:

1. Check if the npm package now includes pre-built files:
   ```bash
   ls node_modules/auth0-lock/build/
   ```

2. If not, you can:
   - Use the Bower package temporarily to get the built file:
     ```bash
     bower install auth0-lock@<version>
     cp bower_components/auth0-lock/build/*.js public/third-party/auth0-lock/build/.
     ```

3. Prepare the CSS using the provided tool:
   ```bash
   cd public/third-party/auth0-lock
   python -m http.server 8000
   ```
   - Open http://localhost:8000/prepare-css.html in a browser
   - Update the auth0-lock version in the script tag if needed
   - Click "Prepare CSS" button
   - Click "Copy to Clipboard" button
   - Save the clipboard content to `auth0-lock.min.css`
   - The CSS includes the `--vh` fallback automatically appended for CSP compliance

4. Update the version number in this README

## Current Version

- **Version**: 11.35.1
- **Source**: Bower package (auth0-lock@11.35.1)
- **Date**: 2026-01-24

## Build Process

This module is copied to `web/static/bower_components/auth0-lock/build/` by the `build-scripts/boweroverrides.js` script during the build process.


## CSP Compliance

auth0-lock v11.35.1 has two behaviors that violate Content Security Policy (CSP) when `'unsafe-inline'` is removed from the `style-src` directive:

1. **`injectStyles()` violation**: auth0-lock dynamically creates a `<style id="auth0-lock-style">` element and writes CSS to it via `innerHTML`.
2. **`setWindowHeightStyle()` violation**: auth0-lock sets an inline style on the `<html>` element using `style.setProperty('--vh', ...)` to work around the iOS Safari viewport height bug.

### Solution

To maintain CSP compliance without `'unsafe-inline'`:

1. **`auth0-lock-csp-shim.js`**: A shim script that intercepts and blocks both CSP violations:
   - Intercepts `innerHTML` writes on the `#auth0-lock-style` element (no-op, since CSS is loaded externally)
   - Intercepts `style.setProperty('--vh', ...)` calls on `<html>` (no-op, since CSS provides a fallback)

2. **`auth0-lock.min.css`**: The minified CSS file with an appended fallback for the `--vh` custom property:
   - Uses `1svh` (small viewport height unit) as the modern, spec-correct replacement
   - Falls back to `1vh` in older browsers that don't support `svh`
   - This CSS-native solution replaces the JavaScript-based viewport calculation

### Integration

In `public/index.html`, three elements are added immediately before the `lock.min.js` script tag (order is critical):

1. `<style id="auth0-lock-style"></style>` - Sentinel element for the shim to intercept
2. `<link rel="stylesheet" href=".../auth0-lock.min.css">` - External CSS stylesheet
3. `<script src=".../auth0-lock-csp-shim.js"></script>` - Shim script that blocks CSP violations

This allows the CSP `style-src` directive to remove `'unsafe-inline'` while maintaining full auth0-lock functionality.
