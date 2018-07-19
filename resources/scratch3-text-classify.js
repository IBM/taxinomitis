class MachineLearningText {

    constructor() {
        this._labels = [
            {{#labels}}
            { value: '{{name}}' },
            {{/labels}}
        ];
    }


    getInfo() {
        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidstext' + Date.now(),
            // the name of the student project
            name: '{{{ projectname }}}',

            //
            colour: '#4B4A60',
            colourSecondary: '#AFAEC4',
            colourTertiary: '#96C896',

            // Machine Learning for Kids site icon
            menuIconURI: 'data:image/jpeg;base64,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',

            // blocks to add to the new section
            blocks: [
                // classify the text and return the label
                {
                    opcode: 'label',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'recognise text [TEXT] (label)',
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'text'
                        }
                    }
                },

                // classify the text and return the confidence score
                {
                    opcode: 'confidence',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'recognise text [TEXT] (confidence)',
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'text'
                        }
                    }
                },

                // provide blocks representing each of the labels
                {{#labels}}
                {
                    opcode: 'return_label_{{idx}}',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '{{name}}'
                },
                {{/labels}}

                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'add training data [TEXT] [LABEL]',
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'text'
                        },
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'label'
                            // BUG: This seems to break the rendering
                            //  of the Scratch palette
                            // menu: 'labels'
                        }
                    }
                }
            ],

            menus: {
                labels: this._labels
            }
        };
    }


    label({ TEXT }) {
        return new Promise(resolve => getTextClassificationResponse(TEXT, TEXT, 'class_name', resolve));
    }
    confidence({ TEXT }) {
        return new Promise(resolve => getTextClassificationResponse(TEXT, TEXT, 'confidence', resolve));
    }


    {{#labels}}
    return_label_{{idx}} () {
        return '{{name}}';
    }
    {{/labels}}


    addTraining({ TEXT, LABEL }) {
        var url = new URL('{{{ storeurl }}}');
        url.searchParams.append('data', TEXT);
        url.searchParams.append('label', LABEL);

        var options = {
            body: {
                data: TEXT,
                label: LABEL
            }
        };

        return fetch(url, options)
            .then((response) => {
                if (response.status !== 200) {
                    return response.json();
                }
            })
            .then((responseJson) => {
                if (responseJson) {
                    console.log(responseJson);
                }
            });
    }
}



var resultsCache = {
    // schema for objects in this cache:
    //
    // cacheKey (text to be classified) : {
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




// returns the current date in the format that the API uses
function nowAsString() {
    return new Date().toISOString();
}
// returns true if the provided timestamp is within the last 10 seconds
function veryRecently(timestamp) {
    return (timestamp + TEN_SECONDS) > Date.now();
}





// Submit xhr request to the classify API to get a label for a string
function classifyText(text, cacheKey, lastmodified, callback) {
    var url = new URL('{{{ classifyurl }}}');
    url.searchParams.append('data', text);

    var options = {
        headers : {
            'Accept': 'application/json',
            'Content-Type': 'application/json',

            'If-Modified-Since': lastmodified
        }
    };

    return fetch(url, options)
        .then((response) => {
            if (response.status === 304 && resultsCache[cacheKey]) {
                // the API returned NOT-MODIFIED so we'll
                // reuse the value we got last time
                callback(resultsCache[cacheKey]);
            }
            else if (response.status === 200) {
                response.json().then((responseJson) => {
                    if (responseJson && responseJson.length > 0) {
                        // we got a result from the classifier
                        callback(responseJson[0]);
                    }
                    else {
                        callback({
                            class_name: 'Unknown',
                            confidence: 0,
                            classifierTimestamp: nowAsString()
                        });
                    }
                });
            }
            else {
                console.log(err);

                callback({
                    class_name: 'Unknown',
                    confidence: 0,
                    classifierTimestamp: nowAsString()
                });
            }
        });
        // .catch((err) => {

        // });
}


function getTextClassificationResponse(text, cacheKey, valueToReturn, callback) {
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
    classifyText(text, cacheKey, lastmodified, function (result) {
        if (result.random) {
            // We got a randomly selected result (which means we must not
            //  have a working classifier) but we thought we had a model
            //  with a good status.
            // This should not be possible - we've gotten into a weird
            //  unexpected state.
            return callback(result[valueToReturn]);
        }

        // update the timestamp to allow local throttling
        result.fetched = Date.now();

        // cache the result to let it be used again
        resultsCache[cacheKey] = result;

        // return the requested value from the response
        callback(result[valueToReturn]);
    });
}


Scratch.extensions.register(new MachineLearningText());
