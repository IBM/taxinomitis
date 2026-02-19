/**
 * auth0-lock-csp-shim.js
 *
 * Must be loaded AFTER the <style id="auth0-lock-style"> element exists in the DOM,
 * and BEFORE lock.min.js is loaded.
 *
 * Purpose:
 *   auth0-lock v11 unconditionally calls injectStyles() on initialisation, which:
 *     1. Creates a <style> tag via appendChild (CSP violation) — unless one already exists in DOM
 *     2. Writes the bundled CSS into style.innerHTML (CSP violation regardless)
 *   It also calls setWindowHeightStyle(), which writes an inline style to <html> (CSP violation).
 *
 *   This shim suppresses those violations by intercepting the relevant DOM operations
 *   before Lock runs. Lock's CSS is instead loaded via an external <link> stylesheet
 *   referencing auth0-lock.min.css in the same directory.
 *
 * See: https://github.com/auth0/lock/blob/v11.35.1/src/core.js#L234-L251
 */

(function () {
    'use strict';

    // ── Violation 1 suppression: style.innerHTML / style.styleSheet.cssText ────────
    //
    // auth0-lock checks for an existing #auth0-lock-style element before calling
    // appendChild. If the element is already in the DOM (placed there in index.html),
    // appendChild is skipped. However, Lock then unconditionally writes to style.innerHTML.
    // We intercept that write to make it a no-op, since the CSS is already loaded
    // via the external <link rel="stylesheet"> for auth0-lock.min.css.

    var lockStyleEl = document.getElementById('auth0-lock-style');

    if (!lockStyleEl) {
        // Defensive guard: should not happen if index.html is correct.
        console.warn('[auth0-lock-csp-shim] #auth0-lock-style element not found in DOM. ' +
            'Ensure the <style id="auth0-lock-style"> element is present in index.html ' +
            'before this script is loaded.');
        return;
    }

    // Intercept innerHTML assignments on the Lock style element — make them no-ops.
    // The actual CSS is provided by the external <link> to auth0-lock.min.css.
    try {
        Object.defineProperty(lockStyleEl, 'innerHTML', {
            get: function () { return ''; },
            set: function () { /* no-op: CSS is loaded via external stylesheet */ },
            configurable: true
        });
    } catch (e) {
        console.warn('[auth0-lock-csp-shim] Could not intercept innerHTML on #auth0-lock-style.', e);
    }

    // IE11 path: Lock checks style.styleSheet before style.innerHTML.
    // Suppress it so Lock falls through to the innerHTML path (already suppressed above).
    // IE11 is EOL but this guard is included for completeness.
    if (typeof lockStyleEl.styleSheet !== 'undefined') {
        try {
            Object.defineProperty(lockStyleEl, 'styleSheet', {
                get: function () { return undefined; },
                configurable: true
            });
        } catch (e) {
            // IE may not allow redefining this property — acceptable.
        }
    }

    // ── Violation 2 suppression: setWindowHeightStyle() ────────────────────────────
    //
    // auth0-lock calls:
    //   document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
    //
    // This sets an inline style on <html>, which violates style-src without unsafe-inline.
    //
    // We intercept style.setProperty on <html> and block only the --vh assignment.
    // All other setProperty calls are passed through unchanged.
    //
    // The --vh custom property is used by Lock's CSS to work around the iOS Safari bug
    // where 100vh includes the browser toolbar, causing the login button to be obscured.
    // A CSS-native fallback using the `svh` unit is set in auth0-lock.min.css instead.

    var htmlEl = document.documentElement;
    var originalSetProperty = htmlEl.style.setProperty.bind(htmlEl.style);

    try {
        htmlEl.style.setProperty = function (property, value, priority) {
            if (property === '--vh') {
                // Blocked: would cause a CSP inline-style violation.
                // The --vh value is provided by the :root rule in auth0-lock.min.css.
                return;
            }
            return originalSetProperty(property, value, priority);
        };
    } catch (e) {
        console.warn('[auth0-lock-csp-shim] Could not intercept style.setProperty on <html>.', e);
    }

}());
