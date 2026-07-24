based on https://github.com/jonashartmann/webcam-directive modified to allow custom video options

Also modified so that a rejected `videoElem.play()` promise (e.g. `NotAllowedError`
when a user denies camera permission) is routed to the directive's existing
`onFailure`/`onError` handler, instead of being left as an unhandled promise
rejection.