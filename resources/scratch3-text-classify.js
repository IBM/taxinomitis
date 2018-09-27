class MachineLearningText {

    constructor() {
        this._labels = [ {{#labels}} '{{name}}', {{/labels}} ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gcYFDscg0kLkgAAAQdJREFUSMdj9PZK+M9AR8DEQGdAdwtZCCnYsnU+0Yb5eCdSbiGxBhHrsOEfh6MWjlo4DEoaUksbQoCR3rUFCyVlJjl6WCgtM0nVgzXRFJfEYYg1t+QRNJiXl4W8VCotLY3Cd3DUZvj+/TtBw/j5uciz8ODBgwxCQuxwvpaWFsOLFy9olw937jjBEB7hC+ffv3+fgYODg3YWMjExMnz9+pWBgYGBQVlZmGH7tjO0t3DRwm0MjIz/GTw8naFiTLQuaRgZEpN8GZ4/f06864lwFFYLf/z4A7GSkZFh3drDDAwMDAxv374laFhRcTbDnTt3GBgYGBiuXLnCcGD/VdxFG71KGsZh3/IGABK+UkZW++njAAAAAElFTkSuQmCC';
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidstext{{{ projectid }}}',
            // the name of the student project
            name: '{{{ projectname }}}',

            // colour for the blocks
            colour: '#4B4A60',
            // colour for the menus in the blocks
            colourSecondary: '#707070',
            // border for blocks and parameter gaps
            colourTertiary: '#4c97ff',

            // Machine Learning for Kids site icon
            menuIconURI: this._icon,
            blockIconURI: this._icon,

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
                            defaultValue: this._labels[0],
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

        return fetch(url)
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
