describe('ModelDescribeController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;
    var $timeout;
    var $interval;

    var authServiceMock, loggerServiceMock, browserStorageServiceMock, projectsServiceMock, scrollServiceMock;
    var $stateParamsMock;

    var profile;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_, _$interval_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $interval = _$interval_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1' };

        authServiceMock = jasmine.createSpyObj('authService', ['getProfileDeferred', 'login']);
        authServiceMock.getProfileDeferred.and.returnValue($q.resolve(profile));

        projectsServiceMock = jasmine.createSpyObj('projectsService', ['getProject', 'getFields']);

        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', ['retrieveAssetAsText']);

        scrollServiceMock = jasmine.createSpyObj('scrollService', ['scrollToNewItem']);

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error', 'warn']);

        $stateParamsMock = { projectId : 'proj1', userId : 'user1', modelId : 'model1' };
    });

    function createController() {
        return $controller('ModelDescribeController', {
            authService : authServiceMock,
            loggerService : loggerServiceMock,
            browserStorageService : browserStorageServiceMock,
            projectsService : projectsServiceMock,
            scrollService : scrollServiceMock,
            $stateParams : $stateParamsMock,
            $scope : $scope,
            $timeout : $timeout,
            $interval : $interval
        });
    }

    // wires up browserStorageService.retrieveAssetAsText to resolve different
    // text per asset suffix, the way the real service does for a single project
    function mockAssets(assets) {
        browserStorageServiceMock.retrieveAssetAsText.and.callFake(function (key) {
            var suffix = key.split('-').pop();
            if (Object.prototype.hasOwnProperty.call(assets, suffix)) {
                return $q.resolve(assets[suffix]);
            }
            return $q.reject({ status : 404 });
        });
    }


    describe('initial state', function () {

        it('sets loading and reads ids from $stateParams synchronously, before anything resolves', function () {
            projectsServiceMock.getProject.and.returnValue($q.defer().promise);

            createController();

            expect($scope.loading).toBe(true);
            expect($scope.projectId).toBe('proj1');
            expect($scope.userId).toBe('user1');
            expect($scope.modelId).toBe('model1');
        });

    });


    describe('error handling', function () {

        it('shows a friendly warning and scrolls to it when there is no trained model yet (404 fetching the tree)', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            mockAssets({});

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors).toEqual([]);
            expect(vm.warnings.length).toBe(1);
            expect(vm.warnings[0].message).toBe('Model information is not available. Try training a new model.');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('warnings1');
            expect($scope.loading).toBe(false);
        });

        it('shows a generic error (not the friendly warning) when the project itself 404s', function () {
            projectsServiceMock.getProject.and.returnValue($q.reject({ status : 404, data : { message : 'project not found' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.warnings).toEqual([]);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('project not found');
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
        });

        it('shows a generic error alert for a non-404 failure', function () {
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            browserStorageServiceMock.retrieveAssetAsText.and.returnValue($q.reject({ status : 500, data : { error : 'server exploded' } }));

            var vm = createController();
            $rootScope.$digest();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('server exploded');
            expect(vm.errors[0].status).toBe(500);
            expect(scrollServiceMock.scrollToNewItem).toHaveBeenCalledWith('errors1');
        });

    });


    describe('dismissAlert', function () {

        it('removes only the alert at the given index from the given list', function () {
            var vm = createController();
            vm.errors = [ { message : 'a' }, { message : 'b' }, { message : 'c' } ];

            vm.dismissAlert('errors', 1);

            expect(vm.errors).toEqual([ { message : 'a' }, { message : 'c' } ]);
        });

    });


    // The decision tree diagram is graphviz-generated SVG, spliced directly into
    // the real document (not compiled from an Angular template), and the tree
    // parsing/highlighting logic only runs against that real DOM - so a
    // controller-only test can't see it. These tests build a small hand-crafted
    // tree (matching the format the code's own regexes expect) and a matching
    // SVG fixture with .node/.edge elements, following the DOM-level test
    // approach described in FRONTEND_TESTING.md.
    describe('decision tree visualisation (DOM-level)', function () {

        var svghost;

        beforeEach(function () {
            svghost = document.createElement('div');
            svghost.id = 'mlforkidsmodelvizimghost';
            document.body.appendChild(svghost);
        });

        afterEach(function () {
            svghost.remove();
        });

        function svgFixture() {
            return '<svg>' +
                '<g class="node" id="node1"></g>' +
                '<g class="node" id="node2"></g>' +
                '<g class="node" id="node3"></g>' +
                '<g class="edge" id="edge1"></g>' +
                '<g class="edge" id="edge2"></g>' +
                '</svg>';
        }

        function highlightedIds() {
            return Array.prototype.map.call(
                document.querySelectorAll('#mlforkidsmodelvizimg .highlighted'),
                function (el) { return el.id; }
            ).sort();
        }

        function notHighlightedIds() {
            return Array.prototype.map.call(
                document.querySelectorAll('#mlforkidsmodelvizimg .nothighlighted'),
                function (el) { return el.id; }
            ).sort();
        }

        // root node splits on a numeric field "size <= 5.5"; node1 is the true
        // (<=) branch leaf, node2 is the false (>) branch leaf
        function numericTreeDot() {
            return [
                '0 [fillcolor="#399de5", label="size <= 5.5\\ngini = 0.5\\nsamples = 4\\nvalue = [2, 2]"];',
                '1 [fillcolor="#e58139", label="gini = 0.0\\nsamples = 2\\nvalue = [2, 0]"];',
                '0 -> 1;',
                '2 [fillcolor="#399de5", label="gini = 0.0\\nsamples = 2\\nvalue = [0, 2]"];',
                '0 -> 2;'
            ].join('\n');
        }

        function setupNumericTree(fields) {
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            projectsServiceMock.getFields.and.returnValue($q.resolve(fields || [ { name : 'size', type : 'number' } ]));
            mockAssets({
                tree : svgFixture(),
                dot : numericTreeDot(),
                vocab : JSON.stringify([ 'size' ])
            });

            var vm = createController();
            $rootScope.$digest();
            $timeout.flush();
            return vm;
        }

        it('highlights the true (<=) branch when the numeric value is below the threshold', function () {
            var vm = setupNumericTree();

            vm.highlight({ size : '3' });

            expect(highlightedIds()).toEqual([ 'edge1', 'node1', 'node2' ]);
            expect(notHighlightedIds()).toEqual([ 'edge2', 'node3' ]);
        });

        it('highlights the false (>) branch when the numeric value is above the threshold, proving values are compared numerically not lexicographically', function () {
            // "10" <= "5.5" is true as a *string* comparison ('1' < '5'), but
            // false numerically - this only passes if cleanupTestData actually
            // converts the form value to a Number before the comparison
            var vm = setupNumericTree();

            vm.highlight({ size : '10' });

            expect(highlightedIds()).toEqual([ 'edge2', 'node1', 'node3' ]);
            expect(notHighlightedIds()).toEqual([ 'edge1', 'node2' ]);
        });

        it('resetTree clears all highlighting classes', function () {
            var vm = setupNumericTree();
            vm.highlight({ size : '3' });

            vm.resetTree();

            expect(highlightedIds()).toEqual([]);
            expect(notHighlightedIds()).toEqual([]);
        });

        it('highlighting again from a fresh test clears any previous highlighting first', function () {
            var vm = setupNumericTree();
            vm.highlight({ size : '3' });

            vm.highlight({ size : '10' });

            expect(highlightedIds()).toEqual([ 'edge2', 'node1', 'node3' ]);
            expect(notHighlightedIds()).toEqual([ 'edge1', 'node2' ]);
        });

        // root node splits on a one-hot-encoded multichoice field "colour=red <= 0.5"
        function multichoiceTreeDot() {
            return [
                '0 [fillcolor="#399de5", label="colour=red <= 0.5\\ngini = 0.5\\nsamples = 4\\nvalue = [2, 2]"];',
                '1 [fillcolor="#e58139", label="gini = 0.0\\nsamples = 2\\nvalue = [2, 0]"];',
                '0 -> 1;',
                '2 [fillcolor="#399de5", label="gini = 0.0\\nsamples = 2\\nvalue = [0, 2]"];',
                '0 -> 2;'
            ].join('\n');
        }

        function setupMultichoiceTree() {
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            projectsServiceMock.getFields.and.returnValue($q.resolve([ { name : 'colour', type : 'multichoice', choices : [ 'red', 'blue' ] } ]));
            mockAssets({
                tree : svgFixture(),
                dot : multichoiceTreeDot(),
                vocab : JSON.stringify([ 'colour=red' ])
            });

            var vm = createController();
            $rootScope.$digest();
            $timeout.flush();
            return vm;
        }

        it('takes the false branch (node3/edge2) when the selected choice matches the one-hot feature', function () {
            var vm = setupMultichoiceTree();

            vm.highlight({ colour : 'red' });

            expect(highlightedIds()).toEqual([ 'edge2', 'node1', 'node3' ]);
        });

        it('takes the true branch (node2/edge1) when the selected choice does not match the one-hot feature', function () {
            var vm = setupMultichoiceTree();

            vm.highlight({ colour : 'blue' });

            expect(highlightedIds()).toEqual([ 'edge1', 'node1', 'node2' ]);
        });

        it('logs an error and stops at the node instead of throwing, if a node test does not match the expected "field op threshold" syntax', function () {
            var malformedDot = [
                '0 [fillcolor="#399de5", label="size >= 5.5\\ngini = 0.5\\nsamples = 4\\nvalue = [2, 2]"];',
                '1 [fillcolor="#e58139", label="gini = 0.0\\nsamples = 2\\nvalue = [2, 0]"];',
                '0 -> 1;',
                '2 [fillcolor="#399de5", label="gini = 0.0\\nsamples = 2\\nvalue = [0, 2]"];',
                '0 -> 2;'
            ].join('\n');
            projectsServiceMock.getProject.and.returnValue($q.resolve({ id : 'proj1' }));
            projectsServiceMock.getFields.and.returnValue($q.resolve([ { name : 'size', type : 'number' } ]));
            mockAssets({
                tree : svgFixture(),
                dot : malformedDot,
                vocab : JSON.stringify([ 'size' ])
            });
            var vm = createController();
            $rootScope.$digest();
            $timeout.flush();

            vm.highlight({ size : '3' });

            expect(loggerServiceMock.error).toHaveBeenCalledWith('[ml4kdescribe] Unexpected test syntax');
            expect(highlightedIds()).toEqual([ 'node1' ]);
            expect(notHighlightedIds()).toEqual([ 'edge1', 'edge2', 'node2', 'node3' ]);
        });

    });


    // vm.grow/shrink/goleft/goright/goup/godown drive $interval-based panning
    // and zooming of the diagram - these are pure controller/DOM behaviour and
    // don't need the full load chain to have completed.
    describe('pan and zoom controls', function () {

        var vizImg, vizHost;

        beforeEach(function () {
            projectsServiceMock.getProject.and.returnValue($q.defer().promise);

            vizImg = document.createElement('div');
            vizImg.id = 'mlforkidsmodelvizimg';

            // a real browser clamps scrollLeft/scrollTop to 0 unless the
            // element actually has overflowing content to scroll through
            vizHost = document.createElement('div');
            vizHost.id = 'mlforkidsmodelvizimghost';
            vizHost.style.width = '50px';
            vizHost.style.height = '50px';
            vizHost.style.overflow = 'scroll';
            var scrollableContent = document.createElement('div');
            scrollableContent.style.width = '500px';
            scrollableContent.style.height = '500px';
            vizHost.appendChild(scrollableContent);

            document.body.appendChild(vizImg);
            document.body.appendChild(vizHost);
        });

        afterEach(function () {
            vizImg.remove();
            vizHost.remove();
        });

        it('grow increases the diagram width by 10% every tick', function () {
            var vm = createController();

            vm.grow();
            $interval.flush(50);
            expect(vizImg.style.width).toBe('110%');
            $interval.flush(50);
            expect(vizImg.style.width).toBe('120%');
        });

        it('stop cancels an in-progress grow', function () {
            var vm = createController();

            vm.grow();
            $interval.flush(50);
            vm.stop();
            $interval.flush(200);

            expect(vizImg.style.width).toBe('110%');
        });

        it('shrink decreases the diagram width by 10% every tick, but never below 100%', function () {
            var vm = createController();
            vm.grow();
            $interval.flush(100);
            vm.stop();
            expect(vizImg.style.width).toBe('120%');

            vm.shrink();
            $interval.flush(200);

            expect(vizImg.style.width).toBe('100%');
        });

        it('goleft/goright scroll the host container horizontally', function () {
            var vm = createController();

            vm.goleft();
            $interval.flush(50);
            expect(vizHost.scrollLeft).toBe(20);
            vm.stop();

            vm.goright();
            $interval.flush(50);
            expect(vizHost.scrollLeft).toBe(0);
        });

        it('goup/godown scroll the host container vertically', function () {
            var vm = createController();

            vm.godown();
            $interval.flush(50);
            expect(vizHost.scrollTop).toBe(20);
            vm.stop();

            vm.goup();
            $interval.flush(50);
            expect(vizHost.scrollTop).toBe(0);
        });

    });

});
