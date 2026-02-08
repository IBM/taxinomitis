(function () {

    angular
        .module('app')
        .service('scrollService', scrollService);

    scrollService.$inject = [
        '$timeout', '$document', 'loggerService'
    ];

    function scrollService($timeout, $document, loggerService) {

        /**
         * Scrolls to a newly created element on the page.
         *
         * This function handles the timing issues that can arise by
         * waiting for the digest cycle to complete and the element
         * to be rendered before attempting to scroll.
         *
         * To handle edge cases, it will retry once if an element
         * cannot be found.
         *
         * @param {string|number} itemId - The ID of the element to scroll to
         * @param {Object} options - Optional configuration
         * @param {boolean} options.useParentScroll - If true, scrolls the parent container instead of the document
         * @param {number} options.retryCount - Internal use only, tracks retry attempts
         * @param {Object} options.$scope - Required when useParentScroll is true, provides $applyAsync context
         */
        function scrollToNewItem(itemId, options) {
            options = options || {};
            var useParentScroll = options.useParentScroll || false;
            var retryCount = options.retryCount || 0;
            var maxRetries = 1;

            if (useParentScroll && !options.$scope) {
                loggerService.error('[ml4kscroll] $scope required when useParentScroll is true');
                return;
            }

            function attemptScroll() {
                var newItem = document.getElementById(itemId.toString());

                if (newItem) {
                    if (useParentScroll) {
                        // Scroll within the parent container (for scrollable sections)
                        var itemContainer = newItem.parentElement;
                        angular.element(itemContainer).duScrollToElementAnimated(angular.element(newItem));
                    }
                    else {
                        // Scroll the entire document
                        $document.duScrollToElementAnimated(angular.element(newItem));
                    }
                }
                else if (retryCount < maxRetries) {
                    // Element not found yet, retry once more
                    $timeout(function () {
                        scrollToNewItem(itemId, {
                            useParentScroll: useParentScroll,
                            retryCount: retryCount + 1,
                            $scope: options.$scope
                        });
                    }, 0);
                }
                else {
                    // Element still not found after retry
                    loggerService.error('[ml4kscroll] unable to scroll to new item', itemId);
                }
            }

            if (useParentScroll && options.$scope) {
                // Use $applyAsync for container scrolling to ensure digest cycle completion
                options.$scope.$applyAsync(attemptScroll);
            }
            else {
                // Use $timeout for document scrolling (standard approach)
                $timeout(attemptScroll, 0);
            }
        }


        return {
            scrollToNewItem: scrollToNewItem
        };
    }

})();
