class MachineLearningText {

    constructor() {
        this._labels = {
            items : [ {{#labels}} '{{name}}', {{/labels}} ],
            acceptReporters: true
        };

        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Training', text : 'still training' },
            { value : 'Model Failed', text : 'ERROR - broken' },
            { value : 'Model Non Existent', text : 'ERROR - non-existent' }
        ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidstext{{{ projectid }}}',
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
                // classify the text and return the label
                {
                    opcode: 'label',
                    blockType: Scratch.BlockType.REPORTER,
                    text: {
                        default: 'recognise text [TEXT] (label)',
                        id: 'mlforkids.text.recogniseLabel'
                    },
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
                    text: {
                        default: 'recognise text [TEXT] (confidence)',
                        id: 'mlforkids.text.recogniseConfidence'
                    },
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
                    text: ' {{name}}'
                },
                {{/labels}}

                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'add training data [TEXT] [LABEL]',
                        id: 'mlforkids.text.addTraining'
                    },
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'text'
                        },
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._labels.items[0],
                            menu: 'labels'
                        }
                    }
                },

                // train a new machine learning model
                {
                    opcode: 'trainNewModel',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'train new machine learning model',
                        id: 'mlforkids.text.trainNewModel'
                    }
                },

                // get the status of the machine learning model
                {
                    opcode: 'checkModelStatus',
                    blockType: Scratch.BlockType.BOOLEAN,
                    text: {
                        default: 'Is the machine learning model [STATUS] ?',
                        id: 'mlforkids.text.checkModelStatus'
                    },
                    arguments: {
                        STATUS: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._statuses[0].value,
                            menu: 'statuses'
                        }
                    }
                }
            ],

            menus: {
                labels: this._labels,
                statuses: this._statuses
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
        var txt = cleanUpText(TEXT, 1024);

        var url = new URL('{{{ storeurl }}}');

        var options = {
            headers : {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-User-Agent': 'mlforkids-scratch3-text'
            },
            method : 'POST',
            body : JSON.stringify({
                data : txt,
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
                    trainingCache.add(txt);
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


    trainNewModel() {
        if (trainingModel || // currently submitting a new-model request, OR
            lastModelTrainedRecently()) // we very recently submitted one
        {
            console.log('ignoring request - last status:');
            console.log(classifierStatus);
            return;
        }

        return trainNewClassifier()
            .then((responseJson) => {
                if (responseJson) {
                    console.log(responseJson);
                }
            });
    }


    checkModelStatus({ STATUS }) {
        return getStatus()
            .then((statusObj) => {
                switch(STATUS) {
                    case 'Ready':
                        return statusObj.status === STATUS_OK;
                    case 'Training':
                        return statusObj.status === STATUS_WARNING;
                    default:
                        return statusObj.status === STATUS_ERROR &&
                               statusObj.msg === STATUS;
                }
            });
    }
}



var trainingCache = new Set();
getTrainingDataItems()
    .then((t) => {
        trainingCache = t;
    })
    .catch((err) => {
        console.log('failed to get training data', err);
    });



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


var STATUS_ERROR = 0;
var STATUS_WARNING = 1;
var STATUS_OK = 2;


var classifierStatus = {
    status : STATUS_WARNING,
    msg : 'Getting status',
};

var TEN_SECONDS = 10 * 1000;
var TWENTY_SECONDS = 20 * 1000;
var THIRTY_SECONDS = 30 * 1000;
var ONE_MINUTE = 60 * 1000;
var TWO_MINUTES = 2 * 60 * 1000;
var FIVE_MINUTES = 5 * 60 * 1000;


// the last time that we used the API to check the status
//  of the ML model
var lastStatusCheck = 0;
// the last time that we used the API to train a new ML model
var lastModelTrain = 0;

// returns true if the last time that we checked the ML model
//  status was longer ago than the provided time limit
function lastStatusCheckExceededLimit(limit) {
    return (Date.now() - lastStatusCheck) > limit;
}
// returns true if the last time that we trained a ML model
//  was too recently to do again
function lastModelTrainedRecently() {
    return (lastModelTrain + ONE_MINUTE) > Date.now();
}

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
            'X-User-Agent': 'mlforkids-scratch3-text',

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


function getTextClassificationResponse(text, cacheKey, valueToReturn, callback) {
    var cleanedUpText = cleanUpText(text, 2000);
    if (!cleanedUpText) {
        return callback('You need to put some text that you want to classify in here');
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
    classifyText(cleanedUpText, cacheKey, lastmodified, function (result) {
        if (result.random) {
            // We got a randomly selected result (which means we must not
            //  have a working classifier).
            console.log('randomly selected result returned by API');
        }

        // update the timestamp to allow local throttling
        result.fetched = Date.now();

        // cache the result to let it be used again
        resultsCache[cacheKey] = result;

        // return the requested value from the response
        callback(result[valueToReturn]);

        // check if we just classified something that
        //  was used for training the classifier
        if (trainingCache.has(cleanedUpText)) {
            postMessage({ mlforkids : 'mlforkids-recognisetext-training-help' });
        }
    });
}


// are we currently checking the classifier status?
//  used as a primitive lock to prevent multiple concurrent checks being made
var checkingStatus = false;
// are we currently training a classifier?
//  used as a primitive lock to prevent multiple concurrent requests being made
var trainingModel = false;



// make an XHR request to train a new ML model
function trainNewClassifier() {
    trainingModel = true;
    lastStatusCheck = Date.now();
    lastModelTrain = Date.now();

    var url = new URL('{{{ modelurl }}}');
    var options = {
        headers : {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-User-Agent': 'mlforkids-scratch3-text'
        },
        method : 'POST'
    };

    return fetch(url, options)
        .then((response) => {
            if (response.status === 200) {
                return response.json().then((responseJson) => {
                    classifierStatus = responseJson;
                });
            }
            else {
                console.log(response);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Unable to communicate with machine learning service'
                };
            }
        })
        .then(() => {
            trainingModel = false;
            return classifierStatus;
        })
        .catch((err) => {
            console.log(err);
            trainingModel = false;

            classifierStatus = {
                status : STATUS_ERROR,
                msg : 'Unable to communicate with machine learning service'
            };
            return classifierStatus;
        });
}


// make an XHR request to fetch the current status of the ML model
function fetchStatus() {
    checkingStatus = true;
    lastStatusCheck = Date.now();

    var url = new URL('{{{ statusurl }}}');
    var options = {
        headers : {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-User-Agent': 'mlforkids-scratch3-text'
        }
    };

    return fetch(url, options)
        .then((response) => {
            if (response.status === 200) {
                return response.json().then((responseJson) => {
                    classifierStatus = responseJson;
                });
            }
            else {
                console.log(response);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Unable to communicate with machine learning service'
                };
            }
        })
        .then(() => {
            checkingStatus = false;
            return classifierStatus;
        })
        .catch((err) => {
            console.log(err);
            checkingStatus = false;

            classifierStatus = {
                status : STATUS_ERROR,
                msg : 'Unable to communicate with machine learning service'
            };
            return classifierStatus;
        });
}



// Get the current status of the ML model
//  This will decide whether it is worth calling the status API
//  or whether it is okay to re-use a previously cached check
//  Either way, it will return a promise.
function getStatus() {

    // note - the nested if's could be more efficiently written,
    //  but I'm keeping it this way to make it more readable

    if (checkingStatus) {
        // already have a check in-flight, so we don't
        // start another
        return Promise.resolve(classifierStatus);
    }
    else if (classifierStatus.status === STATUS_OK) {
        // everything looks okay, so ok to use the cache if
        // we've checked in the last two minutes
        if (lastStatusCheckExceededLimit(TWO_MINUTES)) {
            // get the current status
            return fetchStatus();
        }
        else {
            return Promise.resolve(classifierStatus);
        }
    }
    else if (classifierStatus.status === STATUS_WARNING) {
        // looks like the ML model is currently training,
        //  so we want to check more frequently so we
        //  know when it's ready to use
        if (lastStatusCheckExceededLimit(TWENTY_SECONDS)) {
            // get the current status
            return fetchStatus();
        }
        else {
            return Promise.resolve(classifierStatus);
        }
    }
    else {
        // The ML model is broken
        // This is very unlikely to fix itself, so there
        // is not much point in aggressively polling
        if (lastStatusCheckExceededLimit(FIVE_MINUTES)) {
            // get the current status
            return fetchStatus();
        }
        else {
            return Promise.resolve(classifierStatus);
        }
    }
}


var LINE_BREAKS = /(\r\n|\n|\r|\t)/gm;
function cleanUpText(str, maxlength) {
    if (str) {
        // Newlines in text will cause errors in Watson Assistant API calls
        // so we replace them a with a space
        return str.replace(LINE_BREAKS, ' ')
                .trim()
                // Protect against text that will exceed the limit on
                //  number of characters allowed by the API
                .substr(0, maxlength);
    }
    else {
        return str;
    }
}


function getTrainingDataItems() {
    var url = new URL('{{{ storeurl }}}');
    var options = {
        headers : {
            'Accept': 'application/json',
            'X-User-Agent': 'mlforkids-scratch3-text'
        }
    };
    return fetch(url, options)
        .then((response) => {
            if (response.status === 200) {
                return response.json();
            }
            else {
                console.log('failed to fetch training');
            }
        })
        .then((trainingdata) => {
            const existingTrainingText = new Set();
            if (trainingdata) {
                for (var j = 0; j < trainingdata.length; j++) {
                    existingTrainingText.add(trainingdata[j].textdata);
                }
            }
            return existingTrainingText;
        });
}


Scratch.extensions.register(new MachineLearningText());
