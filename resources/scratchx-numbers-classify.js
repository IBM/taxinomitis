(function(ext) {

    var classifierStatus = {
        status : 1,
        msg : 'Getting status',
    };

    ext._shutdown = function() {};

    ext.resultscache = {
        // space_separated_numbers : { class_name : topClassName, confidence : topClassConfidence }
    };

    ext._getStatus = function() {
        return classifierStatus;
    };

    function getStatus(callback) {
        $.ajax({
            url : '{{{ statusurl }}}',
            dataType : 'jsonp',
            success : function (data) {
                classifierStatus = data;

                if (callback) {
                    callback();
                }
            },
            error : function (err) {
                console.log(err);
                classifierStatus = {
                    status : 0,
                    msg : 'Unable to communicate with machine learning service'
                };

                if (callback) {
                    callback();
                }
            }
        });
    }

    function pollStatus() {
        // wait 2 seconds
        setTimeout(function () {
            // check the status
            getStatus(function () {
                // if it's still training, poll again
                if (classifierStatus.status === 1) {
                    pollStatus();
                }
            });
        }, 2000);
    }

    getStatus();

    if (classifierStatus.status === 1) {
        pollStatus();
    }


    function containsNonNumbers(ary) {
        return ary.some(isNaN);
    }
    function asNumbers(ary) {
        return ary.map(parseFloat);
    }


    function classifyNumbers(numberStrs, cacheKey, callback) {
        var numbers = asNumbers(numberStrs);
        if (containsNonNumbers(numbers)) {
            return callback({ class_name : 'Only numbers can be recognised', confidence : 0 });
        }

        $.ajax({
            url : '{{{ classifyurl }}}',
            dataType : 'jsonp',
            data : {
                data : numbers
            },
            success : function (data) {
                var result;
                if (data.length > 0) {
                    result = data[0];
                }
                else {
                    result = { class_name : 'Unknown', confidence : 0 };
                }

                // if the result was chosen at random (instead of using
                //  a trained classifier) then we don't cache it
                if (!result.random) {
                    ext.resultscache[cacheKey] = result;
                }

                callback(result);
            },
            error : function (err) {
                console.log(err);
                classifierStatus = {
                    status : 0,
                    msg : 'Failed to submit numbers to machine learning service'
                };
                pollStatus();
                callback({ class_name : 'Unknown', confidence : 0 });
            }
        });
    }


    function storeNumbers(numberStrs, label, callback) {
        var numbers = asNumbers(numberStrs);
        if (containsNonNumbers(numbers)) {
            console.log('Only numbers can be stored');
            return callback();
        }

        $.ajax({
            url : '{{{ storeurl }}}',
            dataType : 'jsonp',
            data : {
                data : numbers,
                label : label
            },
            success : function (data) {
                callback();
            },
            error : function (err) {
                console.log(err);
                classifierStatus = {
                    status : 0,
                    msg : 'Failed to submit numbers to training data store'
                };
                pollStatus();
                callback();
            }
        });
    }




    ext.numbers_classification_label = function () {
        var argumentsAry = [].slice.call(arguments);

        var args = argumentsAry.slice(0, arguments.length - 1);
        var callbackfn = arguments[arguments.length - 1];

        var cacheKey = args.join(' ');

        if (ext.resultscache[cacheKey]) {
            callbackfn(ext.resultscache[cacheKey].class_name);
        }
        else {
            classifyNumbers(args, cacheKey, function (result) {
                callbackfn(result.class_name);
            });
        }
    };
    ext.numbers_classification_confidence = function () {
        var argumentsAry = [].slice.call(arguments);

        var args = argumentsAry.slice(0, arguments.length - 1);
        var callbackfn = arguments[arguments.length - 1];

        var cacheKey = args.join(' ');

        if (ext.resultscache[cacheKey]) {
            callbackfn(ext.resultscache[cacheKey].confidence);
        }
        else {
            classifyNumbers(args, cacheKey, function (result) {
                callbackfn(result.confidence);
            });
        }
    };

    ext.numbers_store = function () {
        var argumentsAry = [].slice.call(arguments);

        var args = argumentsAry.slice(0, arguments.length - 2);
        var label = arguments[arguments.length - 2];
        var callbackfn = arguments[arguments.length - 1];

        storeNumbers(args, label, callbackfn);
    };


    {{#labels}}
    ext.return_label_{{idx}} = function () {
        return '{{name}}';
    };
    {{/labels}}

    var descriptor = {
        blocks : [
            [ 'R', 'recognise numbers {{#fields}}{{.}} %n {{/fields}} (label)', 'numbers_classification_label' ],
            [ 'R', 'recognise numbers {{#fields}}{{.}} %n {{/fields}} (confidence)', 'numbers_classification_confidence' ],
            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}
            [ 'w', 'add training data {{#fields}}{{.}} %n {{/fields}} %s', 'numbers_store', {{#fields}}10, {{/fields}} 'label' ]
        ]
    };

    // Register the extension
    ScratchExtensions.register('{{{ projectname }}}', descriptor, ext);
})({});
