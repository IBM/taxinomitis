(function () {

    angular
        .module('app')
        .service('projectCloneService', projectCloneService);

    projectCloneService.$inject = [
        'projectsService',
        'browserStorageService', 'storageService',
        'loggerService', 'utilService',
        '$http', '$q'
    ];

    // cloning a project reproduces its name, type and training examples in
    //  browser storage. the cloud project it was copied from is left
    //  completely untouched
    //
    // this service also produces and reads *project archives* - zip files
    //  holding one project, which is how a project leaves the application
    //  altogether. cloning and archiving share their reading of a project,
    //  which is why they live together, but they are different things: a
    //  clone is a new project, an archive is a file
    function projectCloneService(
        projectsService,
        browserStorageService, storageService,
        loggerService, utilService,
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


        // ==============================================================
        //  PROJECT ARCHIVES
        // ==============================================================

        // bumped only when a change would stop an older reader understanding
        //  an archive. an importer refuses a version it doesn't know rather
        //  than importing a project it has half-understood
        var ARCHIVE_FORMAT_VERSION = 1;

        var MANIFEST_FILE = 'manifest.json';
        var PROJECT_FILE = 'project.json';
        var TRAINING_FILE = 'training.json';
        var TESTDATA_FILE = 'testdata.csv';
        var IMAGES_DIR = 'images/';
        var SOUNDS_DIR = 'sounds/';

        // an archive is anonymous - it can be shared publicly, so it must not
        //  name the child who made the project or the class they are in. the
        //  values are replaced rather than removed so that the files keep the
        //  shape of the API responses they are modelled on
        var REDACTED_PROJECTID = 'projectid';
        var REDACTED_USERID = 'userid';
        var REDACTED_CLASSID = 'classid';

        var ARCHIVE_TYPES = ['text', 'numbers', 'sounds', 'imgtfjs'];

        // project names are not validated in browser storage, so they can hold
        //  anything a child typed - including characters that are not legal in
        //  a filename on every platform they might save it to
        var UNSAFE_FILENAME_CHARS = /[^\w \-]/g;
        var MAX_FILENAME_LENGTH = 40;


        function isLocalProject(project) {
            return project.storage === 'local';
        }


        // ---- reading a project, whichever storage it is in ----

        function readProjectRecord(project, profile) {
            if (isLocalProject(project)) {
                // read back rather than trusting what the projects page had:
                //  numbers fields and regression columns are added to the
                //  record after creation, so a stale copy can be incomplete
                return browserStorageService.getProject(project.id);
            }
            return getCloudFields(project, profile)
                .then(function (fields) {
                    var full = angular.extend({}, project);
                    if (fields) {
                        full.fields = fields;
                    }
                    return full;
                });
        }


        function readTrainingRecords(project, profile) {
            if (isLocalProject(project)) {
                return browserStorageService.getTrainingData(project.id);
            }
            return getCloudTrainingData(project, profile);
        }


        // ---- project.json ----

        // modelled on the body of GET .../projects/:projectid, with every
        //  identifier replaced. a local project record carries a different set
        //  of fields, so the missing ones are defaulted to what the cloud API
        //  would have sent for the same project
        function buildArchiveProject(project) {
            var fields = project.fields ? project.fields : [];

            return {
                id : REDACTED_PROJECTID,
                userid : REDACTED_USERID,
                classid : REDACTED_CLASSID,

                type : project.type,
                name : project.name,
                labels : project.labels ? project.labels : [],

                // '' for every type but text, which is what the cloud sends
                language : (project.type === 'text' && project.language) ? project.language : '',

                numfields : fields.length,
                fields : fields,

                // never inherited. an archive can be imported by anyone, and
                //  what it produces is a local project, which is single-user
                isCrowdSourced : false
            };
        }


        // ---- training.json, and the files it indexes ----

        function imageFileExtension(mimetype) {
            return mimetype === 'image/png' ? '.png' : '.jpg';
        }


        // an archive item pairs the row that goes into training.json with the
        //  file (if any) that row points at
        function archiveItem(row, path, data) {
            var item = { row : row };
            if (path) {
                item.file = { path : path, data : data };
            }
            return item;
        }


        function buildTextArchiveItems(trainingdata) {
            return $q.resolve({
                skipped : 0,
                records : trainingdata.map(function (trainingitem) {
                    return archiveItem({
                        id : trainingitem.id,
                        label : trainingitem.label,
                        textdata : trainingitem.textdata
                    });
                })
            });
        }


        function buildNumbersArchiveItems(trainingdata) {
            return $q.resolve({
                skipped : 0,
                records : trainingdata.map(function (trainingitem) {
                    return archiveItem({
                        id : trainingitem.id,
                        label : trainingitem.label,
                        numberdata : trainingitem.numberdata
                    });
                })
            });
        }


        // the image url in an archive means one of two things, exactly as it
        //  does in the training API: a link to somewhere else on the internet
        //  when isstored is false, and a pointer to where the bytes are kept
        //  when it is true. the only difference is that the bytes are in the
        //  zip rather than in object storage
        function buildImageArchiveRow(trainingitem, mimetype) {
            var filename = IMAGES_DIR + trainingitem.id + imageFileExtension(mimetype);

            return {
                id : trainingitem.id,
                label : trainingitem.label,
                imageurl : filename,
                isstored : true,
                // the training API puts a userid on every stored image row,
                //  recovered from the image url. it is redacted rather than
                //  dropped so the row keeps the shape of that response
                userid : REDACTED_USERID
            };
        }


        function buildLinkedImageRow(trainingitem) {
            return {
                id : trainingitem.id,
                label : trainingitem.label,
                imageurl : trainingitem.imageurl,
                isstored : false
            };
        }


        function buildImageArchiveItems(project, profile, trainingdata, onProgress) {
            if (isLocalProject(project)) {
                return $q.resolve({
                    skipped : 0,
                    records : trainingdata.map(function (trainingitem) {
                        if (!trainingitem.isstored) {
                            // a locally-held copy of an image the project only
                            //  ever had a link to is deliberately dropped -
                            //  the cloud does not keep those bytes either, and
                            //  an archive must not record which storage it
                            //  came from
                            return archiveItem(buildLinkedImageRow(trainingitem));
                        }

                        var mimetype = (trainingitem.imagedata && trainingitem.imagedata.type) ?
                                            trainingitem.imagedata.type :
                                            'image/jpeg';

                        return archiveItem(buildImageArchiveRow(trainingitem, mimetype),
                                           IMAGES_DIR + trainingitem.id + imageFileExtension(mimetype),
                                           trainingitem.imagedata);
                    })
                });
            }

            return downloadInPool(trainingdata, function (trainingitem) {
                if (!trainingitem.isstored) {
                    // nothing to download - the row is the whole record
                    return $q.resolve(archiveItem(buildLinkedImageRow(trainingitem)));
                }

                return $http.get('/api/classes/' + profile.tenant +
                                 '/students/' + profile.user_id +
                                 '/projects/' + project.id +
                                 '/training/' + trainingitem.id,
                                 { responseType : 'arraybuffer' })
                    .then(function (resp) {
                        var mimetype = sniffImageType(resp.data);
                        return archiveItem(buildImageArchiveRow(trainingitem, mimetype),
                                           IMAGES_DIR + trainingitem.id + imageFileExtension(mimetype),
                                           resp.data);
                    });
            }, onProgress);
        }


        function buildSoundArchiveItems(project, profile, trainingdata, onProgress) {
            function soundItem(trainingitem, spectrogram) {
                var filename = SOUNDS_DIR + trainingitem.id + '.json';

                return archiveItem({
                    id : trainingitem.id,
                    label : trainingitem.label,
                    audiourl : filename
                }, filename, JSON.stringify(spectrogram));
            }

            if (isLocalProject(project)) {
                return $q.resolve({
                    skipped : 0,
                    records : trainingdata.map(function (trainingitem) {
                        return soundItem(trainingitem, trainingitem.audiodata);
                    })
                });
            }

            return downloadInPool(trainingdata, function (trainingitem) {
                return $http.get(trainingitem.audiourl)
                    .then(function (resp) {
                        return soundItem(trainingitem, resp.data);
                    });
            }, onProgress);
        }


        function buildArchiveItems(project, profile, trainingdata, onProgress) {
            if (project.type === 'text') {
                return buildTextArchiveItems(trainingdata);
            }
            if (project.type === 'numbers') {
                return buildNumbersArchiveItems(trainingdata);
            }
            if (project.type === 'imgtfjs') {
                return buildImageArchiveItems(project, profile, trainingdata, onProgress);
            }
            if (project.type === 'sounds') {
                return buildSoundArchiveItems(project, profile, trainingdata, onProgress);
            }
            return $q.reject(new Error('Projects of this type cannot be exported'));
        }


        // ---- the file the child ends up with ----

        function archiveFilename(project) {
            var safe = (project.name ? project.name : '')
                            .replace(UNSAFE_FILENAME_CHARS, '')
                            .trim()
                            .substring(0, MAX_FILENAME_LENGTH)
                            .trim();

            return (safe ? safe : 'project') + '.zip';
        }


        // JSZip works in native promises. wrapping them in $q is what keeps
        //  callers - and their progress bars - inside angular's digest
        function asAngularPromise(nativepromise) {
            return $q(function (resolve, reject) {
                nativepromise.then(resolve, reject);
            });
        }


        function exportProject(project, profile, onProgress) {
            loggerService.debug('[ml4karchive] exporting project', project.id);

            if (ARCHIVE_TYPES.indexOf(project.type) === -1) {
                return $q.reject(new Error('Projects of this type cannot be exported'));
            }

            return utilService.loadZipSupport()
                .then(function () {
                    return $q.all({
                        project : readProjectRecord(project, profile),
                        training : readTrainingRecords(project, profile)
                    });
                })
                .then(function (contents) {
                    return buildArchiveItems(project, profile, contents.training, onProgress)
                        .then(function (built) {
                            var zip = new JSZip();

                            zip.file(MANIFEST_FILE, JSON.stringify({
                                formatversion : ARCHIVE_FORMAT_VERSION,
                                exported : new Date().toISOString(),
                                application : 'machinelearningforkids'
                            }, null, 2));

                            zip.file(PROJECT_FILE,
                                     JSON.stringify(buildArchiveProject(contents.project), null, 2));

                            zip.file(TRAINING_FILE,
                                     JSON.stringify(built.records.map(function (item) {
                                         return item.row;
                                     }), null, 2));

                            built.records.forEach(function (item) {
                                if (item.file) {
                                    zip.file(item.file.path, item.file.data);
                                }
                            });

                            var testdata = readTestData(project);
                            if (testdata) {
                                zip.file(TESTDATA_FILE, testdata);
                            }

                            return asAngularPromise(zip.generateAsync({ type : 'blob' }))
                                .then(function (blob) {
                                    return {
                                        blob : blob,
                                        filename : archiveFilename(contents.project),
                                        exported : built.records.length,
                                        skipped : built.skipped,
                                        testdata : Boolean(testdata)
                                    };
                                });
                        });
                });
        }


        // never allowed to fail an export. localStorage can be full, or a
        //  no-op in-memory shim in Safari private mode, and an archive without
        //  the test data is still a good archive
        function readTestData(project) {
            try {
                return storageService.getItem(TESTDATA_PREFIX + project.id);
            }
            catch (err) {
                loggerService.error('[ml4karchive] failed to read test data', err);
                return null;
            }
        }


        // ---- importing ----

        // an archive is a file a child chose off their own computer, so it can
        //  be anything at all. two kinds of problem are possible, and they are
        //  treated very differently:
        //
        //  * we cannot make a coherent project from this file - refuse it, and
        //    say why. nothing is created
        //  * we cannot use one training example - skip it, count it, and carry
        //    on. exactly what cloning does with a dead image link
        function ArchiveError(message) {
            var err = new Error(message);
            err.archive = true;
            return err;
        }


        function readArchiveFile(zip, path) {
            var entry = zip.file(path);
            if (!entry) {
                return $q.resolve(undefined);
            }
            return asAngularPromise(entry.async('string'));
        }


        function readRequiredJson(zip, path) {
            return readArchiveFile(zip, path)
                .then(function (contents) {
                    if (!contents) {
                        throw ArchiveError('This file is not a project archive');
                    }
                    try {
                        return JSON.parse(contents);
                    }
                    catch (err) {
                        throw ArchiveError('This file is not a project archive');
                    }
                });
        }


        function verifyManifest(manifest) {
            if (!manifest || manifest.formatversion === undefined) {
                throw ArchiveError('This file is not a project archive');
            }
            if (manifest.formatversion > ARCHIVE_FORMAT_VERSION) {
                // refusing outright beats importing the half of a newer
                //  archive that happens to still be recognisable
                throw ArchiveError('This project archive was made by a newer version ' +
                                   'of Machine Learning for Kids');
            }
            return manifest;
        }


        function verifyArchiveProject(archiveproject) {
            if (!archiveproject || !archiveproject.name || !archiveproject.type) {
                throw ArchiveError('This file is not a project archive');
            }
            if (ARCHIVE_TYPES.indexOf(archiveproject.type) === -1) {
                throw ArchiveError('Projects of this type cannot be imported');
            }
            return archiveproject;
        }


        function imageMimeFromPath(path) {
            return /\.png$/i.test(path) ? 'image/png' : 'image/jpeg';
        }


        // reads one training row out of the archive, resolving to the record
        //  to write into browser storage. rejects if this one example cannot
        //  be used, which the caller counts as a skip
        function readTrainingRecord(zip, archiveproject, profile, row) {
            if (!row || !row.label) {
                return $q.reject(new Error('training item has no label'));
            }

            if (archiveproject.type === 'text') {
                if (typeof row.textdata !== 'string') {
                    return $q.reject(new Error('training item has no text'));
                }
                return $q.resolve({ label : row.label, textdata : row.textdata });
            }

            if (archiveproject.type === 'numbers') {
                if (!Array.isArray(row.numberdata)) {
                    return $q.reject(new Error('training item has no numbers'));
                }
                return $q.resolve({ label : row.label, numberdata : row.numberdata });
            }

            if (archiveproject.type === 'sounds') {
                var soundentry = row.audiourl ? zip.file(row.audiourl) : undefined;
                if (!soundentry) {
                    return $q.reject(new Error('sound file missing from archive'));
                }
                return asAngularPromise(soundentry.async('string'))
                    .then(function (contents) {
                        var spectrogram = JSON.parse(contents);
                        if (!Array.isArray(spectrogram)) {
                            throw new Error('sound file is not a spectrogram');
                        }
                        return { label : row.label, audiodata : spectrogram };
                    });
            }

            if (archiveproject.type === 'imgtfjs') {
                if (row.isstored) {
                    var imageentry = row.imageurl ? zip.file(row.imageurl) : undefined;
                    if (!imageentry) {
                        return $q.reject(new Error('image file missing from archive'));
                    }
                    return asAngularPromise(imageentry.async('arraybuffer'))
                        .then(function (bytes) {
                            return {
                                label : row.label,
                                isstored : true,
                                imagedata : new Blob([ bytes ],
                                                     { type : imageMimeFromPath(row.imageurl) })
                            };
                        });
                }

                // an archive never carries the bytes for an image the project
                //  only had a link to, so importing one means fetching it
                //  again - through the same check-and-resize helper the
                //  training page uses. a link that has stopped working since
                //  the archive was made becomes a skipped example
                return fetchLinkedImage(profile, row);
            }

            return $q.reject(new Error('unsupported project type'));
        }


        function fetchLinkedImage(profile, row) {
            if (!row.imageurl) {
                return $q.reject(new Error('training item has no image'));
            }

            var url = '/api/classes/' + profile.tenant +
                      '/students/' + profile.user_id +
                      '/training/images';
            var record;

            return $http.get(url, {
                    params : { imageurl : row.imageurl, label : row.label, option : 'check' }
                })
                .then(function (resp) {
                    record = resp.data;
                    return $http.get(url, {
                        responseType : 'arraybuffer',
                        params : { imageurl : row.imageurl, label : row.label, option : 'prepare' }
                    });
                })
                .then(function (resp) {
                    record.imagedata = resp.data;
                    return record;
                });
        }


        // reads every training row, at most MAX_CONCURRENT_DOWNLOADS at a
        //  time. only the linked-image rows actually go to the network, but
        //  reading a few hundred images out of a zip is worth pacing too
        function readArchiveTrainingRecords(zip, archiveproject, profile, rows, onProgress) {
            return downloadInPool(rows, function (row) {
                return readTrainingRecord(zip, archiveproject, profile, row);
            }, onProgress);
        }


        function restoreTestData(zip, newproject) {
            return readArchiveFile(zip, TESTDATA_FILE)
                .then(function (testdata) {
                    if (!testdata) {
                        return false;
                    }
                    try {
                        storageService.setItem(TESTDATA_PREFIX + newproject.id, testdata);
                        return true;
                    }
                    catch (err) {
                        // as on export - losing the test data is never a
                        //  reason to lose the project
                        loggerService.error('[ml4karchive] failed to restore test data', err);
                        return false;
                    }
                });
        }


        // everything in the archive that describes where the project used to
        //  live is thrown away and replaced. an imported project belongs to
        //  the child importing it, lives in their browser, and is nobody
        //  else's
        function createImportedProject(archiveproject, profile) {
            var labels = cloneLabels(archiveproject).map(function (label) {
                // browserStorageService.addProject writes whatever labels
                //  array it is handed, unsanitised - so a label that would
                //  never be allowed through addLabel can only be stopped here
                return browserStorageService.sanitizeLabel(label);
            });

            var projectattrs = {
                name : archiveproject.name,
                type : archiveproject.type,
                labels : labels,
                storage : 'local',
                language : archiveproject.language,
                isCrowdSourced : false
            };

            if (archiveproject.type === 'numbers') {
                // carried for numbers projects and no others, which is what
                //  the new-project form does - it strips fields for every
                //  other type. field order is the contract here, because
                //  multichoice training values are indices into choices
                projectattrs.fields = archiveproject.fields ? archiveproject.fields : [];
            }

            return projectsService.createProject(projectattrs, profile.user_id, profile.tenant);
        }


        function importProject(archivefile, profile, onProgress) {
            loggerService.debug('[ml4karchive] importing project archive');

            return utilService.loadZipSupport()
                .then(function () {
                    return browserStorageService.isSupported();
                })
                .then(function (supported) {
                    if (supported !== SUPPORTED_OK) {
                        throw ArchiveError('Your web browser cannot store projects');
                    }

                    return asAngularPromise(JSZip.loadAsync(archivefile))
                        .catch(function () {
                            throw ArchiveError('This file is not a project archive');
                        });
                })
                .then(function (zip) {
                    return readRequiredJson(zip, MANIFEST_FILE)
                        .then(verifyManifest)
                        .then(function () {
                            return readRequiredJson(zip, PROJECT_FILE);
                        })
                        .then(verifyArchiveProject)
                        .then(function (archiveproject) {
                            return readRequiredJson(zip, TRAINING_FILE)
                                .then(function (rows) {
                                    if (!Array.isArray(rows)) {
                                        throw ArchiveError('This file is not a project archive');
                                    }

                                    // as with cloning, every example is read
                                    //  before the project is created, so that
                                    //  a failed read leaves nothing behind
                                    //  rather than a stranded empty project
                                    return readArchiveTrainingRecords(zip, archiveproject,
                                                                       profile, rows, onProgress);
                                })
                                .then(function (built) {
                                    return createImportedProject(archiveproject, profile)
                                        .then(function (newproject) {
                                            return browserStorageService
                                                .bulkAddTrainingData(newproject.id, built.records)
                                                .then(function () {
                                                    return restoreTestData(zip, newproject);
                                                })
                                                .then(function (testdata) {
                                                    return {
                                                        project : newproject,
                                                        imported : built.records.length,
                                                        skipped : built.skipped,
                                                        testdata : testdata
                                                    };
                                                });
                                        });
                                });
                        });
                });
        }


        return {
            cloneProject : cloneProject,
            exportProject : exportProject,
            importProject : importProject
        };
    }
}());
