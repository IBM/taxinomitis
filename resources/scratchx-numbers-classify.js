(function(ext) {

    var STATUS_ERROR = 0;
    var STATUS_WARNING = 1;
    var STATUS_OK = 2;


    var classifierStatus = {
        status : STATUS_WARNING,
        msg : 'Getting status',
    };

    ext._shutdown = function() {};

    ext.resultscache = {
        // schema:
        // space_separated_numbers : { class_name : topClassName, confidence : topClassConfidence }
    };

    ext._getStatus = function() {
        return classifierStatus;
    };


    var checkingStatus = false;

    function getStatus(callback) {
        checkingStatus = true;

        $.ajax({
            url : '{{{ statusurl }}}',
            dataType : 'jsonp',
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


    function classifyNumbers(numbers, cacheKey, callback) {
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

                if (result.random) {
                    if (classifierStatus.status === STATUS_OK) {
                        // we got a randomly selected result (which means we must not have a working classifier)
                        //  but we thought we had a model with a good status
                        // check the status again!
                        initStatusCheck();
                    }
                }
                else {
                    // if the result was chosen at random (instead of using
                    //  a trained classifier) then we don't cache it
                    ext.resultscache[cacheKey] = result;
                }

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
                    status : STATUS_ERROR,
                    msg : 'Failed to submit numbers to training data store'
                };
                callback();

                pollStatus();
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

            [ 'w', 'add training data {{#fields}}{{name}} {{typeformat}} {{/fields}} %s', 'numbers_store', {{#fields}}10, {{/fields}} 'label' ]
        ]
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
            // wait 5 seconds...
            statusPollingTimer = setTimeout(function () {
                // get status (and poll again if needed)
                initStatusCheck();
            }, 5000);
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

    getStatus();
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
