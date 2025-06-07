(function () {

    angular
        .module('app')
        .controller('TrainingController', TrainingController);

    TrainingController.$inject = [
        'authService',
        'projectsService', 'trainingService', 'modelService',
        'soundTrainingService',
        'utilService', 'csvService', 'downloadService', 'imageToolsService', 'webcamsService',
        'loggerService',
        '$stateParams',
        '$scope',
        '$mdDialog',
        '$state',
        '$timeout',
        '$q'
    ];

    function TrainingController(authService, projectsService, trainingService, modelService, soundTrainingService, utilService, csvService, downloadService, imageToolsService, webcamsService, loggerService, $stateParams, $scope, $mdDialog, $state, $timeout, $q) {

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

        var webcams;
        var currentWebcamIdx = 0;


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
                    return projectsService.getFields($scope.project, $scope.userId, vm.profile.tenant)
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
                        .then(function (outcome) {
                            $scope.soundModelInfo = soundTrainingService.getModelInfo();
                            if (outcome && outcome.warning) {
                                displayAlert('warnings', 500, outcome.warning);
                            }
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
                if ($scope.project.type === 'regression') {
                    $scope.training = training;
                    $scope.regressionmode = 'init';

                    $scope.$watch('project.columns', function (columns, previous) {
                        refreshLabelsSummary();

                        if (columns && !angular.equals(columns, previous)) {
                            projectsService.addMetadataToProject($scope.project, 'columns', columns)
                                .catch (function (err) {
                                    displayAlert('errors', 500, err);
                                });
                            modelService.deleteModel($scope.project.type, $scope.project.id)
                                .catch (function (err) {
                                    loggerService.error('[ml4ktraining] failed to delete model', err);
                                });
                        }
                    }, true);
                }
                else {
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

                summary = modelService.generateProjectSummary(labels, ' or ') || '';
            }
            else if ($scope.project.type === 'regression') {
                var projectColumns = $scope.project.columns || [];
                var columns = projectColumns
                    .filter(col => col.output)
                    .map(col => col.label);
                summary = modelService.generateProjectSummary(columns, ' and ') || 'something';
                var numInputs = projectColumns.length - columns.length;
                if (numInputs) {
                    $scope.columnsSummary = ' from ' + numInputs + ' input values';
                }
            }
            $scope.project.labelsSummary = summary;
        }


        function getNumberValues(obj) {
            var fields = $scope.projectfieldnames ? $scope.projectfieldnames : Object.keys(obj);
            return fields.map(function (key) {
                if (obj[key].includes('.')) {
                    return parseFloat(obj[key]);
                }
                else {
                    return parseInt(obj[key]);
                }
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
                    id : 'placeholder_' + (placeholderId++),
                    label : label,
                    projectid : $scope.projectId,
                    textdata : data,
                    isPlaceholder : true
                };
            }
            else if ($scope.project.type === 'numbers') {
                data = getNumberValues(resp);

                placeholder = {
                    id : 'placeholder_' + (placeholderId++),
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
                    id : 'placeholder_' + (placeholderId++),
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
                    id : 'placeholder_' + (placeholderId++),
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
            storeTrainingDataFn($scope.projectId, $scope.userId, vm.profile.tenant, $scope.project.type, $scope.project.storage, data, label)
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



        function attemptRefresh() {
            try {
                $scope.$apply();
            }
            catch (refreshErr) {
                loggerService.debug('[ml4ktraining] unable to refresh', refreshErr);
            }
        }


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
                    projectsService.addLabelToProject($scope.project, $scope.userId, vm.profile.tenant, newlabel)
                        .then(function (labels) {
                            $scope.project.labels = labels;
                            for (var i = 0; i < labels.length; i++) {
                                if (!$scope.training[labels[i]]){
                                    $scope.training[labels[i]] = [];
                                }
                            }

                            refreshLabelsSummary();

                            if ($scope.project.storage === 'local') {
                                attemptRefresh();
                            }
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

                    projectsService.removeLabelFromProject($scope.project, $scope.userId, vm.profile.tenant, label)
                        .catch(function (err) {
                            displayAlert('errors', err.status, err.data);
                        });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };





        vm.addImageFile = function (file, label, scrollto) {
            imageToolsService.getDataFromFile(file)
                .then(function (data) {
                    vm.addImageData(data, label, scrollto);
                });
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
                    $scope.multipleWebcams = false;

                    webcamsService.getDevices()
                        .then((devices) => {
                            webcams = devices;
                            $scope.channel.videoOptions = webcams[currentWebcamIdx];
                            $scope.multipleWebcams = webcams.length > 1;
                            loggerService.debug('[ml4ktraining] webcam config', $scope.channel.videoOptions);
                        });

                    $scope.webcamCanvas = null;

                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                    $scope.confirm = function() {
                        imageToolsService.getDataFromImageSource($scope.channel.video, 'image/jpeg')
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

                    function changeWebcamDevice () {
                        loggerService.debug('[ml4ktraining] changing webcam device');
                        $scope.$applyAsync(() => {
                            $scope.webcamInitComplete = false;
                            $scope.channel.videoOptions = webcams[currentWebcamIdx];
                            $scope.$broadcast('STOP_WEBCAM');
                            $scope.$broadcast('START_WEBCAM');
                            loggerService.debug('[ml4ktraining] new webcam', webcams[currentWebcamIdx]);
                        });
                    }

                    $scope.switchWebcam = function () {
                        loggerService.debug('[ml4ktraining] switching webcam');
                        if (webcams.length > 0) {
                            currentWebcamIdx += 1;
                            if (currentWebcamIdx >= webcams.length) {
                                currentWebcamIdx = 0;
                            }
                            changeWebcamDevice();
                        }
                    };

                    $scope.onWebcamError = function(err) {
                        loggerService.error('[ml4ktraining] webcam error', err);

                        // failed to use the webcam - we won't try this one again
                        webcams.splice(currentWebcamIdx, 1);
                        $scope.multipleWebcams = webcams.length > 1;
                        currentWebcamIdx = 0;

                        if (webcams.length > 0) {
                            // there are other webcams we haven't tried yet
                            return changeWebcamDevice();
                        }

                        // there are no other webcams left to try
                        //   so we'll display the error
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
                },
                templateUrl : 'static/components/training/webcam.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    vm.addImageData(resp, label, true);
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
                        imageToolsService.getDataFromImageSource($scope.canvas, 'image/jpeg')
                            .then(function (imagedata) {
                                $mdDialog.hide(imagedata);
                            });
                    };
                },
                templateUrl : 'static/components/training/canvas.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (resp) {
                    vm.addImageData(resp, label, true);
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };


        vm.addImageData = function (imagedata, label, scrollto) {
            var placeholder = {
                id : 'placeholder_' + (placeholderId++),
                label : label,
                projectid: $scope.projectId,
                imageurl : URL.createObjectURL(imagedata),
                isPlaceholder : true
            };

            $scope.training[label].push(placeholder);

            loggerService.debug('[ml4ktraining] adding image data');
            trainingService.uploadImage($scope.project, $scope.userId, vm.profile.tenant, imagedata, label)
                .then(function (newitem) {
                    placeholder.isPlaceholder = false;
                    placeholder.id = newitem.id;

                    if (scrollto) {
                       scrollToNewItem(newitem.id);
                    }

                    $timeout(function () {
                        URL.revokeObjectURL(placeholder.imageurl);
                    }, 10000);
                })
                .catch(function (err) {
                    displayAlert('errors', err.status, err.data);

                    var idxToRemove = findTrainingIndex(label, placeholder.id);
                    if (idxToRemove !== -1) {
                        $scope.training[label].splice(idxToRemove, 1);
                    }
                });
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
                            .catch(function (err) {
                                clearInterval(progressInterval);
                                $scope.$apply(
                                    function() {
                                        $scope.recording = false;
                                        displayAlert('errors', 500, err);
                                    });
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


        $scope.downloadTrainingData = function (ev, label) {
            loggerService.debug('[ml4ktraining] downloading training data to file');
            if ($scope.project.type === 'text') {
                downloadService.downloadFile(
                    $scope.training[label].map(i => i.textdata + '\n'),
                    'text/plain', label + '.txt');
            }
            else if ($scope.project.type === 'numbers') {
                const exported = $scope.training[label].map((values) => {
                    const item = {};
                    $scope.project.fields.forEach((field, idx) => {
                        if (field.type === 'multichoice') {
                            item[field.name] = field.choices[values.numberdata[idx]];
                        }
                        else {
                            item[field.name] = values.numberdata[idx];
                        }
                    });
                    return item;
                });
                csvService.exportFile(exported, $scope.projectfieldnames)
                    .then(function (csvstring) {
                        downloadService.downloadFile([ csvstring ], 'text/csv', label + '.csv');
                    })
                    .catch(function (err) {
                        displayAlert('errors', 500, err);
                    });
            }
            else if ($scope.project.type === 'regression') {
                csvService.exportFile($scope.training, $scope.project.columns.map(c => c.label))
                    .then(function (csvstring) {
                        downloadService.downloadFile([ csvstring ], 'text/csv', 'training-' + $scope.project.id + '.csv');
                    })
                    .catch(function (err) {
                        displayAlert('errors', 500, err);
                    });
            }
        };

        $scope.uploadTrainingData = function (ev, elem) {
            loggerService.debug('[ml4ktraining] uploading training data from file');
            var files = ev.currentTarget.files;
            if (files && files.length > 0) {
                var file = ev.currentTarget.files[0];
                if ($scope.project.type === 'regression') {
                    csvService.parseFile(file)
                        .then(function (results) {
                            if ($scope.project.columns && $scope.project.columns.length > 0) {

                                // pre-existing columns - check they match
                                if (!angular.equals(results.meta.fields, $scope.project.columns.map(c => c.label)))
                                {
                                    throw new Error('The columns in the CSV file do not match the columns you have in this project');
                                }
                            }
                            else {

                                // no pre-existing columns - use columns from CSV
                                $scope.project.columns = results.meta.fields.map(function (columnName) {
                                    const column = {
                                        label: columnName,
                                        output: false
                                    };

                                    if (results.data.length > 0) {
                                        column.type = typeof results.data[0][columnName];
                                    }
                                    else {
                                        // TODO other types?
                                        column.type = 'unknown';
                                    }

                                    return column;
                                });
                            }

                            $scope.$applyAsync(() => { $scope.loadingtraining = true; });
                            return trainingService.bulkAddTrainingData($scope.project, results.data);
                        })
                        .then(function (stored) {
                            $scope.training = $scope.training.concat(stored);
                            $scope.$applyAsync(() => { $scope.loadingtraining = false; });
                        })
                        .catch(function (err) {
                            $scope.$applyAsync(() => { $scope.loadingtraining = false; });
                            displayAlert('errors', 400, err);
                        });
                }
                else if ($scope.project.type === 'numbers') {
                    const label = elem.dataset.label;
                    csvService.parseFile(file)
                        .then(function (results) {
                            // pre-existing fields - check they match
                            if (!angular.equals(results.meta.fields, $scope.project.fields.map(c => c.name)))
                            {
                                throw new Error('The columns in the CSV file do not match the fields you have in this project');
                            }
                            return trainingService.bulkAddTrainingData($scope.project, { label, numbers : results.data });
                        })
                        .then(function (stored) {
                            $scope.training[label] = $scope.training[label].concat(stored);
                        })
                        .catch(function (err) {
                            displayAlert('errors', 400, err);
                        });
                }
                else if ($scope.project.type === 'text') {
                    const label = elem.dataset.label;

                    const txtfilereader = new FileReader();
                    txtfilereader.readAsText(file);
                    txtfilereader.onload = function () {
                        trainingService.bulkAddTrainingData($scope.project,
                                    txtfilereader.result
                                        .split(/[\r\n]+/)
                                        .map(line => line.substring(0, 1024).trim())
                                        .filter(line => line.length > 0)
                                        .reduce((acc, cur) => acc.includes(cur) ? acc : [...acc, cur], [])
                                        .map(function (line) {
                                            return { label, textdata : line };
                                        }))
                            .then(function (newitems) {
                                $scope.training[label] = $scope.training[label].concat(newitems);
                                attemptRefresh();
                            })
                            .catch(function (err) {
                                displayAlert('errors', 500, err);
                            });
                    };
                    txtfilereader.onerror = function () {
                        displayAlert('errors', 500, txtfilereader.error);
                    };
                }
                else if ($scope.project.type === 'imgtfjs') {
                    const label = elem.dataset.label;
                    for (var i = 0; i < ev.currentTarget.files.length; i++) {
                        var lastfile = i === (ev.currentTarget.files.length - 1);
                        vm.addImageFile(ev.currentTarget.files[i], label, lastfile);
                    }
                }
            }
        };

        vm.addRegressionColumn = function (ev) {
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
                templateUrl : 'static/components/training/newcolumn.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (newlabel) {
                    loggerService.debug('[ml4ktraining] adding a new column', newlabel);
                    if (!$scope.project.columns) {
                        $scope.project.columns = [];
                    }
                    $scope.project.columns.push({
                        label: newlabel,
                        output: false,
                        type : 'number'
                    });
                },
                function() {
                    // cancelled. do nothing
                }
            );
        };

        vm.deleteAllRegression = function (ev) {
            // TODO ask for confirmation?
            $scope.training = [];
            trainingService.clearTrainingData($scope.project);
        };

        vm.deleteRegressionItem = function (item) {
            var idx = $scope.training.indexOf(item);
            if (idx > -1) {
                $scope.training.splice(idx, 1);
                trainingService.deleteTrainingData($scope.projectId, $scope.userId, vm.profile.tenant, item.id)
                    .catch(function (err) {
                        displayAlert('errors', err.status, err.data);
                    });
            }
        };

        vm.setRegressionMode = function (mode) {
            $scope.regressionmode = mode;
        };

        function scrollToNewItem(itemId, retried) {
            $scope.$applyAsync(function () {
                var newItem = document.getElementById(itemId.toString());
                if (newItem) {
                    var itemContainer = newItem.parentElement;
                    angular.element(itemContainer).duScrollToElementAnimated(angular.element(newItem));
                }
                else if (!retried) {
                    $timeout(function () {
                        scrollToNewItem(itemId, true);
                    }, 0);
                }
                else {
                    loggerService.error('[ml4ktraining] unable to scroll to new item', itemId);
                }
            });
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
