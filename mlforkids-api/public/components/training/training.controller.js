(function () {

    angular
        .module('app')
        .controller('TrainingController', TrainingController);

    TrainingController.$inject = [
        'authService',
        'projectsService', 'trainingService', 'modelService',
        'soundTrainingService',
        'utilService',
        'loggerService',
        '$stateParams',
        '$scope',
        '$mdDialog',
        '$state',
        '$timeout',
        '$q'
    ];

    function TrainingController(authService, projectsService, trainingService, modelService, soundTrainingService, utilService, loggerService, $stateParams, $scope, $mdDialog, $state, $timeout, $q) {

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
            else {
                // record the error
                loggerService.error(errObj);
                if (status === 500 && Sentry && Sentry.captureException) {
                    Sentry.captureException({ error : errObj, errortype : typeof (errObj) });
                }
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
        $scope.reviewing = $stateParams.review;

        $scope.projectId = $stateParams.projectId;
        $scope.userId = $stateParams.userId;
        $scope.training = {};



        // check that they're authenticated before doing anything else
        authService.getProfileDeferred()
            .then(function (profile) {
                vm.profile = profile;

                // get the project that we're going to be training
                loggerService.debug('[ml4ktraining] getting project info');
                return projectsService.getProject($scope.projectId, $scope.userId, profile.tenant);
            })
            .then(function (project) {
                loggerService.debug('[ml4ktraining] project', project);
                $scope.project = project;

                // if the user doesn't own the project (it's been shared with them by a teacher
                //  using the "crowd-sourced" mode) then we need to hide some of the controls
                $scope.crowdSourced = project.isCrowdSourced &&
                                      (vm.profile.user_id !== project.userid);

                // for non-text projects we need to fetch some more things...

                if (project.type === 'numbers') {
                    // for numbers projects we need the fields to populate the drop-downs for new values
                    loggerService.debug('[ml4ktraining] getting project fields');
                    return projectsService.getFields($scope.projectId, $scope.userId, vm.profile.tenant)
                        .then(function (fields) {
                            $scope.project.fields = fields;
                            $scope.projectfieldnames = fields.map(function (field) {
                                return field.name;
                            });
                            loggerService.debug('[ml4ktraining] field names', $scope.projectfieldnames);
                        });
                }
                else if (project.type === 'sounds') {
                    // for sounds projects we need to download the TensorFlow.js libraries if we don't
                    //  already have them in the page
                    loggerService.debug('[ml4ktraining] setting up sound model support');
                    var loadSavedModel = false; // only using sound support to collect training examples
                    return soundTrainingService.initSoundSupport(project.id, project.labels, loadSavedModel)
                        .then(function () {
                            $scope.soundModelInfo = soundTrainingService.getModelInfo();
                        });
                }
                else if (project.type === 'imgtfjs') {
                    // for image projects, we need to inject the dependencies for the
                    //  webcam and canvas controls
                    loggerService.debug('[ml4ktraining] fetching image project dependencies');
                    return utilService.loadImageProjectSupport();
                }
            })
            .then(function () {
                // we should have everything we need to prepare the page header now
                refreshLabelsSummary();

                // prepare the empty training buckets for the project
                for (var labelIdx in $scope.project.labels) {
                    var label = $scope.project.labels[labelIdx];
                    $scope.training[label] = [];
                }

                // fetch the training data to populate the buckets with
                loggerService.debug('[ml4ktraining] getting training data');
                return trainingService.getTraining($scope.projectId, $scope.userId, vm.profile.tenant);
            })
            .then(function (training) {
                // all the training data items will be returned in one list
                //  so they need to be sorted into the different buckets now
                for (var trainingitemIdx in training) {
                    var trainingitem = training[trainingitemIdx];

                    var label = trainingitem.label;

                    if (label in $scope.training === false) {
                        // This shouldn't happen - it means that we got some training data
                        //  for a label that isn't known to the project.
                        //
                        // It means the page state is out of date (e.g. the label was created
                        //  after the page was first loaded from another instance of the page)
                        //  which is a super unlikely race condition, but we avoid the possible
                        //  error by creating a new bucket with this new label
                        $scope.training[label] = [];
                    }

                    $scope.training[label].push(trainingitem);

                    // if this is a text project...
                    //          trainingitem has the complete data - nothing left to do
                    // if this is a numbers project...
                    //          trainingitem has the complete data - nothing left to do
                    // if this is an images project...
                    //          trainingitem has the URL for the image, but the browser will fetch it
                    //              for us automatically when we put it in the img src attribute
                    //              so nothing left to do in code here, but there will be another
                    //              network request before the image appears in the UI
                    // if this is a sounds project...
                    //          trainingitem has the URL for the sound spectogram, but we need to
                    //              explicitly fetch it now (the page will display a loading icon
                    //              until we get it)



                    if ($scope.project.type === 'sounds') {
                        // this will modify 'trainingitem' to add a 'audiodata' attribute
                        //  (but not immediately as it'll need to make an XHR request to get it)
                        trainingService.getSoundData(trainingitem);
                    }
                }

                $scope.loadingtraining = false;
            })
            .catch(function (err) {
                loggerService.error('[ml4ktraining] error', err);
                displayAlert('errors', err.status, err.data ? err.data : err);
            });


        function refreshLabelsSummary () {
            var summary = '';
            if ($scope.project.labels.length > 0) {
                var labels = $scope.project.type === 'sounds' ?
                    $scope.project.labels.filter(function (label) {
                        return label !== '_background_noise_';
                    }) :
                    $scope.project.labels;

                summary = modelService.generateProjectSummary(labels) || '';
            }
            $scope.project.labelsSummary = summary;
        }


        function getNumberValues(obj) {
            var fields = $scope.projectfieldnames ? $scope.projectfieldnames : Object.keys(obj);
            return fields.map(function (key) {
                return obj[key];
            });
        }

        vm.addTrainingData = function (ev, label) {
            loggerService.debug('[ml4ktraining] addTrainingData');
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
                    $scope.submitOnEnter = function(event) {
                        var code = event.keyCode || event.which;
                        if (code === 13) {
                            event.preventDefault();
                            $scope.confirm($scope.example);
                        }
                    };

                    $scope.$watch('example', function (newval, oldval) {
                        if ($scope && $scope.example && newval !== oldval) {
                            $scope.example = newval.replace(/[\r\n\t]/g, ' ');
                        }
                    }, true);
                },
                templateUrl : 'static/components/training/trainingdata.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    if ($scope.project.type === 'imgtfjs') {
                        try {
                            // do this to encode any URL characters that might need it
                            resp = new URL(resp).toString();
                        }
                        catch (err) {
                            loggerService.debug('[ml4ktraining] unable to escape URL characters, using raw string', err);
                        }
                    }
                    vm.addConfirmedTrainingData(resp, label);
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.addConfirmedTrainingData = function (resp, label) {
            loggerService.debug('[ml4ktraining] addConfirmedTrainingData');

            var data;
            var placeholder;

            var duplicate = false;

            var storeTrainingDataFn = trainingService.newTrainingData;

            if ($scope.project.type === 'text') {
                data = resp;

                var lc = data.toLowerCase();
                duplicate = $scope.training[label].some(function (existingitem) {
                    return existingitem.textdata.toLowerCase() === lc;
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
                data = getNumberValues(resp);

                placeholder = {
                    id : placeholderId++,
                    label : label,
                    projectid : $scope.projectId,
                    numberdata : data,
                    isPlaceholder : true
                };
            }
            else if ($scope.project.type === 'imgtfjs') {
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
            else if ($scope.project.type === 'sounds') {
                // convert the Float32Array we get from the dialog
                //  into a regular old JavaScript array
                // (could use Array.from(resp) but IE doesnt like it)
                data = Array.prototype.slice.call(resp);

                // duplicates are super unlikely so we're not going to
                //  waste time checking

                placeholder = {
                    id : placeholderId++,
                    label : label,
                    projectid : $scope.projectId,
                    audiodata : data,
                    isPlaceholder : true
                };

                // IMPORTANT - we use a different API for uploading sound
                storeTrainingDataFn = trainingService.uploadSound;
            }

            if (duplicate) {
                return displayAlert('errors', 400, {
                    message : 'That is already in your training data'
                });
            }

            $scope.training[label].push(placeholder);

            loggerService.debug('[ml4ktraining] storing training data');
            storeTrainingDataFn($scope.projectId, $scope.userId, vm.profile.tenant, data, label)
                .then(function (newitem) {
                    placeholder.isPlaceholder = false;
                    placeholder.id = newitem.id;

                    if ($scope.project.type === 'imgtfjs' && placeholder.imageurl)
                    {
                        if (utilService.isGoogleFilesUrl(placeholder.imageurl)) {
                            displayAlert('warnings', 400, { message :
                                'Google often removes access to images on ' +
                                'googleusercontent.com and lh3.google.com, which might prevent ' +
                                'you training a model with this image' });
                        }
                    }

                    scrollToNewItem(newitem.id);
                })
                .catch(function (err) {
                    if (errorSuggestsProjectDeleted(err)) {
                        return $state.go('projects');
                    }

                    displayAlert('errors', err.status, err.data);

                    var idxToRemove = findTrainingIndex(label, placeholder.id);
                    if (idxToRemove !== -1) {
                        $scope.training[label].splice(idxToRemove, 1);
                    }
                });
        };


        function errorSuggestsProjectDeleted(err) {
            return err &&
                   err.status === 404 &&
                   err.data &&
                   err.data.error === 'Not found';
        }


        vm.onImageLoad = function (image) {
            loggerService.debug('[ml4ktraining] onImageLoad');
            loggerService.debug(image);
        };

        vm.onImageError = function (image) {
            image.loadingFailed = true;
            // displayAlert('errors', 400, {
            //     error : 'Image (' + image.imageurl + ') in the ' + image.label + ' bucket could not be loaded, and has been highlighted in red. You should delete it.'
            // });
        };


        vm.addLabel = function (ev) {
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
                templateUrl : 'static/components/training/newlabel.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (newlabel) {
                    loggerService.debug('[ml4ktraining] adding a new label', newlabel);
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
                            if (errorSuggestsProjectDeleted(err)) {
                                return $state.go('projects');
                            }

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
            trainingService.deleteTrainingData($scope.projectId, $scope.userId, vm.profile.tenant, item.id)
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);
                });
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
                        loggerService.error('[ml4ktraining] displaying webcam error', err);

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
                        loggerService.error('[ml4ktraining] webcam error', err);

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
                        loggerService.debug('[ml4ktraining] getting webcam data');

                        var hiddenCanvas = document.createElement('canvas');
                        hiddenCanvas.width = $scope.channel.video.width;
                        hiddenCanvas.height = $scope.channel.video.height;

                        loggerService.debug('[ml4ktraining] writing to hidden canvas');
                        var ctx = hiddenCanvas.getContext('2d');
                        ctx.drawImage($scope.channel.video,
                            0, 0,
                            $scope.channel.video.width, $scope.channel.video.height);

                        return $q(function(resolve, reject) {
                            loggerService.debug('[ml4ktraining] extracting blob data');
                            hiddenCanvas.toBlob(function (blob) {
                                resolve(blob);
                            }, 'image/jpeg');
                        });
                    };

                },
                templateUrl : 'static/components/training/webcam.tmpl.html',
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

                    loggerService.debug('[ml4ktraining] uploading webcam data');
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
                templateUrl : 'static/components/training/canvas.tmpl.html',
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



        vm.useMicrophone = function (ev, label) {
            $mdDialog.show({
                locals : {
                    label : label,
                    project : $scope.project,
                    soundModelInfo : soundTrainingService.getModelInfo(),
                },
                controller : function ($scope, locals) {
                    $scope.label = locals.label;
                    $scope.project = locals.project;
                    $scope.soundModelInfo = locals.soundModelInfo;
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

                    $scope.recordSound = function(label) {
                        delete $scope.example;
                        $scope.recording = true;

                        $scope.recordingprogress = 0;
                        var progressInterval = setInterval(function () {
                            $scope.$apply(
                                function() {
                                    $scope.recordingprogress += 10;
                                });
                        }, 1000 / 10);

                        soundTrainingService.collectExample(label)
                            .then(function (spectogram) {
                                clearInterval(progressInterval);
                                $scope.$apply(
                                    function() {
                                        $scope.recordingprogress = 100;
                                        if (spectogram && spectogram.data && spectogram.data.length > 0) {
                                            $scope.example = spectogram.data;
                                        }
                                        $scope.recording = false;
                                    });
                            })
                            .catch(function () {
                                clearInterval(progressInterval);
                                $scope.recording = false;
                            });
                    };
                },
                templateUrl : 'static/components/training/trainingdata.tmpl.html',
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


        function scrollToNewItem(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                var itemContainer = newItem.parentElement;
                angular.element(itemContainer).duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }

        $scope.$on("$destroy", function () {
            loggerService.debug('[ml4ktraining] handling page change');

            if ($scope.project && $scope.project.type === 'sounds'){
                soundTrainingService.reset();
            }
        });


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
