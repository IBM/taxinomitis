(function(ext) {

    var classifierStatus = {
        status : 1,
        msg : 'Getting status',
    };

    ext.resultscache = {
        // classifiedText : { class_name : topClassName, confidence : topClassConfidence }
    };

    ext._getStatus = function() {
        return classifierStatus;
    };

    $.ajax({
        url : '{{{ statusurl }}}',
        dataType : 'jsonp',
        success : function (data) {
            classifierStatus = data;
        },
        error : function (err) {
            classifierStatus = {
                status : 0,
                msg : 'Unable to communicate with machine learning service'
            }
        }
    });


    function classifyText(text, callback) {
        $.ajax({
            url : '{{{ classifyurl }}}',
            dataType : 'jsonp',
            method : 'POST',
            data : {
                text : text
            },
            success : function (data) {
                var result;
                if (data.length > 0) {
                    result = data[0];
                }
                else {
                    result = { class_name : 'Unknown', confidence : 0 };
                }
                ext.resultscache[text] = result;
                callback(result);
            },
            error : function (err) {
                classifierStatus = {
                    status : 0,
                    msg : 'Failed to submit text to machine learning service'
                };
                callback({ class_name : 'Unknown', confidence : 0 });
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

    var descriptor = {
        blocks : [
            [ 'R', 'recognise text %s (label)', 'text_classification_label', 'text' ],
            [ 'R', 'recognise text %s (confidence)', 'text_classification_confidence', 'text' ]
        ]
    };

    // Register the extension
    ScratchExtensions.register('Machine Learning text blocks', descriptor, ext);
})({});
