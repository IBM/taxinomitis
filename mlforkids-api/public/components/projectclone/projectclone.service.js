(function () {

    angular
        .module('app')
        .service('projectCloneService', projectCloneService);

    projectCloneService.$inject = [
        'projectsService', 
        'browserStorageService', 'storageService',
        'loggerService',
        '$http', '$q'
    ];

    // cloning a project reproduces its name, type and training examples in
    //  browser storage. the cloud project it was copied from is left
    //  completely untouched 
    function projectCloneService(
        projectsService, 
        browserStorageService, storageService, 
        loggerService,
        $http, $q
    ) {

        // browserStorageService.isSupported() resolves to its own numeric
        //  constants rather than a boolean. SUPPORTED_NO is -1, which is
        //  truthy, so this has to be an equality check
        var SUPPORTED_OK = 1;

        // the training API pages its response, and defaults to only 50 items
        //  if we don't ask for more. 3000 is the largest number the training
        //  limits allow for any project type (crowd-sourced numbers projects)
        var MAX_TRAINING_ITEMS = 3000;

        // image and sound examples have to be fetched one at a time - there is
        //  no bulk endpoint. doing that sequentially is minutes of mostly-idle
        //  waiting on a 250-image project, but an unbounded $q.all would fire
        //  250 simultaneous resize requests at our own API
        var MAX_CONCURRENT_DOWNLOADS = 4;

        // browser storage adds this to every sounds project itself
        var BACKGROUND_NOISE = '_background_noise_';

        // localStorage key that dataset test data is held under, keyed by
        //  project id - shared with datasets, models and cleanup
        var TESTDATA_PREFIX = 'testdata://';


        function trainingUrl(project, profile) {
            return '/api/classes/' + profile.tenant +
                   '/students/' + profile.user_id +
                   '/projects/' + project.id +
                   '/training';
        }


        // the Content-Range response header looks like 'items 0-1/2' - the
        //  number after the slash is how many training items the project
        //  actually has. if we were given fewer than that, we've hit the
        //  paging ceiling and would otherwise silently clone an incomplete
        //  project
        function verifyCompleteResponse(resp) {
            var trainingdata = resp.data;

            var contentrange = resp.headers('Content-Range');
            if (contentrange) {
                var total = parseInt(contentrange.substring(contentrange.indexOf('/') + 1), 10);
                if (!isNaN(total) && trainingdata.length < total) {
                    loggerService.error('[ml4kclone] truncated training response',
                                        trainingdata.length, 'of', total);
                    throw new Error('Only ' + trainingdata.length + ' of ' + total +
                                    ' training examples could be read');
                }
            }

            return trainingdata;
        }


        // numbers projects keep their field definitions in a separate table in
        //  the cloud, but inline on the project record in browser storage.
        //  the API 404s rather than returning an empty list when a project has
        //  no fields
        function getCloudFields(project, profile) {
            if (project.type !== 'numbers') {
                return $q.resolve(undefined);
            }

            return $http.get('/api/classes/' + profile.tenant +
                             '/students/' + profile.user_id +
                             '/projects/' + project.id +
                             '/fields')
                .then(function (resp) {
                    return resp.data;
                })
                .catch(function (err) {
                    if (err.status === 404) {
                        return [];
                    }
                    throw err;
                });
        }


        function getCloudTrainingData(project, profile) {
            return $http.get(trainingUrl(project, profile), {
                    headers : { Range : 'items=0-' + MAX_TRAINING_ITEMS }
                })
                .then(verifyCompleteResponse);
        }


        // build the local project record. deliberately constructs a new object
        //  rather than modifying the project we were given - the clone source
        //  is left exactly as it was
        // browserStorageService.addProject pushes _background_noise_ into the
        //  labels of every sounds project it creates, with no duplicate check,
        //  so it has to be stripped here or the clone ends up with two
        function cloneLabels(project) {
            var labels = project.labels ? project.labels.slice() : [];

            if (project.type === 'sounds') {
                labels = labels.filter(function (label) {
                    return label !== BACKGROUND_NOISE;
                });
            }

            return labels;
        }


        // runs downloadFn over every training item, at most
        //  MAX_CONCURRENT_DOWNLOADS at a time, reporting progress as each one
        //  lands. an item that cannot be downloaded is skipped and counted
        //  rather than failing the whole clone - a cloud project can quite
        //  legitimately hold rows pointing at third-party URLs that no longer
        //  resolve, and one dead link must not make a project un-clonable
        function downloadInPool(trainingdata, downloadFn, onProgress) {
            var records = new Array(trainingdata.length);
            var skipped = 0;
            var started = 0;
            var completed = 0;

            function startNext() {
                if (started >= trainingdata.length) {
                    return $q.resolve();
                }

                var index = started++;

                return downloadFn(trainingdata[index])
                    .then(function (record) {
                        // written by index, not pushed, so that concurrent
                        //  downloads can't reorder the training data
                        records[index] = record;
                    })
                    .catch(function (err) {
                        loggerService.error('[ml4kclone] skipping training item',
                                            trainingdata[index].id, err);
                        skipped += 1;
                    })
                    .then(function () {
                        completed += 1;
                        if (onProgress) {
                            onProgress(completed, trainingdata.length);
                        }
                        return startNext();
                    });
            }

            var workers = [];
            var numworkers = Math.min(MAX_CONCURRENT_DOWNLOADS, trainingdata.length);
            for (var i = 0; i < numworkers; i++) {
                workers.push(startNext());
            }

            return $q.all(workers)
                .then(function () {
                    return {
                        records : records.filter(function (record) {
                            return record !== undefined;
                        }),
                        skipped : skipped
                    };
                });
        }


        function createCloneProject(project, profile, fields) {
            var cloneattrs = {
                name : project.name,
                type : project.type,
                labels : cloneLabels(project),
                storage : 'local',

                // carried for every type, not just text, because that is what
                //  the new-project form puts on a locally-created project -
                //  the cloud sends '' for the types that don't use it
                language : project.language,

                // always false, never inherited: a crowd-sourced project can
                //  be cloned by any student in the class, but the clone is
                //  theirs alone. browser storage is single-user, so a clone
                //  cannot meaningfully be shared
                isCrowdSourced : false
            };

            if (fields) {
                // field order is the contract - multichoice training values
                //  are indices into the choices array - so this must preserve
                //  the order the API returned
                cloneattrs.fields = fields;
            }

            // deliberately goes through projectsService rather than calling
            //  browserStorageService.addProject directly: createProject is
            //  what stamps the owning userid and classid onto a local project,
            //  and browserStorageService.getProjects filters on userid, so a
            //  clone created without one is written to IndexedDB and then
            //  never appears in the user's project list
            return projectsService.createProject(cloneattrs, profile.user_id, profile.tenant);
        }


        // cloud training rows carry ids that mean nothing in browser storage -
        //  local training ids are per-database auto-increment integers - so
        //  every mapper drops the id and lets IndexedDB assign a new one
        // resolves to { records, skipped }. text and numbers examples arrive
        //  complete in the training response, so nothing can be skipped; the
        //  binary types need a download each
        function buildTrainingRecords(project, profile, trainingdata, onProgress) {
            if (project.type === 'text') {
                return $q.resolve({
                    skipped : 0,
                    records : trainingdata.map(function (trainingitem) {
                        return {
                            label : trainingitem.label,
                            textdata : trainingitem.textdata
                        };
                    })
                });
            }
            else if (project.type === 'numbers') {
                // numberdata is a comma-joined string in the database, but the
                //  API returns it as a real array - which is also what browser
                //  storage wants, so it copies across as-is
                return $q.resolve({
                    skipped : 0,
                    records : trainingdata.map(function (trainingitem) {
                        return {
                            label : trainingitem.label,
                            numberdata : trainingitem.numberdata
                        };
                    })
                });
            }
            else if (project.type === 'sounds') {
                // spectrograms live in object storage in the cloud, and inline
                //  on the training record in the browser
                return downloadInPool(trainingdata, function (trainingitem) {
                    return $http.get(trainingitem.audiourl)
                        .then(function (resp) {
                            return {
                                label : trainingitem.label,
                                audiodata : resp.data
                            };
                        });
                }, onProgress);
            }

            else if (project.type === 'imgtfjs') {
                return downloadInPool(trainingdata, function (trainingitem) {
                    return downloadTrainingImage(project, profile, trainingitem);
                }, onProgress);
            }

            return $q.reject(new Error('Projects of this type cannot be cloned'));
        }


        // the API sends resized image bytes as application/octet-stream, and
        //  sharp preserves whatever format the original was in, so the only
        //  way to type the blob correctly is to look at the bytes. a blob with
        //  the wrong type will not render when displayed via createObjectURL
        function sniffImageType(arraybuffer) {
            var bytes = new Uint8Array(arraybuffer);

            if (bytes.length >= 8 &&
                bytes[0] === 0x89 && bytes[1] === 0x50 &&
                bytes[2] === 0x4E && bytes[3] === 0x47)
            {
                return 'image/png';
            }

            // JPEG - starts with the SOI marker
            return 'image/jpeg';
        }


        // GET .../training/:trainingid is used for every image, whatever the
        //  cloud did with the bytes: it serves object-store images and
        //  third-party URLs alike, in one request, already resized
        function downloadTrainingImage(project, profile, trainingitem) {
            var url = '/api/classes/' + profile.tenant +
                      '/students/' + profile.user_id +
                      '/projects/' + project.id +
                      '/training/' + trainingitem.id;

            return $http.get(url, { responseType : 'arraybuffer' })
                .then(function (resp) {
                    var record = {
                        label : trainingitem.label,
                        imagedata : new Blob([ resp.data ], { type : sniffImageType(resp.data) }),
                        isstored : trainingitem.isstored
                    };

                    // a third-party URL is worth keeping as provenance, and is
                    //  what the equivalent locally-created record looks like.
                    //  a stored image's URL is an API path into the project
                    //  being cloned, so it is deliberately dropped
                    if (!trainingitem.isstored && trainingitem.imageurl) {
                        record.imageurl = trainingitem.imageurl;
                    }

                    return record;
                });
        }


        // a project imported from a bundled dataset with a test split keeps
        //  the held-back rows as CSV in localStorage, under the project id.
        //  they are not training data and live in neither database, so they
        //  have to be carried across explicitly - and they are destroyed when
        //  the source project is deleted (cleanup.service.js), which is
        //  exactly what a user is invited to do after cloning
        //
        // returns whether the test data was carried across. this is never
        //  allowed to fail the clone: localStorage can be full, or a no-op
        //  in-memory shim in Safari private mode, and losing the test data is
        //  not a reason to lose the project
        function cloneTestData(sourceproject, cloneproject) {
            try {
                var testdata = storageService.getItem(TESTDATA_PREFIX + sourceproject.id);
                if (!testdata) {
                    return false;
                }

                storageService.setItem(TESTDATA_PREFIX + cloneproject.id, testdata);

                loggerService.debug('[ml4kclone] copied test data to', cloneproject.id);
                return true;
            }
            catch (err) {
                loggerService.error('[ml4kclone] failed to copy test data', err);
                return false;
            }
        }


        // onProgress, if given, is called as (completed, total) each time an
        //  image or sound example finishes downloading
        function cloneProject(project, profile, onProgress) {
            loggerService.debug('[ml4kclone] cloning project', project.id);

            return browserStorageService.isSupported()
                .then(function (supported) {
                    if (supported !== SUPPORTED_OK) {
                        throw new Error('Your web browser cannot store projects');
                    }

                    // fields is requested first so that a project whose schema
                    //  cannot be read never gets a half-described clone
                    return $q.all({
                        fields : getCloudFields(project, profile),
                        training : getCloudTrainingData(project, profile)
                    });
                })
                .then(function (clouddata) {
                    // every example is fetched before the clone is created, so
                    //  that a failed read leaves nothing behind rather than a
                    //  stranded empty project
                    return buildTrainingRecords(project, profile, clouddata.training, onProgress)
                        .then(function (built) {
                            return createCloneProject(project, profile, clouddata.fields)
                                .then(function (cloneproject) {
                                    return browserStorageService
                                        .bulkAddTrainingData(cloneproject.id, built.records)
                                        .then(function () {
                                            return {
                                                project : cloneproject,
                                                copied : built.records.length,
                                                skipped : built.skipped,
                                                testdata : cloneTestData(project, cloneproject)
                                            };
                                        });
                                });
                        });
                });
        }


        return {
            cloneProject : cloneProject
        };
    }
}());
