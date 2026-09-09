# angular-lock

## Why This Directory Exists

`angular-lock` is the AngularJS binding for Auth0's Lock widget - it registers the
`auth0.lock` Angular module and the `lock` provider that `public/app.js` configures
and `public/components/auth/auth.service.js` injects.

The npm package `angular-lock` was abandoned upstream at version 3.1.0 (2019). Auth0
no longer maintains an AngularJS (1.x) integration, because AngularJS itself is out
of support.

More importantly, the abandoned package **does not work with Auth0 Lock v13 or newer**.
It discovers the methods to expose on the `lock` service by enumerating the Lock
instance:

```js
for (var i in Lock) { if (typeof Lock[i] === 'function') { functions.push(i); } }
```

Lock v11 was transpiled by Babel in loose mode, so its methods are plain prototype
assignments (`Base.prototype.show = ...`) and are enumerable, so this loop finds them.
Lock v13 onwards is transpiled with Babel's `_createClass` helper, which defines
prototype methods via `Object.defineProperty` with `enumerable: false`. The loop then
finds nothing, and the `lock` service is returned with **no `show`, `checkSession` or
`getUserInfo` methods at all** - with no error thrown. Login simply stops working.

Rather than pin the whole login stack to Lock v11 to keep an abandoned 122-line
package working, the binding is maintained here instead.

## Source

`angular-lock.js` is a from-scratch reimplementation, written against the behaviour of
the npm package `angular-lock@3.1.0` (MIT licence, https://github.com/auth0/angular-lock).
It is not a copy of that package's code.

It reproduces the three things this app actually relied on:

1. Registering the `auth0.lock` module and the `lock` provider, with the same
   `lockProvider.init({ clientID, domain, options })` signature - so `public/app.js`
   and `public/components/auth/auth.service.js` needed no changes.
2. Wrapping Lock's callbacks in `$rootScope.$apply()`, so that state they change is
   picked up by Angular.
3. `lock.interceptHash()` - watching `$locationChangeStart` for tokens in the URL
   fragment, parsing them with `auth0.WebAuth.parseHash()`, and re-emitting the result
   as Lock's `authenticated` / `authorization_error` events.

### Deliberate differences from angular-lock@3.1.0

| Change | Reason |
|---|---|
| The exposed methods are listed explicitly in `LOCK_METHODS`, rather than discovered with `for..in` | The enumeration is what breaks on Lock v13+. An explicit list also means a missing method throws at startup instead of failing silently. |
| Dropped the `Auth0Lock.prototype.getClient` and `Auth0Lock.prototype.parseHash` no-op stubs | These existed for the older `auth0-angular` package. Lock's own `parseHash` is on its internal `Auth0WebAPI`/`Auth0APIClient` objects, not on `Auth0Lock.prototype`, so stubbing them had no effect on Lock. |
| Dropped the `_idTokenVerification` option passed to `parseHash()` | The string `_idTokenVerification` does not appear anywhere in auth0-js v9 or v10, in `src/` or in the built `dist/`. It was a no-op. |
| `_telemetryInfo` reports `mlforkids-angular-lock` rather than `angular-lock` / `3.1.0` | This value is reported to Auth0 and shown in the Auth0 dashboard. Claiming to be a package we are no longer using would be misleading. |

Everything else - the `safeApply` phase check, wrapping only the last argument when it
is a function, invoking callbacks with `Lock` as `this`, and emitting Lock events from
outside a digest in `interceptHash` - is preserved as-is.

## Current Version

- **Version**: 1.0.0
- **Replaces**: npm package `angular-lock@3.1.0`
- **Verified against**: auth0-lock 15.0.1, auth0-js 10.2.1
- **Date**: 2026-09-09

## Maintaining This

### Adding a Lock method

The `lock` service only exposes the methods named in the `LOCK_METHODS` array at the
top of `angular-lock.js`. To call another Lock method (`hide`, `logout`, `resumeAuth`
and so on) from `auth.service.js`, add its name to that array. The comments next to
each entry record which caller needs it - please keep those up to date, so it stays
obvious when an entry is no longer needed.

### After upgrading auth0-lock

The wrapper checks at startup that every method in `LOCK_METHODS` exists on the Lock
instance, and throws a descriptive error naming the missing method if not. So the
first thing to do after dropping in a new `lock.min.js` is simply to load the site: a
compatibility break will announce itself in the browser console rather than hiding.

Beyond that, check that Lock still:

- exposes the constructor as a global `Auth0Lock`
- extends an `EventEmitter`, so that `.on()` and `.emit()` still work - `interceptHash`
  calls `Lock.emit()` directly

### After upgrading auth0-js

`interceptHash()` uses only `new auth0.WebAuth({ clientID, domain })` and
`webAuth.parseHash({ hash }, cb)`. Check those two still exist and that the global is
still `auth0`. The wrapper throws a descriptive error at `interceptHash()` time if the
global or `auth0.WebAuth` is missing.

Note that auth0-js v10 rejects HS256-signed tokens. This app's Auth0 tokens are RS256
(verified in `src/lib/restapi/auth.ts`), so that change does not affect it. The
`HS256` usage in that file is for locally-issued "Try it now" session-user tokens,
which never go through auth0-js.

### Testing a change

`angular-lock.spec.js` covers the binding's own logic under karma (`npm run test:web`),
against a fake `Auth0Lock` whose methods are non-enumerable - the shape Lock v13+ has.
It checks which methods are exposed, that callbacks run inside a digest and receive
`Lock` as `this`, that `interceptHash` re-emits parsed tokens and errors as Lock
events, and that a missing method fails at startup. Its first test pins the for..in
behaviour described above, so it stays clear why `LOCK_METHODS` is written out by hand.

What a fake cannot tell you is whether the binding still fits the *real* Lock, so after
changing either, also exercise the login paths by hand against a tenant:

- log in as a student (`lock.show()` via `authService.login()`)
- the "forgot password" dialog (`authService.reset()`)
- returning from Auth0 with tokens in the URL fragment (`interceptHash`)
- silent token renewal (`checkSession`, in `authService.renewLogin()`) - most easily
  seen in the `[ml4kauth]` debug logging
- the unverified-email error path (the `authorization_error` event)

## Build Process

`angular-lock.spec.js` is test-only and is not deployed - `boweroverrides.js` copies
`angular-lock.js` by name rather than copying the directory.

`angular-lock.js` is minified with terser and written to
`web/static/bower_components/angular-lock/angular-lock.min.js` by the
`build-scripts/boweroverrides.js` script, alongside the auth0-lock CSP shim which is
handled the same way.

It is loaded from `public/index.html`, alongside `lock.min.js` and `auth0.min.js`. It
depends on the globals both of those define, but does not read either at parse time -
`Auth0Lock` is read when Angular instantiates the provider in its config phase, and
`auth0` only when `interceptHash()` is called - so they only need to be loaded before
Angular bootstraps.
