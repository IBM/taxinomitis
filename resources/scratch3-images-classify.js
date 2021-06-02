class MachineLearningImages {

    constructor() {
        this._labels = {
            items : [ {{#labels}} '{{name}}', {{/labels}} ],
            acceptReporters: true
        };

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidsimages{{{ projectid }}}',
            // the name of the student project
            name: '{{{ projectname }}}',

            // colour for the blocks
            color1: '#4B4A60',
            // colour for the menus in the blocks
            color2: '#707070',
            // border for blocks and parameter gaps
            color3: '#4c97ff',

            // Machine Learning for Kids site icon
            menuIconURI: this._icon,
            blockIconURI: this._icon,

            // blocks to add to the new section
            blocks: [
                // classify the image and return the label
                {
                    opcode: 'label',
                    blockType: Scratch.BlockType.REPORTER,
                    text: {
                        default: 'recognise image [IMAGE] (label)',
                        id: 'mlforkids.images.recogniseLabel'
                    },
                    arguments: {
                        IMAGE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'image'
                        }
                    }
                },

                // classify the image and return the confidence score
                {
                    opcode: 'confidence',
                    blockType: Scratch.BlockType.REPORTER,
                    text: {
                        default: 'recognise image [IMAGE] (confidence)',
                        id: 'mlforkids.images.recogniseConfidence'
                    },
                    arguments: {
                        IMAGE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'image'
                        }
                    }
                },

                // provide blocks representing each of the labels
                {{#labels}}
                {
                    opcode: 'return_label_{{idx}}',
                    blockType: Scratch.BlockType.REPORTER,
                    text: ' {{name}}'
                },
                {{/labels}}

                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'add training data [TEXT] [LABEL]',
                        id: 'mlforkids.images.addTraining'
                    },
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'image'
                        },
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._labels.items[0],
                            menu: 'labels'
                        }
                    }
                }
            ],

            menus: {
                labels: this._labels
            }
        };
    }


    label({ IMAGE }) {
        return new Promise(resolve => getImageClassificationResponse(IMAGE, md5(IMAGE), 'class_name', resolve));
    }
    confidence({ IMAGE }) {
        return new Promise(resolve => getImageClassificationResponse(IMAGE, md5(IMAGE), 'confidence', resolve));
    }


    {{#labels}}
    return_label_{{idx}} () {
        return '{{name}}';
    }
    {{/labels}}



    addTraining({ TEXT, LABEL }) {
        if (TEXT === '' || TEXT === 'image') {
            // The student has left the default text in the image block
            //  so there is no point in submitting an xhr request
            return;
        }

        var url = new URL('{{{ storeurl }}}');

        var options = {
            headers : {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-User-Agent': 'mlforkids-scratch3-images'
            },
            method : 'POST',
            body : JSON.stringify({
                data : TEXT,
                label : LABEL
            })
        };

        return fetch(url, options)
            .then((response) => {
                if (response.status !== 200) {
                    return response.json();
                }
                else {
                    console.log('added');
                }
            })
            .then((responseJson) => {
                if (responseJson) {
                    if (responseJson.error === 'Project already has maximum allowed amount of training data') {
                        postMessage({ mlforkids : 'mlforkids-addtraininglimit-help' });
                    }
                    else {
                        console.log(responseJson);
                    }
                }
            });
    }
}



var resultsCache = {
    // schema for objects in this cache:
    //
    // cacheKey (md5 hash of image) : {
    //
    //    // returned by the API
    //    class_name : topClassName,
    //    confidence : topClassConfidence,
    //    classifierTimestamp : isoStringDateTime,
    //
    //    // added locally
    //    fetched : timestamp-ms-since-epoch
    // }
};



var TEN_SECONDS = 10 * 1000;


// keep a record of BAD_REQUEST requests so that we don't submit them
// multiple times.
var incorrectUses = {};

// the number of times that the 'recognise image' block has been used
// incorrectly (this will be reset when the Help page is displayed)
var numIncorrectUses = 0;

// the number of times that the 'recognise image' block should be used
// incorrectly before the Help page is shown
var MAX_INCORRECT_USES = 2;

// have we displayed the 'recognise image' help doc?
var displayedMLforKidsHelp = false;


// returns the current date in the format that the API uses
function nowAsString() {
    return new Date().toISOString();
}
// returns true if the provided timestamp is within the last 10 seconds
function veryRecently(timestamp) {
    return (timestamp + TEN_SECONDS) > Date.now();
}




// Submit xhr request to the classify API to get a label for the image
function classifyImage(imagedata, cacheKey, lastmodified, callback) {
    var url = new URL('{{{ classifyurl }}}');

    var options = {
        headers : {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-User-Agent': 'mlforkids-scratch3-images',

            'If-Modified-Since': lastmodified
        },
        method : 'POST',
        body : JSON.stringify({
            data : imagedata,
            displayedhelp : displayedMLforKidsHelp
        })
    };

    return fetch(url, options)
        .then((response) => {
            if (response.status === 304 && resultsCache[cacheKey]) {
                // the API returned NOT-MODIFIED so we'll
                // reuse the value we got last time
                callback(resultsCache[cacheKey]);
            }
            else if (response.status === 200 || response.status === 400 || response.status === 409) {
                response.json().then((responseJson) => {
                    if (response.status === 200 && responseJson && responseJson.length > 0) {
                        // we got a result from the classifier
                        return callback(responseJson[0]);
                    }
                    else if (response.status === 400 && responseJson &&
                        (responseJson.error === 'Missing data' ||
                         responseJson.error === 'Invalid image data provided. Remember, only jpg and png images are supported.'))
                    {
                        registerIncorrectUse();
                    }
                    else if (response.status === 400 && responseJson &&
                        responseJson.error === 'Classification for this project is only available in the browser')
                    {
                        postMessage({ mlforkids : 'mlforkids-recogniseimage-imgtfjs' });
                    }
                    else if (response.status === 400 && responseJson &&
                        responseJson.error === 'Your machine learning model could not be found. Has it been deleted?')
                    {
                        postMessage({ mlforkids : 'mlforkids-recogniseimage-nomodel' });
                    }
                    else if (response.status === 409 && responseJson &&
                        responseJson.error === 'The Watson credentials being used by your class were rejected.')
                    {
                        postMessage({ mlforkids : 'mlforkids-recogniseimage-nomodel' });
                    }

                    callback({
                        class_name: 'Unknown',
                        confidence: 0,
                        classifierTimestamp: nowAsString()
                    });
                });
            }
            else {
                console.log(response);

                callback({
                    class_name: 'Unknown',
                    confidence: 0,
                    classifierTimestamp: nowAsString()
                });
            }
        })
        .catch((err) => {
            console.log(err);

            callback({
                class_name: 'Unknown',
                confidence: 0,
                classifierTimestamp: nowAsString()
            });
        });
}


function registerIncorrectUse() {
    console.log('recognise image block used incorrectly');
    numIncorrectUses += 1;

    if (numIncorrectUses >= MAX_INCORRECT_USES) {
        postMessage({ mlforkids : 'mlforkids-recogniseimage-help' });
        displayedMLforKidsHelp = true;
        numIncorrectUses = 0;
    }
}


function getImageClassificationResponse(imagedata, cacheKey, valueToReturn, callback) {
    if (imagedata === '' || imagedata === 'image') {
        // The student has left the default text in the image block
        //  so there is no point in submitting an xhr request
        registerIncorrectUse();
        return callback('You need to put an image block in here');
    }

    if (incorrectUses[cacheKey]){
        registerIncorrectUse();
        return callback('You need to put an image block in here');
    }

    var cached = resultsCache[cacheKey];

    // protect against kids putting the ML block inside a forever
    //  loop making too many requests too quickly
    // this throttling means we won't try and classify the same
    //  string more than once every 10 seconds
    if (cached && cached.fetched && veryRecently(cached.fetched)) {
        return callback(cached[valueToReturn]);
    }

    // if we have a cached value, get it's timestamp
    var lastmodified = nowAsString();
    if (cached && cached.classifierTimestamp) {
        lastmodified = cached.classifierTimestamp;
    }

    // submit to the classify API
    classifyImage(imagedata, cacheKey, lastmodified, function (result) {
        if (result.random) {
            // We got a randomly selected result (which means we must not
            //  have a working classifier).
            console.log('randomly selected result returned by API');

            postMessage({ mlforkids : 'mlforkids-recogniseimage-nomodel' });
        }

        // update the timestamp to allow local throttling
        result.fetched = Date.now();

        // cache the result to let it be used again
        resultsCache[cacheKey] = result;

        // return the requested value from the response
        callback(result[valueToReturn]);
    });
}


function t(n,t){var r=(65535&n)+(65535&t);return(n>>16)+(t>>16)+(r>>16)<<16|65535&r}function r(n,t){return n<<t|n>>>32-t}function e(n,e,o,u,c,f){return t(r(t(t(e,n),t(u,f)),c),o)}function o(n,t,r,o,u,c,f){return e(t&r|~t&o,n,t,u,c,f)}function u(n,t,r,o,u,c,f){return e(t&o|r&~o,n,t,u,c,f)}function c(n,t,r,o,u,c,f){return e(t^r^o,n,t,u,c,f)}function f(n,t,r,o,u,c,f){return e(r^(t|~o),n,t,u,c,f)}function i(n,r){n[r>>5]|=128<<r%32,n[14+(r+64>>>9<<4)]=r;var e,i,a,d,h,l=1732584193,g=-271733879,v=-1732584194,m=271733878;for(e=0;e<n.length;e+=16)i=l,a=g,d=v,h=m,g=f(g=f(g=f(g=f(g=c(g=c(g=c(g=c(g=u(g=u(g=u(g=u(g=o(g=o(g=o(g=o(g,v=o(v,m=o(m,l=o(l,g,v,m,n[e],7,-680876936),g,v,n[e+1],12,-389564586),l,g,n[e+2],17,606105819),m,l,n[e+3],22,-1044525330),v=o(v,m=o(m,l=o(l,g,v,m,n[e+4],7,-176418897),g,v,n[e+5],12,1200080426),l,g,n[e+6],17,-1473231341),m,l,n[e+7],22,-45705983),v=o(v,m=o(m,l=o(l,g,v,m,n[e+8],7,1770035416),g,v,n[e+9],12,-1958414417),l,g,n[e+10],17,-42063),m,l,n[e+11],22,-1990404162),v=o(v,m=o(m,l=o(l,g,v,m,n[e+12],7,1804603682),g,v,n[e+13],12,-40341101),l,g,n[e+14],17,-1502002290),m,l,n[e+15],22,1236535329),v=u(v,m=u(m,l=u(l,g,v,m,n[e+1],5,-165796510),g,v,n[e+6],9,-1069501632),l,g,n[e+11],14,643717713),m,l,n[e],20,-373897302),v=u(v,m=u(m,l=u(l,g,v,m,n[e+5],5,-701558691),g,v,n[e+10],9,38016083),l,g,n[e+15],14,-660478335),m,l,n[e+4],20,-405537848),v=u(v,m=u(m,l=u(l,g,v,m,n[e+9],5,568446438),g,v,n[e+14],9,-1019803690),l,g,n[e+3],14,-187363961),m,l,n[e+8],20,1163531501),v=u(v,m=u(m,l=u(l,g,v,m,n[e+13],5,-1444681467),g,v,n[e+2],9,-51403784),l,g,n[e+7],14,1735328473),m,l,n[e+12],20,-1926607734),v=c(v,m=c(m,l=c(l,g,v,m,n[e+5],4,-378558),g,v,n[e+8],11,-2022574463),l,g,n[e+11],16,1839030562),m,l,n[e+14],23,-35309556),v=c(v,m=c(m,l=c(l,g,v,m,n[e+1],4,-1530992060),g,v,n[e+4],11,1272893353),l,g,n[e+7],16,-155497632),m,l,n[e+10],23,-1094730640),v=c(v,m=c(m,l=c(l,g,v,m,n[e+13],4,681279174),g,v,n[e],11,-358537222),l,g,n[e+3],16,-722521979),m,l,n[e+6],23,76029189),v=c(v,m=c(m,l=c(l,g,v,m,n[e+9],4,-640364487),g,v,n[e+12],11,-421815835),l,g,n[e+15],16,530742520),m,l,n[e+2],23,-995338651),v=f(v,m=f(m,l=f(l,g,v,m,n[e],6,-198630844),g,v,n[e+7],10,1126891415),l,g,n[e+14],15,-1416354905),m,l,n[e+5],21,-57434055),v=f(v,m=f(m,l=f(l,g,v,m,n[e+12],6,1700485571),g,v,n[e+3],10,-1894986606),l,g,n[e+10],15,-1051523),m,l,n[e+1],21,-2054922799),v=f(v,m=f(m,l=f(l,g,v,m,n[e+8],6,1873313359),g,v,n[e+15],10,-30611744),l,g,n[e+6],15,-1560198380),m,l,n[e+13],21,1309151649),v=f(v,m=f(m,l=f(l,g,v,m,n[e+4],6,-145523070),g,v,n[e+11],10,-1120210379),l,g,n[e+2],15,718787259),m,l,n[e+9],21,-343485551),l=t(l,i),g=t(g,a),v=t(v,d),m=t(m,h);return[l,g,v,m]}function a(n){var t,r="",e=32*n.length;for(t=0;t<e;t+=8)r+=String.fromCharCode(n[t>>5]>>>t%32&255);return r}function d(n){var t,r=[];for(r[(n.length>>2)-1]=void 0,t=0;t<r.length;t+=1)r[t]=0;var e=8*n.length;for(t=0;t<e;t+=8)r[t>>5]|=(255&n.charCodeAt(t/8))<<t%32;return r}function h(n){return a(i(d(n),8*n.length))}function l(n,t){var r,e,o=d(n),u=[],c=[];for(u[15]=c[15]=void 0,o.length>16&&(o=i(o,8*n.length)),r=0;r<16;r+=1)u[r]=909522486^o[r],c[r]=1549556828^o[r];return e=i(u.concat(d(t)),512+8*t.length),a(i(c.concat(e),640))}function g(n){var t,r,e="";for(r=0;r<n.length;r+=1)t=n.charCodeAt(r),e+="0123456789abcdef".charAt(t>>>4&15)+"0123456789abcdef".charAt(15&t);return e}function v(n){return unescape(encodeURIComponent(n))}function m(n){return h(v(n))}function p(n){return g(m(n))}function s(n,t){return l(v(n),v(t))}function C(n,t){return g(s(n,t))}function md5(n,t,r){return t?r?s(t,n):C(t,n):r?m(n):p(n)}


Scratch.extensions.register(new MachineLearningImages());
