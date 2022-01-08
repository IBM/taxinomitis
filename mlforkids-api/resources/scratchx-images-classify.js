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
                'X-User-Agent': 'mlforkids-scratch2-images'
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


    // Submit xhr request to the classify API to get a label for the image
    function classifyImage(imagedata, cacheKey, lastmodified, callback) {
        $.ajax({
            url : '{{{ classifyurl }}}',
            dataType : 'json',
            type : 'POST',
            contentType : 'application/json',
            data : JSON.stringify({
                data : imagedata,
                displayedhelp : displayedMLforKidsHelp
            }),
            headers : {
                'If-Modified-Since': lastmodified,
                'X-User-Agent': 'mlforkids-scratch2-images'
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
                    //  is that the classifier could not classify the image
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
                if (err.status === 400 &&
                    err.responseJSON &&
                    (err.responseJSON.error === 'Missing data' ||
                     err.responseJSON.error === 'Invalid image data provided. Remember, only jpg and png images are supported.'))
                {
                    incorrectUses[cacheKey] = err.responseJSON.error;
                    registerIncorrectUse();
                }
                else {
                    console.log(err);

                    classifierStatus = {
                        status : STATUS_ERROR,
                        msg : 'Failed to submit image to machine learning service'
                    };

                    pollStatus();
                }

                callback({ class_name : 'Unknown', confidence : 0 });
            }
        });
    }


    function storeImage(imagedata, label, callback) {
        $.ajax({
            url : '{{{ storeurl }}}',
            dataType : 'json',
            method : 'POST',
            contentType : 'application/json',
            headers : {
                'X-User-Agent': 'mlforkids-scratch2-images'
            },
            data : JSON.stringify({
                data : imagedata,
                label : label
            }),
            success : function (data) {
                callback();
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Failed to submit image to training data store'
                };
                callback();

                pollStatus();
            }
        });
    }


    function veryRecently(timestamp) {
        return (timestamp + TEN_SECONDS) > Date.now();
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
        classifyImage(imagedata, cacheKey, lastmodified, function (result) {
            // return the requested value from the response
            callback(result[valueToReturn]);
        });
    }













    ext.image_classification_label = function (imagedata, callback) {
        getImageClassificationResponse(imagedata, md5(imagedata), 'class_name', callback);
    };

    ext.image_classification_confidence = function (imagedata, callback) {
        getImageClassificationResponse(imagedata, md5(imagedata), 'confidence', callback);
    };

    ext.image_store = function (imagedata, label, callback) {
        if (imagedata === '' || imagedata === 'image') {
            // The student has left the default text in the image block
            //  so there is no point in submitting an xhr request
            return callback('You need to put an image block in here');
        }
        // TODO verify label
        storeImage(imagedata, label, callback);
    };


    {{#labels}}
    ext.return_label_{{idx}} = function () {
        return '{{name}}';
    };
    {{/labels}}

    var descriptor = {
        blocks : [
            [ 'R', 'recognise image %s (label)', 'image_classification_label', 'image' ],
            [ 'R', 'recognise image %s (confidence)', 'image_classification_confidence', 'image' ],
            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}
            [ 'w', 'add training data %s to %m.labels', 'image_store', 'image', '{{firstlabel}}'],
            [ 'w', 'add training data %s to %s', 'image_store', 'image', 'label']
        ],
        menus : {
            labels : [ {{#labels}} '{{name}}', {{/labels}} ]
        }
    };

    // Register the extension
    ScratchExtensions.register('{{{ projectname }}}', descriptor, ext);


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

    function registerIncorrectUse() {
        numIncorrectUses += 1;

        if (numIncorrectUses >= MAX_INCORRECT_USES) {
            if (!mlforkidsHelp && $('#scratch-mlforkids-help-recognise-image-costume').length) {
                document.getElementById('scratch-mlforkids-help-recognise-image-costume').style.display = 'block';
                document.getElementById('scratch').style.visibility = 'hidden';
                displayedMLforKidsHelp = true;
            }
            numIncorrectUses = 0;
        }
    }



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
