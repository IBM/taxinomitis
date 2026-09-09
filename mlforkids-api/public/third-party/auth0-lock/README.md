# Auth0 Lock Pre-built Files

## Why This Directory Exists

The `auth0-lock` npm package does not include pre-built browser-ready files. It only
contains transpiled CommonJS modules in `lib/`, which need bundling before a browser
can use them.

Since we need a pre-built `lock.min.js` for browser use, we keep a copy of the built
version here.

Pre-built CSS is not provided either. auth0-lock carries its stylesheet as a string
constant in `lib/core.js`, which its `injectStyles()` writes into a `<style>` element
at runtime. We block that write for CSP reasons (see below) and load the same CSS from
an external stylesheet, which `prepare-css.js` extracts from the package.

A reference to the auth0-lock npm package is kept in package.json as a reminder that
it is a dependency, as the source that `prepare-css.js` reads, and as a way to get
notified when new versions are available.

## Source

`build/lock.min.js` is the official build published by Auth0 to their CDN:

    https://cdn.auth0.com/js/lock/15.0.1/lock.min.js

Earlier versions of this directory took the file from the Bower package instead. Bower
is no longer a viable source - `bower install auth0-lock@12.6.1` and later fail - so
the CDN is now the route to a pre-built file.

`auth0-lock.min.css` is generated from the npm package by `prepare-css.js`, and
`auth0-lock-csp-shim.js` is ours (see CSP Compliance below).

### Only lock.min.js is vendored

The Bower package used to bring a `build/` directory containing `lock.js` (unminified)
and 46 per-language files. Those are not kept:

- the language files are never loaded from here. Lock fetches them from
  `languageBaseUrl`, which defaults to `https://cdn.auth0.com`, and only when a
  `language` option is set - which `public/app.js` does not do, so Lock uses the
  English strings bundled into `lock.min.js`.
- the unminified `lock.js` is useful when investigating Lock's behaviour, but is 2.2MB
  and was being deployed for no reason. Fetch it from
  `https://cdn.auth0.com/js/lock/<version>/lock.js` when you need to read it.

## Updating

To update to a newer version of auth0-lock:

1. Bump the version in `package.json` and `npm install`.

2. Download the matching pre-built file from Auth0's CDN:
   ```bash
   curl -o public/third-party/auth0-lock/build/lock.min.js \
        https://cdn.auth0.com/js/lock/<version>/lock.min.js
   ```

3. Check that the CDN build really corresponds to the npm package you just installed -
   they are published separately. The stylesheet is a good witness, since it appears
   in both: take a long run of plain CSS from the `css` string in
   `node_modules/auth0-lock/lib/core.js` (one with no quotes or backslashes, so that
   minifier re-escaping cannot affect it) and confirm it appears verbatim in
   `lock.min.js`. Also check the bundle reports the version you expect
   (`Auth0Lock.version`).

4. Regenerate the CSS:
   ```bash
   node public/third-party/auth0-lock/prepare-css.js
   ```

5. Re-check the CSP shim still matches Lock's behaviour - see below.

6. Bump the `?v=` cache-busting parameter on the `lock.min.js` and
   `auth0-lock.min.css` references in `public/index.html`. The CSS and the markup it
   styles are versioned together, so a stale cached stylesheet against a new Lock
   gives a broken-looking login box.

7. Update the version number and date in this README.

Note that `public/third-party/angular-lock/` binds Lock into AngularJS, and has its own
notes on what to check after a Lock upgrade.

## Current Version

- **Version**: 15.0.1
- **Source**: Auth0 CDN (https://cdn.auth0.com/js/lock/15.0.1/lock.min.js)
- **Date**: 2026-09-09

## Build Process

`build/lock.min.js`, `auth0-lock.min.css` and a minified copy of
`auth0-lock-csp-shim.js` are copied to `web/static/bower_components/auth0-lock/` by the
`build-scripts/boweroverrides.js` script during the build. `prepare-css.js` and this
README are skipped - they are maintenance material, not deployed assets.

## CSP Compliance

auth0-lock has two behaviours that violate Content Security Policy (CSP) when
`'unsafe-inline'` is removed from the `style-src` directive:

1. **`injectStyles()` violation**: auth0-lock creates a `<style id="auth0-lock-style">`
   element and writes CSS to it via `innerHTML`.
2. **`setWindowHeightStyle()` violation**: auth0-lock sets an inline style on the
   `<html>` element using `style.setProperty('--vh', ...)` to work around the iOS
   Safari viewport height bug.

Both are unchanged between v11.35.1 and v15.0.1 - `injectStyles()` still looks for an
existing `#auth0-lock-style` element before creating one, still prefers
`style.styleSheet.cssText` over `style.innerHTML`, and `setWindowHeightStyle()` still
sets `--vh` on `document.documentElement`. So the shim below applies unchanged. Check
`injectStyles` and `setWindowHeightStyle` in `node_modules/auth0-lock/lib/core.js`
after any future upgrade.

### Solution

To maintain CSP compliance without `'unsafe-inline'`:

1. **`auth0-lock-csp-shim.js`**: A shim script that intercepts and blocks both CSP
   violations:
   - Intercepts `innerHTML` writes on the `#auth0-lock-style` element (no-op, since
     CSS is loaded externally)
   - Intercepts `style.setProperty('--vh', ...)` calls on `<html>` (no-op, since CSS
     provides a fallback)

2. **`auth0-lock.min.css`**: The stylesheet extracted from the npm package by
   `prepare-css.js`, with an appended fallback for the `--vh` custom property:
   - Uses `1svh` (small viewport height unit) as the modern, spec-correct replacement
   - Falls back to `1vh` in older browsers that don't support `svh`
   - This CSS-native solution replaces the JavaScript-based viewport calculation

### Integration

In `public/index.html`, three elements are added immediately before the `lock.min.js`
script tag (order is critical):

1. `<style id="auth0-lock-style"></style>` - Sentinel element for the shim to intercept
2. `<link rel="stylesheet" href=".../auth0-lock.min.css">` - External CSS stylesheet
3. `<script src=".../auth0-lock-csp-shim.js"></script>` - Shim script that blocks CSP
   violations

This allows the CSP `style-src` directive to remove `'unsafe-inline'` while maintaining
full auth0-lock functionality.
