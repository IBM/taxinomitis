(function () {

    angular
        .module('app')
        .controller('ModelDescribeController', ModelDescribeController);

        ModelDescribeController.$inject = [
            'authService', 'loggerService', 'browserStorageService', 'projectsService',
            '$stateParams', '$scope', '$timeout', '$interval', '$document'
        ];

    function ModelDescribeController(authService, loggerService, browserStorageService, projectsService, $stateParams, $scope, $timeout, $interval, $document) {
        var vm = this;
        vm.authService = authService;


        $scope.loading = true;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;
        $scope.modelId = $stateParams.modelId;

        $scope.modelinfo = undefined;
        $scope.treenodes = {};

        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            loggerService.error(errObj);

            if (!errObj) {
                errObj = {};
            }

            // create alert and display it
            var newId = alertId++;
            var newAlert = {
                code : errObj.code,
                alertid : newId,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            };
            vm[type].push(newAlert);

            return newId;
        }

        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }

        function getAssetAsJson(key) {
            return browserStorageService.retrieveAssetAsText(key)
                .then((text) => {
                    return JSON.parse(text);
                });
        }


        authService.getProfileDeferred()
            .then((profile) => {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, $scope.userId, vm.profile.tenant);
            })
            .then((project) => {
                $scope.project = project;

                return browserStorageService.retrieveAssetAsText($scope.projectId + '-tree');
            })
            .then((tree) => {
                $scope.loading = false;
                $scope.modelinfo = true;

                initializeVisualisation(tree);

                return browserStorageService.retrieveAssetAsText($scope.projectId + '-dot');
            })
            .then((dot) => {
                prepareDecisionTreeGraph(dot);

                return getAssetAsJson($scope.projectId + '-vocab');
            })
            .then((vocab) => {
                $scope.vocabulary = vocab;

                loggerService.debug('[ml4kdesc] getting project fields');
                return projectsService.getFields($scope.project, $scope.userId, vm.profile.tenant);
            })
            .then(function (fields) {
                loggerService.debug('[ml4kdesc] fields', fields);
                $scope.project.fields = fields;
            })
            .catch(function (err) {
                var errId = displayAlert('errors', err.status, err.data);
                scrollToNewItem('errors' + errId);
                $scope.loading = false;
            });


        //-------------------------------------------------------------------------------
        // Adding the decision tree graphic to the page
        //-------------------------------------------------------------------------------

        function initializeVisualisation(svgdata) {
            loggerService.debug('[ml4kdesc] initializing visualization');
            $timeout(function () {
                // prepare somewhere to put the decision tree graphic
                var svgcontainer = document.createElement("div");
                svgcontainer.id = 'mlforkidsmodelvizimg';
                svgcontainer.innerHTML = svgdata;

                // find where we need to add the visualization in the component
                var svghost = document.getElementById('mlforkidsmodelvizimghost');
                svghost.appendChild(svgcontainer);

                // modify the visualization to add some custom styles needed for highlighting
                var svgroot = svgcontainer.getElementsByTagName('svg')[0];
                svgroot.removeAttribute('width');
                svgroot.removeAttribute('height');
                var styleElement = document.createElement("style");
                styleElement.textContent = ".nothighlighted { opacity: 0.25; } .highlighted { opacity: 1; } .highlighted.node path { stroke-width: 3; }";
                svgroot.insertBefore(styleElement, svgroot.firstChild);
            }, 0);
        }



        //-------------------------------------------------------------------------------
        // Processing the graph to build up info needed to highlight nodes
        //-------------------------------------------------------------------------------

        // parse the description of the test that graphviz puts into each node in the tree
        var SEGMENT_REGEX = /^(.*) ([<=]{1,2}) (-?[0-9.]+)$/;
        function getTestInfo(test) {
            var segmentChunks = SEGMENT_REGEX.exec(test);
            if (segmentChunks) {
                return {
                    field : segmentChunks[1],
                    op : segmentChunks[2],
                    threshold : segmentChunks[3]
                };
            }
            else {
                loggerService.error('[ml4kdescribe] Unexpected test syntax');
                loggerService.error(test);
            }
        }

        // parse the dot file to identify the edges between nodes in the tree
        var GRAPHVIZ_NODE_REGEX = /^([0-9]+) \[fillcolor="#[a-z0-9]{6}", label="((.*?)\\n.*)"];$/;
        var GRAPHVIZ_EDGE_REGEX = /^([0-9]+) -> ([0-9]+).*;$/;
        function prepareDecisionTreeGraph(dotfile) {
            loggerService.debug('[ml4kdesc] preparing decision tree graph');
            var edgeid = 1;

            var dotfilelines = dotfile.split('\n');
            for (var i = 0; i < dotfilelines.length; i++) {
                var line = dotfilelines[i];

                var nodeTestMatches = GRAPHVIZ_NODE_REGEX.exec(line);
                if (nodeTestMatches) {
                    var nodeid = nodeTestMatches[1];
                    var nodeattrs = nodeTestMatches[2].split('\\n');
                    var nodetest = nodeTestMatches[3];

                    $scope.treenodes[nodeid] = { id : nodeid, children : [], edges : [] };
                    if (nodeattrs.length === 4) {
                        $scope.treenodes[nodeid].test = getTestInfo(nodetest);
                    }
                }
                else {
                    var edgeTestMatches = GRAPHVIZ_EDGE_REGEX.exec(line);
                    if (edgeTestMatches) {
                        var left = edgeTestMatches[1];
                        var right = edgeTestMatches[2];
                        $scope.treenodes[left].children.push(right);


                        var nextedge = edgeid++;
                        $scope.treenodes[left].edges.push(nextedge);
                    }
                }
            }
        }


        // identify edges and nodes in the tree for a given set of input values
        function identifyTreeRoute(rawdata) {
            loggerService.debug('[ml4kdesc] identifying tree route');
            var answers = {};

            for (var featureidx = 0; featureidx < $scope.vocabulary.length; featureidx++) {
                var feature = $scope.vocabulary[featureidx];

                var split = feature.indexOf('=');
                if (split === -1) {
                    answers[feature] = rawdata[feature];
                }
                else {
                    var field = feature.substring(0, split);
                    var option = feature.substring(split + 1);

                    answers[feature] = (option === rawdata[field]) ? 1 : 0;
                }
            }

            var itemsToHighlight = [];

            var nextnode = $scope.treenodes[0];
            while (nextnode) {
                itemsToHighlight.push('node' + (parseInt(nextnode.id) + 1));

                if (nextnode.test) {
                    var test = nextnode.test;

                    var testValue = answers[test.field];

                    var testPass = false;
                    if (test.op === '<=') {
                        testPass = (testValue <= test.threshold);
                    }
                    else if (test.op === '=') {
                        testPass = (testValue === test.threshold);
                    }

                    var nextnodeid = testPass ? nextnode.children[0] : nextnode.children[1];
                    itemsToHighlight.push('edge' + (testPass ? nextnode.edges[0] : nextnode.edges[1]));
                    nextnode = $scope.treenodes[nextnodeid];
                }
                else {
                    nextnode = undefined;
                }
            }

            return itemsToHighlight;
        }


        // make sure that numeric values are treated as numbers, not strings
        function cleanupTestData(rawdata) {
            for (var i = 0; i < $scope.project.fields.length; i++) {
                var field = $scope.project.fields[i];
                if (field.type === 'number') {
                    rawdata[field.name] = Number(rawdata[field.name]);
                }
            }
            return rawdata;
        }



        //-------------------------------------------------------------------------------
        // Highlighting nodes in the tree
        //-------------------------------------------------------------------------------

        $scope.testformData = {};

        vm.resetTree = function () {
            loggerService.debug('[ml4kdesc] resetting decision tree');

            // remove custom highlighting classes from all edges and nodes
            var mysvg = document.getElementById('mlforkidsmodelvizimg');
            var things = mysvg.querySelectorAll('.node,.edge');
            for (var i = 0; i < things.length; i++) {
                var thing = things[i];
                thing.classList.remove("highlighted");
                thing.classList.remove("nothighlighted");
            }
        };

        vm.highlight = function (rawdata) {
            loggerService.debug('[ml4kdesc] adding highlight');

            // clear any existing highlighting classes
            vm.resetTree();

            // identify the edges and nodes to highlight
            var itemsToHighlight = identifyTreeRoute(cleanupTestData(rawdata));

            // add highlighting classes to edges and nodes
            var mysvg = document.getElementById('mlforkidsmodelvizimg');
            var things = mysvg.querySelectorAll('.node,.edge');
            for (var i = 0; i < things.length; i++) {
                var thing = things[i];
                if (itemsToHighlight.indexOf(thing.id) >= 0) {
                    thing.classList.add("highlighted");
                }
                else {
                    thing.classList.add("nothighlighted");
                }
            }
        };




                //-------------------------------------------------------------------------------
        // Moving the decision tree graphic around
        //-------------------------------------------------------------------------------

        var operation;

        vm.stop = function() {
            if (operation) {
                $interval.cancel(operation);
                clearInterval(operation);
                operation = undefined;
            }
        };

        var REPEAT_INTERVAL = 50;
        var SCROLL_PIXELS = 20;
        var scale = 100;


        vm.grow = function() {
            vm.stop();
            var image = document.getElementById("mlforkidsmodelvizimg");
            operation = $interval(function () {
                scale += 10;
                image.style["width"] = scale + "%";
            }, REPEAT_INTERVAL);
        };

        vm.shrink = function() {
            vm.stop();
            var image = document.getElementById("mlforkidsmodelvizimg");
            operation = $interval(function () {
                if (scale > 100) {
                    scale -= 10;
                    image.style["width"] = scale + "%";
                }
            }, REPEAT_INTERVAL);
        };

        vm.goleft = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft += SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.goright = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollLeft -= SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.goup = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop -= SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };
        vm.godown = function() {
            vm.stop();
            var container = document.getElementById("mlforkidsmodelvizimghost");
            operation = $interval(function () {
                container.scrollTop += SCROLL_PIXELS;
            }, REPEAT_INTERVAL);
        };


        //-------------------------------------------------------------------------------

    }
}());
