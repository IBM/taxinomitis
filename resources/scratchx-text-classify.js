(function(ext) {

    var classifierStatus = {
        status : 1,
        msg : 'Getting status',
    };

    ext._shutdown = function() {};

    ext.resultscache = {
        // classifiedText : { class_name : topClassName, confidence : topClassConfidence }
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
        // wait 30 seconds
        setTimeout(function () {
            // check the status
            getStatus(function () {
                // if it's still training, poll again
                if (classifierStatus.status === 1) {
                    pollStatus();
                }
            });
        }, 30000);
    }

    getStatus();

    if (classifierStatus.status === 1) {
        pollStatus();
    }


    function classifyText(text, callback) {
        $.ajax({
            url : '{{{ classifyurl }}}',
            dataType : 'jsonp',
            data : {
                data : text
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
                    ext.resultscache[text] = result;
                }

                callback(result);
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : 0,
                    msg : 'Failed to submit text to machine learning service'
                };
                callback({ class_name : 'Unknown', confidence : 0 });
            }
        });
    }


    function storeText(text, label, callback) {
        $.ajax({
            url : '{{{ storeurl }}}',
            dataType : 'jsonp',
            data : {
                data : text,
                label : label
            },
            success : function (data) {
                callback();
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : 0,
                    msg : 'Failed to submit text to training data store'
                };
                pollStatus();
                callback();
            }
        });
    }




    ext.text_classification_label = function (text, callback) {
        if (ext.resultscache[text]) {
            callback(ext.resultscache[text].class_name);
        }
        else {
            classifyText(text, function (result) {
                callback(result.class_name);
            });
        }
    };
    ext.text_classification_confidence = function (text, callback) {
        if (ext.resultscache[text]) {
            callback(ext.resultscache[text].confidence);
        }
        else {
            classifyText(text, function (result) {
                callback(result.confidence);
            });
        }
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
            [ 'w', 'add training data %s %s', 'text_store', 'text', 'label']
        ]
    };

    // Register the extension
    ScratchExtensions.register('{{{ projectname }}}', descriptor, ext);
})({});
