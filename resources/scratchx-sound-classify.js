(function(ext) {

    var STATUS_ERROR = 0;

    var classifierStatus = {
        status : STATUS_ERROR,
        msg : 'Not ready yet',
    };

    ext._shutdown = function() {};

    ext._getStatus = function() {
        return classifierStatus;
    };

    {{#labels}}
    ext.return_label_{{idx}} = function () {
        return '{{name}}';
    };
    {{/labels}}

    var descriptor = {
        blocks : [
            {{#labels}}
            [ 'r', '{{name}}', 'return_label_{{idx}}'],
            {{/labels}}
        ],
        menus : {
            labels : [ {{#labels}} '{{name}}', {{/labels}} ]
        }
    };

    // Register the extension
    ScratchExtensions.register('{{{ projectname }}}', descriptor, ext);
})({});
