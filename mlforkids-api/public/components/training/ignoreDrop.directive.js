(function () {

    angular
        .module('app')
        .directive('ignoreDrop', ignoreDrop);

    /* Students sometimes miss when dragging images into a training bucket for */
    /* handling by mlImageLoader, and accidentally drop the image just outside */
    /* the bucket. This is handled by the browser's default behaviour, which   */
    /* is to navigate to the URL for the dropped image. This has caused        */
    /* confusion in several classes as students don't understand why they've   */
    /* lost their page, or that they need to click 'Back' to return to their   */
    /* training work.                                                          */
    /*                                                                         */
    /* This directive is a way to handle this by capturing and swallowing      */
    /* drag and drop events on divs that hold the training buckets.            */

    function ignoreDrop() {

        function cancel(evt) {
            if (evt && evt.preventDefault) {
                evt.preventDefault();
            }
            return false;
        }

        function link (scope, jqlElements, attrs) {
            var jqlElement = jqlElements[0];

            jqlElement.addEventListener('drop', cancel);
            jqlElement.addEventListener('dragover', cancel);
        }

        return {
            link : link
        };
    }
}());
