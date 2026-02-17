(function () {

    angular
        .module('app')
        .service('browserStorageService', browserStorageService);

    browserStorageService.$inject = [
        'loggerService',
        'cleanupService', 'readersService',
        '$timeout', '$http', '$q'
    ];

    function browserStorageService(loggerService, cleanupService, readersService, $timeout, $http, $q) {

        const SUPPORTED_UNKNOWN = 0;
        const SUPPORTED_OK = 1;
        const SUPPORTED_NO = -1;
        let supported = SUPPORTED_UNKNOWN;

        let projectsDbHandle;
        const PROJECTS_DB_NAME = 'mlforkidsLocalProjects';
        const PROJECTS_TABLE = 'projects';

        const trainingDataDatabases = {};
        const TRAINING_DB_NAME_PREFIX = 'mlforkidsProject';
        const TRAINING_TABLE = 'training';

        let assetsDbHandle;
        const ASSETS_DB_NAME = 'mlforkidsAssets';
        const ASSETS_TABLE = 'assets';


        //-----------------------------------------------------------
        //  check if indexedDB is working
        //-----------------------------------------------------------
        loggerService.debug('[ml4kstorage] verifying browser storage');
        const CHECK_ID = 'mlforkids-check-' + Date.now();
        try {
            window.indexedDB.open(CHECK_ID, 1).onupgradeneeded = function(evt) {
                const db = evt.target.result;
                try {
                    const objectStore = db.createObjectStore('mlforkids', { autoIncrement: true });
                    objectStore.put(new Blob());
                    supported = SUPPORTED_OK;
                    loggerService.debug('[ml4kstorage] browser storage verified');
                }
                catch (error) {
                    loggerService.error('[ml4kstorage] IndexedDB not supported', error);
                    supported = SUPPORTED_NO;
                }
                finally {
                    try {
                        if (db) {
                            db.close();
                        }
                        window.indexedDB.deleteDatabase(CHECK_ID);
                    }
                    catch (cleanuperr) {
                        loggerService.error('[ml4kstorage] failed to clean up storage verification assets', cleanuperr);
                    }
                }
            };
        }
        catch (err) {
            loggerService.error('[ml4kstorage] unable to verify browser storage', err);
            supported = SUPPORTED_NO;
        }
        function isSupported() {
            if (supported === SUPPORTED_UNKNOWN) {
                // race condition if refreshing the New Projects wizard - can
                //  init the new project form before we know if local storage
                //  is supported
                return $q((resolve) => {
                    $timeout(() => {
                        resolve(supported);
                    }, 500);
                });
            }
            else {
                return $q.resolve(supported);
            }
        }


        function isCorruptedDatabase(err) {
            return err &&
                   err.name === 'NotFoundError' &&
                   (err.message === "Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found." ||
                    err.message === "IDBDatabase.transaction: 'assets' is not a known object store name");
        }

        //-----------------------------------------------------------
        //  common functions
        //-----------------------------------------------------------

        // cloud projects use uuid IDs
        // local projects use (auto-incrementing) integer IDs
        function idIsLocal(id) {
            return parseInt(id, 10).toString() === id.toString();
        }



        function promisifyIndexedDbRequest (request) {
            return new Promise(function (resolve, reject) {
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }
        function promisifyIndexedDbTransaction (transaction) {
            return new Promise(function (resolve, reject) {
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
        }


        function initProjectsDatabase (event) {
            loggerService.debug('[ml4kstorage] initProjectsDatabase');
            const table = event.target.result.createObjectStore(PROJECTS_TABLE, { keyPath: 'id', autoIncrement: true });
            table.createIndex('classid', 'classid', { unique: false });
        }
        function initTrainingDatabase (event) {
            loggerService.debug('[ml4kstorage] initTrainingDatabase');
            const table = event.target.result.createObjectStore(TRAINING_TABLE, { keyPath: 'id', autoIncrement: true });
            table.createIndex('label', 'label', { unique: false });
        }
        function initAssetsDatabase (event) {
            loggerService.debug('[ml4kstorage] initAssetsDatabase');
            event.target.result.createObjectStore(ASSETS_TABLE);
        }


        function getProjectsDatabase() {
            loggerService.debug('[ml4kstorage] getProjectsDatabase');

            const request = window.indexedDB.open(PROJECTS_DB_NAME);
            request.onupgradeneeded = initProjectsDatabase;

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return event.target.result;
                });
        }
        function getTrainingDatabase(projectId) {
            loggerService.debug('[ml4kstorage] getTrainingDatabase', projectId);

            const request = window.indexedDB.open(TRAINING_DB_NAME_PREFIX + projectId);
            request.onupgradeneeded = initTrainingDatabase;

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return event.target.result;
                });
        }
        function getAssetsDatabase() {
            loggerService.debug('[ml4kstorage] getAssetsDatabase');

            const request = window.indexedDB.open(ASSETS_DB_NAME);
            request.onupgradeneeded = initAssetsDatabase;

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return event.target.result;
                });
        }


        async function requiresProjectsDatabase() {
            if (!projectsDbHandle) {
                projectsDbHandle = await getProjectsDatabase();
                projectsDbHandle.onversionchange = () => {
                    loggerService.debug('[ml4kstorage] external change to projects database');
                    if (projectsDbHandle) {
                        projectsDbHandle.close();
                    }
                };
                projectsDbHandle.onclose = () => {
                    loggerService.debug('[ml4kstorage] projects database closed');
                    projectsDbHandle = null;
                };
            }
        }
        async function requiresTrainingDatabase(projectId) {
            if (!trainingDataDatabases[projectId]) {
                trainingDataDatabases[projectId] = await getTrainingDatabase(projectId);
                trainingDataDatabases[projectId].onversionchange = () => {
                    loggerService.debug('[ml4kstorage] external change to training database');
                    if (trainingDataDatabases[projectId]) {
                        trainingDataDatabases[projectId].close();
                    }
                };
                trainingDataDatabases[projectId].onclose = () => {
                    loggerService.debug('[ml4kstorage] training database closed', projectId);
                    delete trainingDataDatabases[projectId];
                };
            }
        }
        async function requiresAssetsDatabase() {
            if (!assetsDbHandle) {
                assetsDbHandle = await getAssetsDatabase();
                assetsDbHandle.onversionchange = () => {
                    loggerService.debug('[ml4kstorage] external change to assets database');
                    if (assetsDbHandle) {
                        assetsDbHandle.close();
                    }
                };
                assetsDbHandle.onclose = () => {
                    loggerService.debug('[ml4kstorage] assets database closed');
                    assetsDbHandle = null;
                };
            }
        }


        function requiresResult(event) {
            if (event &&
                event.target &&
                event.target.result)
            {
                return event.target.result;
            }

            const notFoundErr = new Error('not found');
            notFoundErr.status = 404;
            notFoundErr.data = {
                error: 'not found'
            };
            throw notFoundErr;
        }

        function requiresIntegerId(id) {
            return parseInt(id, 10);
        }


        //-----------------------------------------------------------
        //  PROJECTS database
        //-----------------------------------------------------------

        async function deleteSessionUserProjects() {
            loggerService.debug('[ml4kstorage] deleteSessionUserProjects');

            try {
                await requiresProjectsDatabase();
            }
            catch (err) {
                loggerService.error('[ml4kstorage] unable to get projects database. exiting.', err);
                return;
            }

            return new Promise(function (resolve, reject) {
                try {
                    const projectTransaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
                    const projectsTable = projectTransaction.objectStore(PROJECTS_TABLE);
                    const request = projectsTable.index('classid').openCursor(IDBKeyRange.only('session-users'));
                    request.onsuccess = function (event) {
                        const cursor = event.target.result;
                        if (cursor) {
                            // delete any local data for this project
                            cleanupService.deleteProject(cursor.value);

                            // delete the training data database
                            delete trainingDataDatabases[cursor.value.id];
                            window.indexedDB.deleteDatabase(TRAINING_DB_NAME_PREFIX + cursor.value.id);

                            // delete any saved language model data
                            deleteAsset('language-model-' + cursor.value.id);

                            // delete the project itself
                            projectsTable.delete(cursor.primaryKey);

                            // move to the next project
                            cursor.continue();
                        }
                        else {
                            // nothing left to delete
                            resolve();
                        }
                    };
                    request.onerror = function (err) {
                        loggerService.error('[ml4kstorage] failed to get cursor.', err);
                        reject(err);
                    };
                }
                catch (err) {
                    if (isCorruptedDatabase(err)) {
                        loggerService.error('[ml4kstorage] projects database corrupted', err);
                    }
                    else {
                        loggerService.error('[ml4kstorage] failed to run session user cleanup.', err);
                    }
                    reject(err);
                }
            });
        }


        async function getProjects(userid) {
            loggerService.debug('[ml4kstorage] getProjects');
            if (supported === SUPPORTED_NO) {
                return Promise.resolve([]);
            }

            try {
                await requiresProjectsDatabase();
            }
            catch (err) {
                loggerService.error('[ml4kstorage] unable to get projects database.', err);
                return [];
            }

            try {
                const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readonly');
                const request = transaction.objectStore(PROJECTS_TABLE).getAll();

                const event = await promisifyIndexedDbRequest(request)

                return event.target.result.filter(function (project) {
                    return project.userid === userid;
                });
            }
            catch (err) {
                loggerService.error('[ml4kstorage] unable to get local projects info.', err);
                return [];
            }
        }


        async function getProject(projectId) {
            loggerService.debug('[ml4kstorage] getProject', projectId);

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readonly');
            const request = transaction.objectStore(PROJECTS_TABLE).get(requiresIntegerId(projectId));

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return requiresResult(event);
                });
        }


        async function addProject(projectInfo) {
            loggerService.debug('[ml4kstorage] addProject', projectInfo);

            await requiresProjectsDatabase();

            if (!projectInfo.labels) {
                projectInfo.labels = [];
            }
            if (projectInfo.type === 'sounds') {
                projectInfo.labels.push('_background_noise_');
            }

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const request = transaction.objectStore(PROJECTS_TABLE).add(projectInfo);

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    projectInfo.id = event.target.result;
                    return projectInfo;
                });
        }


        function addCloudRefToProject(localProjectId, cloudProjectId) {
            return addMetadataToProject(localProjectId, 'cloudid', cloudProjectId);
        }


        async function addMetadataToProject(projectid, key, value) {
            loggerService.debug('[ml4kstorage] addMetadataToProject', arguments);

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = transaction.objectStore(PROJECTS_TABLE);
            const readRequest = projectsTable.get(requiresIntegerId(projectid));
            const readEvent = await promisifyIndexedDbRequest(readRequest);
            const projectObject = requiresResult(readEvent);

            projectObject[key] = value;

            const updateRequest = projectsTable.put(projectObject);
            await promisifyIndexedDbRequest(updateRequest);

            return projectObject;
        }


        async function deleteProject(projectId) {
            loggerService.debug('[ml4kstorage] deleteProject');

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            transaction.objectStore(PROJECTS_TABLE).delete(requiresIntegerId(projectId));

            window.indexedDB.deleteDatabase(TRAINING_DB_NAME_PREFIX + projectId);
            delete trainingDataDatabases[projectId];

            return promisifyIndexedDbTransaction(transaction);
        }


        async function updateLocalProject(projectId, updateFn) {
            loggerService.debug('[ml4kstorage] updateLocalProject');

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = transaction.objectStore(PROJECTS_TABLE);
            const readRequest = projectsTable.get(requiresIntegerId(projectId));
            const readEvent = await promisifyIndexedDbRequest(readRequest);
            const projectObject = requiresResult(readEvent);

            const updatedProjectObject = updateFn(projectObject);

            const updateRequest = projectsTable.put(updatedProjectObject);
            await promisifyIndexedDbRequest(updateRequest);

            return updatedProjectObject;
        }


        async function setLanguageModelType(projectId, modelType) {
            loggerService.debug('[ml4kstorage] setLanguageModelType');

            return updateLocalProject(projectId, (projectObject) => {
                projectObject.modeltype = modelType;
                return projectObject;
            });
        }

        async function storeSmallLanguageModelConfig(projectId, slm) {
            loggerService.debug('[ml4kstorage] storeSmallLanguageModelConfig');

            return updateLocalProject(projectId, (projectObject) => {
                projectObject.slm = slm;
                return projectObject;
            });
        }
        async function storeToyLanguageModelConfig(projectId, toy) {
            loggerService.debug('[ml4kstorage] storeToyLanguageModelConfig');

            return updateLocalProject(projectId, (projectObject) => {
                projectObject.toy = toy;
                return projectObject;
            });
        }



        // update labels to meet WA requirements
        const INVALID_LABEL_NAME_CHARS = /[^\w.]/g;
        const MAX_LABEL_LENGTH = 30;
        function sanitizeLabel(proposedlabel) {
            return proposedlabel
                .replace(INVALID_LABEL_NAME_CHARS, '_')
                .substring(0, MAX_LABEL_LENGTH);
        }

        async function addLabel(projectId, newlabel) {
            loggerService.debug('[ml4kstorage] addLabel');

            await requiresProjectsDatabase();

            let label = newlabel;
            try {
                label = sanitizeLabel(newlabel);
            }
            catch (labelErr) {
                loggerService.error('[ml4kstorage] Failed to sanitize label, leaving as-is');
            }

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = transaction.objectStore(PROJECTS_TABLE);
            const readRequest = projectsTable.get(requiresIntegerId(projectId));
            const readEvent = await promisifyIndexedDbRequest(readRequest);
            const projectObject = requiresResult(readEvent);

            if (!projectObject.labels.map(l => l.toLowerCase()).includes(label.toLowerCase())) {
                projectObject.labels.push(label);

                const updateRequest = projectsTable.put(projectObject);
                await promisifyIndexedDbRequest(updateRequest);
            }

            return projectObject.labels;
        }


        async function deleteLabel(projectId, removedlabel) {
            loggerService.debug('[ml4kstorage] deleteLabel');

            await requiresProjectsDatabase();
            await requiresTrainingDatabase(projectId);

            // -- update project definition
            const projectTransaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = projectTransaction.objectStore(PROJECTS_TABLE);
            const readRequest = projectsTable.get(requiresIntegerId(projectId));
            const readEvent = await promisifyIndexedDbRequest(readRequest);
            const projectObject = requiresResult(readEvent);
            projectObject.labels = projectObject.labels.filter(function (label) {
                return label !== removedlabel;
            });
            const updateRequest = projectsTable.put(projectObject);
            await promisifyIndexedDbRequest(updateRequest);

            // -- update training data items
            const trainingTransaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readwrite');
            const trainingTable = trainingTransaction.objectStore(TRAINING_TABLE);
            trainingTable.index('label').openCursor(IDBKeyRange.only(removedlabel)).onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    trainingTable.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            return projectObject.labels;
        }


        //-----------------------------------------------------------
        //  TRAINING DATA store
        //-----------------------------------------------------------

        async function getTrainingData(projectId) {
            loggerService.debug('[ml4kstorage] getTrainingData', projectId);

            await requiresTrainingDatabase(projectId);

            try {
                const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readonly');
                const request = transaction.objectStore(TRAINING_TABLE).getAll();

                return promisifyIndexedDbRequest(request)
                    .then(function (event) {
                        return event.target.result;
                    });
            }
            catch (err) {
                if (isCorruptedDatabase(err)) {
                    loggerService.debug('[ml4kstorage] training db corrupted - resetting');

                    if (trainingDataDatabases[projectId]) {
                        trainingDataDatabases[projectId].close();
                    }
                    window.indexedDB.deleteDatabase(TRAINING_DB_NAME_PREFIX + projectId);
                    delete trainingDataDatabases[projectId];

                    throw new Error('Error in your web browser storage. Please refresh the page.');
                }

                throw err;
            }
        }


        async function countTrainingData(projectId) {
            loggerService.debug('[ml4kstorage] countTrainingData', projectId);

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readonly');
            const request = transaction.objectStore(TRAINING_TABLE).count();

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return event.target.result;
                });
        }


        async function getTrainingDataItem(projectId, trainingDataId) {
            loggerService.debug('[ml4kstorage] getTrainingDataItem');

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readonly');
            const request = transaction.objectStore(TRAINING_TABLE).get(requiresIntegerId(trainingDataId));

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return requiresResult(event);
                });
        }


        async function addTrainingData(projectId, trainingObject) {
            loggerService.debug('[ml4kstorage] addTrainingData');

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readwrite');
            const request = transaction.objectStore(TRAINING_TABLE).add(trainingObject);

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    trainingObject.id = event.target.result;

                    // if (trainingObject.label) {
                    //     return addLabel(projectId, trainingObject.label)
                    //         .then(() =>  {
                    //             return trainingObject;
                    //         });
                    // }
                    // else {
                        return trainingObject;
                    // }
                });
        }


        async function bulkAddTrainingData(projectId, trainingObjects) {
            loggerService.debug('[ml4kstorage] bulkAddTrainingData');

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readwrite');
            const trainingTable = transaction.objectStore(TRAINING_TABLE)

            return new Promise(function (resolve, reject) {
                const numObjects = trainingObjects.length;
                var added = 0;
                var error;
                for (let i = 0; i < numObjects; i++) {
                    const trainingObject = trainingObjects[i];

                    const request = trainingTable.add(trainingObject);
                    request.onsuccess = function (event) {
                        added += 1;
                        trainingObject.id = event.target.result;
                        if (added === numObjects) {
                            if (error) {
                                return reject(error);
                            }
                            else {
                                return resolve(trainingObjects);
                            }
                        }
                    };
                    request.onerror = function (err) {
                        error = err;
                        added += 1;
                        if (added === numObjects) {
                            return reject(error);
                        }
                    };
                }
            });
        }


        async function deleteTrainingData(projectId, trainingDataId) {
            loggerService.debug('[ml4kstorage] deleteTrainingData');

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readwrite');
            transaction.objectStore(TRAINING_TABLE).delete(requiresIntegerId(trainingDataId));

            return promisifyIndexedDbTransaction(transaction);
        }


        async function clearTrainingData(projectId) {
            loggerService.debug('[ml4kstorage] clearTrainingData');

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readwrite');
            transaction.objectStore(TRAINING_TABLE).clear();

            return promisifyIndexedDbTransaction(transaction);
        }


        async function getLabelCounts(projectId) {
            loggerService.debug('[ml4kstorage] getLabelCounts', projectId);

            return Promise.all([
                getProject(projectId),
                getTrainingData(projectId)
            ])
            .then(function (projectdata) {
                const project = projectdata[0];
                const labels = {};
                for (const label of project.labels) {
                    labels[label] = 0;
                }

                const trainingdata = projectdata[1];
                for (const trainingitem of trainingdata) {
                    if (trainingitem.label in labels) {
                        labels[trainingitem.label] += 1;
                    }
                }

                return labels;
            });
        }


        async function getTrainingForWatsonAssistant(project) {
            loggerService.debug('[ml4kstorage] getTrainingForWatsonAssistant');

            const allTraining = await getTrainingData(project.id);

            const trainingByLabel = {};
            const duplicatesCheck = {};
            const labelCaseMapping = {};

            for (const item of allTraining) {
                const label = item.label;
                const labelLowerCase = label.toLowerCase();
                const text = item.textdata.substring(0, 1024);

                const canonicalLabel = labelCaseMapping[labelLowerCase] || label;
                if (!(labelLowerCase in labelCaseMapping)) {
                    labelCaseMapping[labelLowerCase] = label;
                }

                if (!(canonicalLabel in trainingByLabel)) {
                    trainingByLabel[canonicalLabel] = {
                        intent : canonicalLabel.replace(/\s/g, '_'),
                        examples : []
                    };
                }
                if (!(canonicalLabel in duplicatesCheck)) {
                    duplicatesCheck[canonicalLabel] = [];
                }

                const caseInsensitiveText = text.toLowerCase();
                if (!duplicatesCheck[canonicalLabel].includes(caseInsensitiveText)) {
                    trainingByLabel[canonicalLabel].examples.push({ text });
                    duplicatesCheck[canonicalLabel].push(caseInsensitiveText);
                }
            }

            return {
                name : project.name,
                language : project.language ? project.language : 'en',
                intents : Object.values(trainingByLabel),
                dialog_nodes : [],
                counterexamples: [],
                entities : [],
                metadata : {
                    createdby : 'machinelearningforkids',
                },
            };
        }



        //-----------------------------------------------------------
        //  ASSETS database
        //-----------------------------------------------------------

        async function storeAsset(id, url) {
            loggerService.debug('[ml4kstorage] storeAsset', id);

            await requiresAssetsDatabase();

            const resp = await $http.get(url, { responseType : 'blob' });
            const zipdata = resp.data;

            try {
                const transaction = assetsDbHandle.transaction([ ASSETS_TABLE ], 'readwrite');
                const request = transaction.objectStore(ASSETS_TABLE).put(zipdata, id);
                return promisifyIndexedDbRequest(request);
            }
            catch (err) {
                if (isCorruptedDatabase(err)) {
                    loggerService.debug('[ml4kstorage] assets db corrupted - resetting');
                    await deleteAssetsDatabase();
                }

                throw err;
            }
        }

        async function storeAssetData(id, data) {
            loggerService.debug('[ml4kstorage] storeAssetData', id);

            await requiresAssetsDatabase();

            try {
                const transaction = assetsDbHandle.transaction([ ASSETS_TABLE ], 'readwrite');
                const request = transaction.objectStore(ASSETS_TABLE).put(data, id);
                return promisifyIndexedDbRequest(request);
            }
            catch (err) {
                if (isCorruptedDatabase(err)) {
                    loggerService.debug('[ml4kstorage] assets db corrupted - resetting');
                    await deleteAssetsDatabase();
                }

                throw err;
            }
        }


        async function retrieveAsset(id) {
            loggerService.debug('[ml4kstorage] retrieveAsset', id);

            await requiresAssetsDatabase();

            const transaction = assetsDbHandle.transaction([ ASSETS_TABLE ], 'readonly');
            const request = transaction.objectStore(ASSETS_TABLE).get(id);
            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return requiresResult(event);
                });
        }

        async function retrieveAssetAsText(id) {
            loggerService.debug('[ml4kstorage] retrieveAssetAsText', id);

            const asset = await retrieveAsset(id);
            if (asset.text) {
                return asset.text();
            }
            else {
                // some browsers don't have a text() method, so this is a workaround
                return new Promise((resolve, reject) => {
                    try {
                        const blobReader = readersService.createFileReader();
                        blobReader.addEventListener('load', () => {
                            resolve(blobReader.result);
                        }, false);
                        blobReader.addEventListener('error', (err) => {
                            reject(err);
                        }, false);

                        blobReader.readAsText(asset);
                    }
                    catch (error) {
                        loggerService.error('[ml4kstorage] FileReader not supported', error);
                        reject(error);
                    }
                });
            }
        }

        async function deleteAsset(id) {
            loggerService.debug('[ml4kstorage] deleteAsset', id);

            if (supported === SUPPORTED_NO) {
                return Promise.resolve();
            }

            await requiresAssetsDatabase();

            try {
                const transaction = assetsDbHandle.transaction([ ASSETS_TABLE ], 'readwrite');
                transaction.objectStore(ASSETS_TABLE).delete(id);

                return promisifyIndexedDbTransaction(transaction);
            }
            catch (err) {
                if (isCorruptedDatabase(err)) {
                    loggerService.debug('[ml4kstorage] assets db corrupted - resetting');
                    await deleteAssetsDatabase();
                }
                else {
                    throw err;
                }
            }
        }

        function deleteAssetsDatabase() {
            loggerService.debug('[ml4kstorage] deleting assets database');
            return new Promise((resolve, reject) => {
                if (assetsDbHandle) {
                    assetsDbHandle.close();
                }
                const request = window.indexedDB.deleteDatabase(ASSETS_DB_NAME);
                request.onsuccess = () => {
                    assetsDbHandle = undefined;
                    resolve();
                };
                request.onerror = () => {
                    assetsDbHandle = undefined;
                    resolve();
                };
                request.onblocked = () => {
                    reject(new Error('Unable to store asset. Please close other tabs or windows using this site, and then refresh the page.'));
                };
            });
        }


        return {
            isSupported,
            isCorruptedDatabase,
            idIsLocal,
            sanitizeLabel,

            getProjects,
            getProject,
            addProject,
            addCloudRefToProject,
            addMetadataToProject,
            deleteProject,
            addLabel,
            deleteLabel,

            setLanguageModelType,
            storeSmallLanguageModelConfig,
            storeToyLanguageModelConfig,

            getTrainingData,
            countTrainingData,
            getTrainingDataItem,
            addTrainingData,
            bulkAddTrainingData,
            deleteTrainingData,
            clearTrainingData,
            getLabelCounts,
            getTrainingForWatsonAssistant,

            deleteSessionUserProjects,

            storeAsset,
            storeAssetData,
            retrieveAsset,
            retrieveAssetAsText,
            deleteAsset,
            deleteAssetsDatabase
        };
    }
})();