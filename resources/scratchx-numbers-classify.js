(function(ext) {

    var STATUS_ERROR = 0;
    var STATUS_WARNING = 1;
    var STATUS_OK = 2;

    var TEN_SECONDS = 10 * 1000;


    var classifierStatus = {
        status : STATUS_WARNING,
        msg : 'Getting status',
    };

    ext._shutdown = function() {};

    ext.resultscache = {
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

    ext._getStatus = function() {
        return classifierStatus;
    };



    // returns the current date in the format that the API uses
    function nowAsString() {
        return new Date().toISOString();
    }


    // are we currently checking the classifier status?
    //  used as a primitive lock to prevent multiple concurrent checks being made
    var checkingStatus = false;


    // Submit xhr request to the status API to get the current status
    //  of the machine learning model. This will be called repeatedly
    //  to poll the classifier status.
    function getStatus(callback) {
        checkingStatus = true;

        $.ajax({
            url : '{{{ statusurl }}}',
            dataType : 'jsonp',
            headers : {
                'X-User-Agent': 'mlforkids-scratch2-numbers'
            },
            success : function (data) {
                classifierStatus = data;

                if (callback) {
                    callback();
                }

                checkingStatus = false;
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Unable to communicate with machine learning service'
                };

                if (callback) {
                    callback();
                }

                checkingStatus = false;
            }
        });
    }


    // Submit xhr request to the classify API to get a label for the set of numbers
    function classifyNumbers(numbers, cacheKey, lastmodified, callback) {
        $.ajax({
            url : '{{{ classifyurl }}}',
            dataType : 'jsonp',
            data : {
                data : numbers
            },
            headers : {
                'If-Modified-Since': lastmodified,
                'X-User-Agent': 'mlforkids-scratch2-numbers'
            },
            success : function (data, status) {
                var result;

                if (status === 'notmodified') {
                    // the API returned an HTTP-304 so we'll reuse
                    //  the value we got last time
                    result = ext.resultscache[cacheKey];
                }
                else if (data && data.length > 0) {
                    // we got a result from the classifier
                    result = data[0];
                }
                else {
                    // we got an API response successfully, but the response
                    //  is that the classifier could not classify the text
                    result = {
                        class_name : 'Unknown',
                        confidence : 0,
                        classifierTimestamp : nowAsString()
                    };
                }


                if (result.random) {
                    if (classifierStatus.status === STATUS_OK) {
                        // We got a randomly selected result (which means we must not
                        //  have a working classifier) but we thought we had a model
                        //  with a good status.
                        // This should not be possible - we've gotten into a weird
                        //  unexpected state.
                        //
                        // Check the status again!
                        initStatusCheck();
                    }
                }
                else {
                    // timestamp used for local throttling
                    result.fetched = Date.now();

                    // if the result was chosen at random (instead of using
                    //  a trained classifier) then we don't cache it
                    ext.resultscache[cacheKey] = result;
                }

                // return the final result (either from cache or API response)
                callback(result);
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Failed to submit numbers to machine learning service'
                };

                callback({ class_name : 'Unknown', confidence : 0 });

                pollStatus();
            }
        });
    }


    function storeNumbers(numbers, label, callback) {
        $.ajax({
            url : '{{{ storeurl }}}',
            dataType : 'json',
            method : 'POST',
            contentType : 'application/json',
            headers : {
                'X-User-Agent': 'mlforkids-scratch2-numbers'
            },
            data : JSON.stringify({
                data : numbers,
                label : label
            }),
            success : function (data) {
                callback();
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Failed to submit numbers to training data store'
                };
                callback();

                pollStatus();
            }
        });
    }


    function veryRecently(timestamp) {
        return (timestamp + TEN_SECONDS) > Date.now();
    }



    function getNumberClassificationResponse(numbers, cacheKey, valueToReturn, callback) {
        var cached = ext.resultscache[cacheKey];

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
        classifyNumbers(numbers, cacheKey, lastmodified, function (result) {
            // return the requested value from the response
            callback(result[valueToReturn]);
        });
    }


    function prepareArgsGetNumberClassificationResponse(valueToReturn, scratchArgs) {
        var argumentsAry = [].slice.call(scratchArgs);

        var numbers = argumentsAry.slice(0, argumentsAry.length - 1);
        var callback = argumentsAry[argumentsAry.length - 1];

        var cacheKey = numbers.join(' ');

        getNumberClassificationResponse(numbers, cacheKey, valueToReturn, callback);
    }

    ext.numbers_classification_label = function () {
        prepareArgsGetNumberClassificationResponse('class_name', arguments);
    };

    ext.numbers_classification_confidence = function () {
        prepareArgsGetNumberClassificationResponse('confidence', arguments);
    };

    ext.numbers_store = function () {
        var argumentsAry = [].slice.call(arguments);

        var numbers = argumentsAry.slice(0, arguments.length - 2);
        var label = arguments[arguments.length - 2];
        var callbackfn = arguments[arguments.length - 1];

        storeNumbers(numbers, label, callbackfn);
    };


    {{#labels}}
    ext.return_label_{{idx}} = function () {
        return '{{name}}';
    };
    {{/labels}}

    {{#choices}}
    ext.return_choice_{{idx}} = function () {
        return '{{name}}';
    };
    {{/choices}}

    var descriptor = {
        blocks : [
            [ 'R', 'recognise numbers {{#fields}}{{name}} {{typeformat}} {{/fields}} (label)', 'numbers_classification_label' ],
            [ 'R', 'recognise numbers {{#fields}}{{name}} {{typeformat}} {{/fields}} (confidence)', 'numbers_classification_confidence' ],

            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}

            {{#choices}}
            [ 'r', '{{name}}', 'return_choice_{{idx}}'],
            {{/choices}}

            [ 'w', 'add training data {{#fields}}{{name}} {{typeformat}} {{/fields}} to %m.labels', 'numbers_store', {{#fields}}10, {{/fields}} '{{firstlabel}}' ],
            [ 'w', 'add training data {{#fields}}{{name}} {{typeformat}} {{/fields}} to %s', 'numbers_store', {{#fields}}10, {{/fields}} 'label' ]
        ],
        menus : {
            labels : [ {{#labels}} '{{name}}', {{/labels}} ],

            {{#fields}}
            choices{{idx}} : [
                {{#menu}}'{{.}}',{{/menu}}
            ],
            {{/fields}}
        }
    };

    // Register the extension
    ScratchExtensions.register('{{{ projectname }}}', descriptor, ext);





    //
    // keep the status of the ML model current
    //


    // 0 = error
    // 1 = warning
    // 2 = ok
    //
    // Anything other than 2 means there is some sort of problem
    function statusProblem() {
        return classifierStatus.status !== STATUS_OK;
    }

    var statusPollingTimer = null;

    function isNotPolling() {
        return statusPollingTimer === null;
    }

    function pollStatus() {
        if (!statusPollingTimer) {
            // wait 10 seconds...
            statusPollingTimer = setTimeout(function () {
                // get status (and poll again if needed)
                initStatusCheck();
            }, 10000);
        }
    }

    // check the status at least once
    function initStatusCheck() {
        // Check the current status using the /status API
        getStatus(function () {
            statusPollingTimer = null;

            if (statusProblem() && userIsActive()) {
                // If there is a problem, and the user is
                //  still using Scratch, start (or continue)
                //  polling the status API
                pollStatus();
            }
            else {
                // If the status is OK, we can leave it
                //  (if the status actually changes, we'll
                //  find out the next time we call /classify)
                // Alternatively, if the user is idle, it
                //  doesn't matter. If they return, we'll
                //  check again.
            }
        });
    }

    initStatusCheck();


    //
    // track idle time so that we can reduce the frequency of the
    //  status API calls if the user has gone away
    //

    var lastUserActivity = Date.now();
    function resetIdleTimer() {
        lastUserActivity = Date.now();

        if (statusProblem() && isNotPolling() && !checkingStatus) {
            // first activity after an idle period
            initStatusCheck();
        }
    }
    var EVENTS_INDICATING_USER_ACTIVITY = [ 'mousemove', 'mousedown', 'click', 'scroll', 'keydown', 'touchstart' ];
    for (var e = 0; e < EVENTS_INDICATING_USER_ACTIVITY.length; e++) {
        window.addEventListener(EVENTS_INDICATING_USER_ACTIVITY[e], resetIdleTimer, true);
    }


    var FIFTEEN_MINUTES = 900000;
    function userIsActive() {
        var idleTime = Date.now() - lastUserActivity;
        return idleTime < FIFTEEN_MINUTES;
    }


})({});
