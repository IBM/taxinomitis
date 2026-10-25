if (Sentry && !window.mlforkidsStartupFailed) {
    Sentry.init({
        dsn: 'https://b4bbe1a8fbce473cb9eb089652848a1e@sentry.io/202347',
        release: '368',
        // https://docs.sentry.io/platforms/javascript/configuration/filtering/#decluttering-sentry
        ignoreErrors: [
            "top.GLOBALS",
            "originalCreateNotification",
            "canvas.contentDocument",
            "MyApp_RemoveAllHighlights",
            "http://tt.epicplay.com",
            "Can't find variable: ZiteReader",
            "jigsaw is not defined",
            "ComboSearch is not defined",
            "http://loading.retry.widdit.com/",
            "atomicFindClose",
            "fb_xd_fragment",
            "bmi_SafeAddOnload",
            "EBCallBackMessageReceived",
            "conduitPage",
            "Cannot redefine property: googletag",
            "zaloJSV2 is not defined",
            "xbrowser is not defined",
            "AbortError: The play() request was interrupted",
            // angular-material md-select type-to-search when a media key is held down
            /Invalid regular expression: \/\^(Audio|Media)/
        ],
        denyUrls: [
            /graph\.facebook\.com/i,
            /connect\.facebook\.net\/en_US\/all\.js/i,
            /eatdifferent\.com\.woopra-ns\.com/i,
            /static\.woopra\.com\/js\/woopra\.js/i,
            /extensions\//i,
            /^chrome:\/\//i,
            /^chrome-extension:\/\//i,
            /127\.0\.0\.1:4001\/isrunning/i,
            /webappstoolbarba\.texthelp\.com\//i,
            /metrics\.itunes\.apple\.com\.edgesuite\.net\//i,
        ],
        // in-app browsers (e.g. Snapchat, Zalo) inject scripts that call a
        // bridge function "post" before it exists - reported against the page
        // itself, which is only possible for injected code as index.html has
        // no inline scripts
        beforeSend: function (event) {
            var values = event.exception && event.exception.values;
            if (values && values.length === 1) {
                var ex = values[0];
                var frames = (ex.stacktrace && ex.stacktrace.frames) || [];
                if (ex.type === 'ReferenceError' &&
                    ex.value === "Can't find variable: post" &&
                    ex.mechanism && ex.mechanism.type === 'auto.browser.global_handlers.onerror' &&
                    frames.length === 1 &&
                    frames[0].lineno === 1 &&
                    typeof frames[0].filename === 'string' &&
                    frames[0].filename.split(/[?#]/)[0] === window.location.origin + '/')
                {
                    return null;
                }
            }
            return event;
        }
    });
}
