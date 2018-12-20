class MachineLearningNumbers {

    constructor() {
        this._labels = [ {{#labels}} '{{name}}', {{/labels}} ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidsnumbers{{{ projectid }}}',
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
                // classify the numbers and return the label
                {
                    opcode: 'label',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'recognise numbers {{#fields}} {{name}}[FIELD{{idx}}] {{/fields}} (label)',
                    arguments: {
                        {{#fields}}
                        FIELD{{idx}}: {
                            {{#multichoice}}
                            type: Scratch.ArgumentType.STRING,
                            menu: 'choices{{idx}}',
                            defaultValue: '{{default}}'
                            {{/multichoice}}
                            {{^multichoice}}
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                            {{/multichoice}}
                        },
                        {{/fields}}
                    }
                },

                // classify the numbers and return the confidence score
                {
                    opcode: 'confidence',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'recognise numbers {{#fields}} {{name}}[FIELD{{idx}}] {{/fields}} (confidence)',
                    arguments: {
                        {{#fields}}
                        FIELD{{idx}}: {
                            {{#multichoice}}
                            type: Scratch.ArgumentType.STRING,
                            menu: 'choices{{idx}}',
                            defaultValue: '{{default}}'
                            {{/multichoice}}
                            {{^multichoice}}
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                            {{/multichoice}}
                        },
                        {{/fields}}
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

                // provide blocks representing each of the choices
                {{#choices}}
                {
                    opcode: 'return_choice_{{idx}}',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '{{name}}'
                },
                {{/choices}}


                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'add training data {{#fields}} {{name}}[FIELD{{idx}}] {{/fields}} is [LABEL]',
                    arguments: {
                        {{#fields}}
                        FIELD{{idx}}: {
                            {{#multichoice}}
                            type: Scratch.ArgumentType.STRING,
                            menu: 'choices{{idx}}',
                            defaultValue: '{{default}}'
                            {{/multichoice}}
                            {{^multichoice}}
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                            {{/multichoice}}
                        },
                        {{/fields}}
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._labels[0],
                            menu: 'labels'
                        }
                    }
                }
            ],

            menus: {
                labels: this._labels,

                {{#fields}}
                choices{{idx}} : [
                    {{#menu}}'{{.}}',{{/menu}}
                ],
                {{/fields}}
            }
        };
    }




    label(args) {
        return new Promise(resolve => prepareArgsGetNumberClassificationResponse('class_name', args, resolve));
    }
    confidence(args) {
        return new Promise(resolve => prepareArgsGetNumberClassificationResponse('confidence', args, resolve));
    }


    {{#labels}}
    return_label_{{idx}} () {
        return '{{name}}';
    }
    {{/labels}}

    {{#choices}}
    return_choice_{{idx}} () {
        return '{{name}}';
    }
    {{/choices}}


    addTraining(args) {
        var numbers = getFieldValues(args);
        var label = args.LABEL;

        var url = new URL('{{{ storeurl }}}');
        for (var i = 0; i < numbers.length; i++) {
            url.searchParams.append('data', numbers[i]);
        }
        url.searchParams.append('label', label);

        var options = {
            headers : {
                'X-User-Agent': 'mlforkids-scratch3-numbers'
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
    // schema:
    //
    // cacheKey (space_separated_numbers) : {
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


// returns the current date in the format that the API uses
function nowAsString() {
    return new Date().toISOString();
}
// returns true if the provided timestamp is within the last 10 seconds
function veryRecently(timestamp) {
    var TEN_SECONDS = 10 * 1000;
    return (timestamp + TEN_SECONDS) > Date.now();
}



// Submit xhr request to the classify API to get a label for a set of numbers
function classifyNumbers(numbers, cacheKey, lastmodified, callback) {
    var options = {
        method : 'POST',
        body : JSON.stringify({ data : numbers }),
        headers : {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-User-Agent': 'mlforkids-scratch3-numbers',

            'If-Modified-Since': lastmodified
        }
    };

    return fetch('{{{ classifyurl }}}', options)
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






function getFieldValues(args) {
    var values = [];
    for (var i = 0; i < {{fields.length}}; i++) {
        values.push(args['FIELD' + i]);
    }
    return values;
}
function getCacheKey(numbers) {
    return numbers.join(' ');
}





function prepareArgsGetNumberClassificationResponse(valueToReturn, args, callback) {
    var numbers = getFieldValues(args);
    var cacheKey = getCacheKey(numbers);

    getNumberClassificationResponse(numbers, cacheKey, valueToReturn, callback);
}


function getNumberClassificationResponse(numbers, cacheKey, valueToReturn, callback) {
    var cached = resultsCache[cacheKey];

    // protect against kids putting the ML block inside a forever
    //  loop making too many requests too quickly
    // this throttling means we won't try and classify the same
    //  numbers more than once every 10 seconds
    if (cached && cached.fetched && veryRecently(cached.fetched)) {
        return callback(cached[valueToReturn]);
    }

    // if we have a cached value, get it's timestamp
    var lastmodified = nowAsString();
    if (cached && cached.classifierTimestamp) {
        lastmodified = cached.classifierTimestamp;
    }

    // submit to the classify API
    classifyNumbers(numbers, cacheKey, lastmodified, function (result) {
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


Scratch.extensions.register(new MachineLearningNumbers());
