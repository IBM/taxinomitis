// Regular expressions used by mlImageLoader.directive.js to recognize
//  image URLs copied from Google/Baidu image search results, so the
//  real underlying image URL can be extracted from the search result's
//  wrapper URL.
//
// Pulled out into their own file (rather than kept as local vars in the
//  directive) so they can be unit tested directly, without needing to
//  simulate a drag-and-drop DOM event through the whole directive.
(function () {

    var patterns = {
        GOOG_IMG_REGEX : /^https:\/\/www\.google\.co[a-z.]+\/imgres\?(imgurl=.*)/,
        BAIDU_IMG_REGEX : /^https:\/\/timgsa\.baidu\.com\/timg\?.*/,
        BAIDU_IMG_SRCH_REGEX : /^https:\/\/images?\.baidu\.com\/search\/detail.*/,
        IMG_URL_REGEX : /^https?:\/\/[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)(\.jpg|\.png)\??.*$/
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = patterns;
    }
    else {
        window.mlImageLoaderPatterns = patterns;
    }

})();
