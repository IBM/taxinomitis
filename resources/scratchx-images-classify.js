(function(ext) {

    var STATUS_ERROR = 0;
    var STATUS_WARNING = 1;
    var STATUS_OK = 2;


    var classifierStatus = {
        status : STATUS_WARNING,
        msg : 'Getting status',
    };

    ext._shutdown = function() {};

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


    function classifyImage(imagedata, callback) {
        $.ajax({
            url : '{{{ classifyurl }}}',
            type : 'POST',
            dataType : 'json',
            contentType : 'application/json',
            data : '{"data":"' + imagedata + '"}',
            success : function (data) {
                var result;
                if (data.length > 0) {
                    result = data[0];
                }
                else {
                    result = { class_name : 'Unknown', confidence : 0 };
                }

                if (result.random && classifierStatus.status === STATUS_OK) {
                    // we got a randomly selected result (which means we must not have a working classifier)
                    //  but we thought we had a model with a good status
                    // check the status again!
                    initStatusCheck();
                }

                callback(result);
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : STATUS_ERROR,
                    msg : 'Failed to submit image to machine learning service'
                };

                callback({ class_name : 'Unknown', confidence : 0 });

                pollStatus();
            }
        });
    }


    function storeImage(imagedata, label, callback) {
        $.ajax({
            url : '{{{ storeurl }}}',
            dataType : 'jsonp',
            data : {
                data : imagedata,
                label : label
            },
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


    ext.image_classification_label = function (imagedata, callback) {
        classifyImage(imagedata, function (result) {
            callback(result.class_name);
        });
    };
    ext.image_classification_confidence = function (imagedata, callback) {
        classifyImage(imagedata, function (result) {
            callback(result.confidence);
        });
    };


    ext.image_store = function (imagedata, label, callback) {
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
            [ 'R', 'recognise image %s (label)', 'image_classification_label', 'costume image' ],
            [ 'R', 'recognise image %s (confidence)', 'image_classification_confidence', 'costume image' ],
            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}
            [ 'w', 'add training data %s %s', 'image_store', 'image', 'label']
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
