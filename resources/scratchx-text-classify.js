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
                'X-User-Agent': 'mlforkids-scratch2-text'
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


    // Submit xhr request to the classify API to get a label for a string
    function classifyText(text, cacheKey, lastmodified, callback) {
        $.ajax({
            url : '{{{ classifyurl }}}',
            dataType : 'jsonp',
            data : {
                data : text
            },
            headers : {
                'If-Modified-Since': lastmodified,
                'X-User-Agent': 'mlforkids-scratch2-text'
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
                    msg : 'Failed to submit text to machine learning service'
                };

                callback({ class_name : 'Unknown', confidence : 0 });

                pollStatus();
            }
        });
    }


    function storeText(text, label, callback) {
        $.ajax({
            url : '{{{ storeurl }}}',
            dataType : 'json',
            method : 'POST',
            contentType : 'application/json',
            headers : {
                'X-User-Agent': 'mlforkids-scratch2-text'
            },
            data : JSON.stringify({
                data : cleanUpText(text, 1024),
                label : label
            }),
            success : function (data) {
                callback();
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Failed to submit text to training data store'
                };
                callback();

                pollStatus();
            }
        });
    }


    function veryRecently(timestamp) {
        return (timestamp + TEN_SECONDS) > Date.now();
    }



    function getTextClassificationResponse(text, cacheKey, valueToReturn, callback) {
        var cleanedUpText = cleanUpText(text, 2000);
        if (!cleanedUpText) {
            return callback('You need to put some text that you want to classify in here');
        }

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
        classifyText(cleanedUpText, cacheKey, lastmodified, function (result) {
            // return the requested value from the response
            callback(result[valueToReturn]);
        });
    }


    // Newlines in text will cause errors in Watson Assistant API calls
    // so we replace them a with a space
    var LINE_BREAKS = /(\r\n|\n|\r|\t)/gm;
    function cleanUpText(str, maxlength) {
        // Newlines in text will cause errors in Watson Assistant API calls
        // so we replace them a with a space
        return str.replace(LINE_BREAKS, ' ')
                  .trim()
                  // Protect against text that will exceed the limit on
                  //  number of characters allowed by the API
                  .substr(0, maxlength);
    }





    ext.text_classification_label = function (text, callback) {
        getTextClassificationResponse(text, text, 'class_name', callback);
    };

    ext.text_classification_confidence = function (text, callback) {
        getTextClassificationResponse(text, text, 'confidence', callback);
    };

    ext.text_store = function (text, label, callback) {
        // TODO verify label





        storeText(text, label, callback);
    };


    {{#labels}}
    ext.return_label_{{idx}} = function () {
        return '{{name}}';
    };
    {{/labels}}

    var descriptor = {
        blocks : [
            [ 'R', 'recognise text %s (label)', 'text_classification_label', 'text' ],
            [ 'R', 'recognise text %s (confidence)', 'text_classification_confidence', 'text' ],
            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}
            [ 'w', 'add training data %s to %m.labels', 'text_store', 'text', '{{firstlabel}}'],
            [ 'w', 'add training data %s to %s', 'text_store', 'text', 'label']
        ],
        menus : {
            labels : [ {{#labels}} '{{name}}', {{/labels}} ]
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
            // wait 30 seconds...
            statusPollingTimer = setTimeout(function () {
                // get status (and poll again if needed)
                initStatusCheck();
            }, 30000);
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
