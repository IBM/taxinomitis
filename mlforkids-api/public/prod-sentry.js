if (Sentry) {
    Sentry.init({
        dsn: 'https://b4bbe1a8fbce473cb9eb089652848a1e@sentry.io/202347',
        release: '202',
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
            "LayersVariable dense_Dense1/kernel is already disposed",
            "LayersVariable dense_Dense3/kernel is already disposed",
            "LayersVariable dense_Dense5/kernel is already disposed",
            "LayersVariable dense_Dense7/kernel is already disposed"
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
        ]
    });
}
