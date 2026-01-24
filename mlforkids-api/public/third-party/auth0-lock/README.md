# Auth0 Lock Pre-built Files

## Why This Directory Exists

The `auth0-lock` npm package does not include pre-built browser-ready files. It only contains source code that needs to be built.

Since we need the pre-built `lock.min.js` file for browser use, we maintain a copy of the built version here.

A reference to the auth0-lock npm package is left in package.json as a reminder that it is a dependency, and as a way to get notified when new versions are available.

## Source

This file was originally obtained from the Bower package `auth0-lock@11.35.1`, which includes pre-built files in its `build/` directory.

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

3. Update the version number in this README

## Current Version

- **Version**: 11.35.1
- **Source**: Bower package (auth0-lock@11.35.1)
- **Date**: 2026-01-24

## Build Process

This module is copied to `web/static/bower_components/auth0-lock/build/` by the `build-scripts/boweroverrides.js` script during the build process.
