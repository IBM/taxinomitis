(function () {

    angular
        .module('app')
        .controller('TrainingController', TrainingController);

    TrainingController.$inject = [
        'authService',
        'projectsService', 'trainingService',
        '$stateParams',
        '$scope',
        '$mdDialog',
        '$document',
        '$timeout',
        '$q'
    ];

    function TrainingController(authService, projectsService, trainingService, $stateParams, $scope, $mdDialog, $document, $timeout, $q) {

        var vm = this;
        vm.authService = authService;


        var placeholderId = 1;


        var alertId = 1;
        vm.errors = [];
        vm.warnings = [];
        vm.dismissAlert = function (type, errIdx) {
            vm[type].splice(errIdx, 1);
        };
        function displayAlert(type, status, errObj) {
            if (!errObj) {
                errObj = {};
            }
            vm[type].push({
                alertid : alertId++,
                message : errObj.message || errObj.error || 'Unknown error',
                status : status
            });
        }
        vm.displayAlert = displayAlert;

        $scope.loadingtraining = true;

        $scope.crowdSourced = false;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;
        $scope.training = {};

        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then(function (project) {
                $scope.project = project;

                $scope.crowdSourced = project.isCrowdSourced &&
                                      (vm.profile.user_id !== project.userid);

                if (project.type === 'numbers') {
                    return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant);
                }
            })
            .then(function (fields) {
                $scope.project.fields = fields;

                refreshLabelsSummary();

                for (var labelIdx in $scope.project.labels) {
                    var label = $scope.project.labels[labelIdx];
                    $scope.training[label] = [];
                }

                return trainingService.getTraining($scope.projectId, $scope.userId, vm.profile.tenant);
            })
            .then(function (training) {
                $scope.loadingtraining = false;

                for (var trainingitemIdx in training) {
                    var trainingitem = training[trainingitemIdx];

                    var label = trainingitem.label;

                    if (label in $scope.training === false) {
                        $scope.training[label] = [];

                        // TODO need to update the project with this missing label
                    }

                    $scope.training[label].push(trainingitem);
                }
            })
            .catch(function (err) {
                displayAlert('errors', err.status, err.data);
            });


        function refreshLabelsSummary () {
            if ($scope.project.labels.length > 0) {
                var summary = '';
                switch ($scope.project.labels.length) {
                    case 1:
                        summary = $scope.project.labels[0];
                        break;
                    case 2:
                        summary = $scope.project.labels[0] + ' or ' + $scope.project.labels[1];
                        break;
                    case 3:
                        summary = $scope.project.labels[0] + ', ' +
                                    $scope.project.labels[1] + ' or ' +
                                    $scope.project.labels[2];
                        break;
                    default:
                        summary = $scope.project.labels[0] + ', ' +
                                    $scope.project.labels[1] + ' or ' +
                                    ($scope.project.labels.length - 2) + ' other classes';
                        break;
                }
                $scope.project.labelsSummary = summary;
            }
        }


        function getValues(obj) {
            return Object.keys(obj).map(function (key) {
                return obj[key];
            });
        }

        vm.addTrainingData = function (ev, label) {
            $mdDialog.show({
                locals : {
                    label : label,
                    project : $scope.project
                },
                controller : function ($scope, locals) {
                    $scope.label = locals.label;
                    $scope.project = locals.project;
                    $scope.values = {};

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/training/trainingdata.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    vm.addConfirmedTrainingData(resp, label);
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.addConfirmedTrainingData = function (resp, label) {

            var data;
            var placeholder;

            var duplicate = false;

            if ($scope.project.type === 'text') {
                data = resp;

                duplicate = $scope.training[label].some(function (existingitem) {
                    return existingitem.textdata === data;
                });

                placeholder = {
                    id : placeholderId++,
                    label : label,
                    projectid : $scope.projectId,
                    textdata : data,
                    isPlaceholder : true
                };
            }
            else if ($scope.project.type === 'numbers') {
                data = getValues(resp);

                placeholder = {
                    id : placeholderId++,
                    label : label,
                    projectid : $scope.projectId,
                    numberdata : data,
                    isPlaceholder : true
                };
            }
            else if ($scope.project.type === 'images') {
                data = resp;

                duplicate = $scope.training[label].some(function (existingitem) {
                    return existingitem.imageurl === data;
                });

                placeholder = {
                    id : placeholderId++,
                    label : label,
                    projectid : $scope.projectId,
                    imageurl : data,
                    isPlaceholder : true
                };
            }

            if (duplicate) {
                return displayAlert('errors', 400, {
                    message : 'That is already in your training data'
                });
            }

            $scope.training[label].push(placeholder);

            trainingService.newTrainingData($scope.projectId, $scope.userId, vm.profile.tenant, data, label)
                .then(function (newitem) {
                    placeholder.isPlaceholder = false;
                    placeholder.id = newitem.id;

                    scrollToNewItem(newitem.id);
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);

                    var idxToRemove = findTrainingIndex(label, placeholder.id);
                    if (idxToRemove !== -1) {
                        $scope.training[label].splice(idxToRemove, 1);
                    }
                });
        };


        vm.onImageLoad = function (image) {
            console.log(image);
            console.log('on image load');
        };

        vm.onImageError = function (image) {
            image.loadingFailed = true;
            // displayAlert('errors', 400, {
            //     error : 'Image (' + image.imageurl + ') in the ' + image.label + ' bucket could not be loaded, and has been highlighted in red. You should delete it.'
            // });
        };


        vm.addLabel = function (ev, project) {
            $mdDialog.show({
                controller : function ($scope, $mdDialog) {
                    $scope.hide = function () {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function () {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function (resp) {
                        $mdDialog.hide(resp);
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/training/newlabel.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (newlabel) {
                    projectsService.addLabelToProject($scope.projectId, $scope.userId, vm.profile.tenant, newlabel)
                        .then(function (labels) {
                            $scope.project.labels = labels;
                            for (var i = 0; i < labels.length; i++) {
                                if (!$scope.training[labels[i]]){
                                    $scope.training[labels[i]] = [];
                                }
                            }

                            refreshLabelsSummary();
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.deleteText = function (label, item, idx) {
            $scope.training[label].splice(idx, 1);
            trainingService.deleteTrainingData($scope.projectId, $scope.userId, vm.profile.tenant, item.id);
        };

        vm.deleteLabel = function (ev, label, idx) {
            var confirm = $mdDialog.confirm()
                .title('Are you sure?')
                .textContent('Do you want to delete "' + label + '"? (This cannot be undone)')
                .ariaLabel('Confirm')
                .targetEvent(ev)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(
                function() {
                    delete $scope.training[label];
                    $scope.project.labels.splice(idx, 1);

                    refreshLabelsSummary();

                    projectsService.removeLabelFromProject($scope.projectId, $scope.userId, vm.profile.tenant, label)
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.useWebcam = function (ev, label) {
            $mdDialog.show({
                locals : {
                    label : label,
                    project : $scope.project
                },
                controller : function ($scope, locals) {
                    $scope.label = locals.label;
                    $scope.project = locals.project;
                    $scope.values = {};
                    $scope.channel = {};
                    $scope.webcamerror = false;
                    $scope.webcamInitComplete = false;

                    $scope.webcamCanvas = null;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        getWebcamData()
                            .then(function (imagedata) {
                                $mdDialog.hide(imagedata);
                            });
                    };


                    $scope.onWebcamSuccess = function () {
                        $scope.$apply(function() {
                            $scope.webcamInitComplete = true;
                        });
                    };

                    function displayWebcamError(err) {
                        $scope.webcamerror = err;
                        if (err && err.message) {
                            if (err.name === 'NotAllowedError') {
                                $scope.webcamerrordetail = 'Not allowed to use the web-cam';
                            }
                            else {
                                $scope.webcamerrordetail = err.message;
                            }
                        }
                    }

                    $scope.onWebcamError = function(err) {
                        $scope.webcamInitComplete = true;

                        try {
                            $scope.$apply(
                                function() {
                                    displayWebcamError(err);
                                }
                            );
                        }
                        catch (applyErr) {
                            $timeout(function () {
                                displayWebcamError(err);
                            }, 0, false);
                        }
                    };


                    function getWebcamData() {
                        var hiddenCanvas = document.createElement('canvas');
                        hiddenCanvas.width = $scope.channel.video.width;
                        hiddenCanvas.height = $scope.channel.video.height;

                        var ctx = hiddenCanvas.getContext('2d');
                        ctx.drawImage($scope.channel.video,
                            0, 0,
                            $scope.channel.video.width, $scope.channel.video.height);

                        return $q(function(resolve, reject) {
                            hiddenCanvas.toBlob(function (blob) {
                                resolve(blob);
                            }, 'image/jpeg');
                        });
                    };

                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/training/webcam.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    var placeholder = {
                        id : placeholderId++,
                        label : label,
                        projectid: $scope.projectId,
                        imageurl : URL.createObjectURL(resp),
                        isPlaceholder : true
                    };

                    $scope.training[label].push(placeholder);

                    trainingService.uploadImage($scope.project.id, $scope.userId, vm.profile.tenant, resp, label)
                        .then(function (newitem) {
                            placeholder.isPlaceholder = false;
                            placeholder.id = newitem.id;

                            scrollToNewItem(newitem.id);
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);

                            var idxToRemove = findTrainingIndex(label, placeholder.id);
                            if (idxToRemove !== -1) {
                                $scope.training[label].splice(idxToRemove, 1);
                            }
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };



        vm.useCanvas = function (ev, label) {
            $mdDialog.show({
                locals : {
                    label : label,
                    project : $scope.project
                },
                controller : function ($scope, locals) {
                    $scope.label = locals.label;
                    $scope.project = locals.project;
                    $scope.values = {};

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        getCanvasData()
                            .then(function (imagedata) {
                                $mdDialog.hide(imagedata);
                            });
                    };


                    function getCanvasData() {
                        return $q(function(resolve, reject) {
                            $scope.canvas.toBlob(function (blob) {
                                resolve(blob);
                            }, 'image/jpeg');
                        });
                    };
                },
                templateUrl : 'static/components-' + $stateParams.VERSION + '/training/canvas.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    var placeholder = {
                        id : placeholderId++,
                        label : label,
                        projectid: $scope.projectId,
                        imageurl : URL.createObjectURL(resp),
                        isPlaceholder : true
                    };

                    $scope.training[label].push(placeholder);

                    trainingService.uploadImage($scope.project.id, $scope.userId, vm.profile.tenant, resp, label)
                        .then(function (newitem) {
                            placeholder.isPlaceholder = false;
                            placeholder.id = newitem.id;

                            scrollToNewItem(newitem.id);
                        })
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);

                            var idxToRemove = findTrainingIndex(label, placeholder.id);
                            if (idxToRemove !== -1) {
                                $scope.training[label].splice(idxToRemove, 1);
                            }
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                var itemContainer = newItem.parentElement;
                angular.element(itemContainer).duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }



        function findTrainingIndex(label, id) {
            var len = $scope.training[label].length;
            for (var i = 0; i < len; i++) {
                if ($scope.training[label][i].id === id) {
                    return i;
                }
            }
            return -1;
        }









        $scope.getController = function() {
            return vm;
        };
    }
}());
