// Parses a query-string-shaped fragment (e.g. extracted from a Google
//  Images search result URL that a user has dragged/pasted in) into an
//  object of key/value pairs, with basic PHP-style array syntax support
//  (key[]=a&key[]=b, key[0]=a&key[1]=b).
//
// IMPORTANT: the returned object MUST NOT inherit from Object.prototype.
//  The parsed key comes directly from attacker-controllable input (the
//  dragged/pasted URL), so a key of "__proto__" would otherwise let an
//  attacker write arbitrary properties onto Object.prototype itself -
//  polluting every plain object on the page, not just this result.
(function () {

    function parseUrl(url) {
        // no prototype, so result['__proto__'] is an ordinary own
        //  property rather than the special Object.prototype accessor
        var result = Object.create(null);

        url.split('&').forEach(function(part) {
            if (!part) {
                return;
            }

            part = part.split('+').join(' ');

            var eq = part.indexOf('=');
            var key = eq > -1 ? part.substring(0, eq) : part;
            var val = eq > -1 ? decodeURIComponent(part.substring(eq + 1)) : '';

            var from = key.indexOf('[');
            if (from === -1) {
                result[decodeURIComponent(key)] = val;
            }
            else {
                var to = key.indexOf(']', from);
                var index = decodeURIComponent(key.substring(from + 1, to));
                key = decodeURIComponent(key.substring(0, from));

                if (!result[key]) {
                    result[key] = [];
                }

                if (!index) {
                    result[key].push(val);
                }
                else {
                    result[key][index] = val;
                }
            }
        });
        return result;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = parseUrl;
    }
    else {
        window.mlImageLoaderParseUrl = parseUrl;
    }

})();
