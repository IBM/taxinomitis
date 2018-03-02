(function(ext) {

    var classifierStatus = {
        status : 1,
        msg : 'Getting status',
    };

    ext._shutdown = function() {};

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

                callback(result);
            },
            error : function (err) {
                console.log(err);

                classifierStatus = {
                    status : 0,
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
                    status : 0,
                    msg : 'Failed to submit image to training data store'
                };
                pollStatus();
                callback();
            }
        });
    }


    ext.image_classification_label = function (imagedata, callback) {
        classifyImage(imagedata, function (result) {
            callback(result.class_name);
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
            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}
            [ 'w', 'add training data %s %s', 'image_store', 'image', 'label']
        ]
    };

    // Register the extension
    ScratchExtensions.register('{{{ projectname }}}', descriptor, ext);
})({});
