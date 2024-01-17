(function () {

    angular
        .module('app')
        .service('browserStorageService', browserStorageService);

    browserStorageService.$inject = [
        'loggerService',
        'cleanupService',
        '$timeout'
    ];

    function browserStorageService(loggerService, cleanupService, $timeout) {

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


        //-----------------------------------------------------------
        //  check if indexedDB is working
        //-----------------------------------------------------------
        loggerService.debug('[ml4kstorage] verifying browser storage');
        try {
            window.indexedDB.open('mlforkids', 1).onupgradeneeded = function(evt) {
                const db = evt.target.result;
                const objectStore = db.createObjectStore('mlforkids', { autoIncrement: true });
                try {
                    objectStore.put(new Blob());
                    supported = SUPPORTED_OK;
                    loggerService.debug('[ml4kstorage] browser storage verified');
                }
                catch (error) {
                    loggerService.error('[ml4kstorage] IndexedDB not supported', error);
                    supported = SUPPORTED_NO;
                }
                finally {
                    db.close();
                    window.indexedDB.deleteDatabase('mlforkids');
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
                return new Promise((resolve) => {
                    $timeout(() => {
                        resolve(supported);
                    }, 500);
                });
            }
            else {
                return Promise.resolve(supported);
            }
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


        function noop() {}


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
            loggerService.debug('[ml4kstorage] getTrainingDatabase');

            const request = window.indexedDB.open(TRAINING_DB_NAME_PREFIX + projectId);
            request.onupgradeneeded = initTrainingDatabase;

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return event.target.result;
                });
        }


        async function requiresProjectsDatabase() {
            if (!projectsDbHandle) {
                projectsDbHandle = await getProjectsDatabase();
            }
        }
        async function requiresTrainingDatabase(projectId) {
            if (!trainingDataDatabases[projectId]) {
                trainingDataDatabases[projectId] = await getTrainingDatabase(projectId);
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

            const projectTransaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = projectTransaction.objectStore(PROJECTS_TABLE);
            projectsTable.index('classid').openCursor(IDBKeyRange.only('session-users')).onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    // delete any local data for this project
                    cleanupService.deleteProject(cursor.value);

                    // delete the training data database
                    delete trainingDataDatabases[cursor.value.id];
                    window.indexedDB.deleteDatabase(TRAINING_DB_NAME_PREFIX + cursor.value.id);

                    // delete the project itself
                    projectsTable.delete(cursor.primaryKey);

                    // move to the next project
                    cursor.continue();
                }
            };
        }


        async function getProjects(userid) {
            loggerService.debug('[ml4kstorage] getProjects');
            if (isSupported === SUPPORTED_NO) {
                return Promise.resolve([]);
            }

            try {
                await requiresProjectsDatabase();
            }
            catch (err) {
                loggerService.error('[ml4kstorage] unable to get projects database.', err);
                return [];
            }

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readonly');
            const request = transaction.objectStore(PROJECTS_TABLE).getAll();

            return promisifyIndexedDbRequest(request)
                .then(function (event) {
                    return event.target.result.filter(function (project) {
                        return project.userid === userid;
                    });
                });
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


        async function addCloudRefToProject(localProjectId, cloudProjectId) {
            loggerService.debug('[ml4kstorage] addCloudRefToProject');

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = transaction.objectStore(PROJECTS_TABLE);
            const readRequest = projectsTable.get(requiresIntegerId(localProjectId));
            const readEvent = await promisifyIndexedDbRequest(readRequest);
            const projectObject = requiresResult(readEvent);

            projectObject.cloudid = cloudProjectId;

            const updateRequest = projectsTable.put(projectObject);
            await promisifyIndexedDbRequest(updateRequest);

            return projectObject;
        }


        async function deleteProject(projectId) {
            loggerService.debug('[ml4kstorage] deleteProject');

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const request = transaction.objectStore(PROJECTS_TABLE).delete(requiresIntegerId(projectId));

            window.indexedDB.deleteDatabase(TRAINING_DB_NAME_PREFIX + projectId);
            delete trainingDataDatabases[projectId];

            return promisifyIndexedDbRequest(request).then(noop);
        }


        async function addLabel(projectId, newlabel) {
            loggerService.debug('[ml4kstorage] addLabel');

            await requiresProjectsDatabase();

            const transaction = projectsDbHandle.transaction([ PROJECTS_TABLE ], 'readwrite');
            const projectsTable = transaction.objectStore(PROJECTS_TABLE);
            const readRequest = projectsTable.get(requiresIntegerId(projectId));
            const readEvent = await promisifyIndexedDbRequest(readRequest);
            const projectObject = requiresResult(readEvent);

            if (!projectObject.labels.includes(newlabel)) {
                projectObject.labels.push(newlabel);

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

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readonly');
            const request = transaction.objectStore(TRAINING_TABLE).getAll();

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
                    return trainingObject;
                });
        }


        async function deleteTrainingData(projectId, trainingDataId) {
            loggerService.debug('[ml4kstorage] deleteTrainingData');

            await requiresTrainingDatabase(projectId);

            const transaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readwrite');
            const request = transaction.objectStore(TRAINING_TABLE).delete(requiresIntegerId(trainingDataId));

            return promisifyIndexedDbRequest(request).then(noop);
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
                    labels[trainingitem.label] += 1;
                }

                return labels;
            });
        }


        async function getTrainingDataByLabel(projectId, label) {
            loggerService.debug('[ml4kstorage] getTrainingDataByLabel');

            await requiresTrainingDatabase(projectId);

            const trainingTransaction = trainingDataDatabases[projectId].transaction([ TRAINING_TABLE ], 'readonly');
            const trainingTable = trainingTransaction.objectStore(TRAINING_TABLE);

            return new Promise(function (resolve, reject) {
                const trainingItems = [];
                trainingTable.index('label').openCursor(IDBKeyRange.only(label)).onsuccess = function (event) {
                    const cursor = event.target.result;
                    if (cursor) {
                        trainingItems.push(cursor.value);
                        cursor.continue();
                    }
                    else {
                        resolve(trainingItems);
                    }
                };
            });
        }


        async function getTrainingForWatsonAssistant(project) {
            loggerService.debug('[ml4kstorage] getTrainingForWatsonAssistant');

            const trainingByLabel = {};

            const allTraining = await getTrainingData(project.id);
            for (const item of allTraining) {
                const label = item.label;
                const text = item.textdata;

                if (!(label in trainingByLabel)) {
                    trainingByLabel[label] = {
                        intent : label.replace(/\s/g, '_'),
                        examples : []
                    };
                }
                trainingByLabel[label].examples.push({ text });
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






        return {
            isSupported,
            idIsLocal,

            getProjects,
            getProject,
            addProject,
            addCloudRefToProject,
            deleteProject,
            addLabel,
            deleteLabel,

            getTrainingData,
            getTrainingDataItem,
            addTrainingData,
            deleteTrainingData,
            getLabelCounts,
            getTrainingDataByLabel,
            getTrainingForWatsonAssistant,

            deleteSessionUserProjects
        };
    }
})();