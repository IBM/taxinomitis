(function () {

    angular
        .module('app')
        .controller('ResetStorageController', ResetStorageController);

    ResetStorageController.$inject = [
        '$scope', '$timeout'
    ];

    function ResetStorageController($scope, $timeout) {
        $scope.debugoutput = { text : "DEBUG OUTPUT\n" };

        function debug (str) {
            console.log(str);
            $scope.$applyAsync(() => {
                $scope.debugoutput.text += (Date.now().toString() + " : " + str + "\n");
            });
        }
        function divider (title) {
            debug('-------------------------------------------------------');
            debug(title);
            debug('-------------------------------------------------------');
        }
        function handleErr (err) {
            debug(err);
            debug(err.stack);
        }

        function debugDatabase(db) {
            debug('database name:    ' + db.name);
            debug('database version: ' + db.version);

            const DBOpenRequest = window.indexedDB.open(db.name, db.version);
            DBOpenRequest.onupgradeneeded = (event) => {
                debug('Upgrade needed for database ' + db.name);
                handleErr(event);
            };
            DBOpenRequest.onblocked = (event) => {
                debug('Blocked from loading database ' + db.name);
                handleErr(event);
            };
            DBOpenRequest.onerror = (event) => {
                debug('Error loading database ' + db.name);
                handleErr(event);
            };
            DBOpenRequest.onsuccess = () => {
                debug('opened ' + db.name);
                const storenames = [];
                const numstores = DBOpenRequest.result.objectStoreNames.length;
                debug(db.name + ' (' + numstores + ' object stores)');
                for (let idx = 0; idx < numstores; idx++) {
                    const storename = DBOpenRequest.result.objectStoreNames[idx];
                    storenames.push(storename);
                }
                if (storenames.length > 0) {
                    const transaction = DBOpenRequest.result.transaction(storenames);
                    for (const storename of storenames) {
                        debug(db.name + ' > ' + storename);
                        const objectstore = transaction.objectStore(storename);
                        debug(db.name + ' > ' + storename + ' > autoinc = ' + objectstore.autoIncrement);
                        debug(db.name + ' > ' + storename + ' > key = ' + objectstore.keyPath);
                        for (let idx = 0; idx < objectstore.indexNames.length; idx++) {
                            debug(db.name + ' > ' + storename + ' > index = ' + objectstore.indexNames[idx]);
                        }
                        const count = objectstore.count();
                        count.onsuccess = () => {
                            debug(db.name + ' > ' + storename + ' > records = ' + count.result);
                        };
                    }
                }

                DBOpenRequest.result.close();
            };
        }

        $scope.listDatabases = function () {
            divider('listDatabases');
            try {
                navigator.storage.estimate()
                    .then((estimate) => {
                        debug('storage quota : ' + estimate.quota);
                        debug('storage usage : ' + estimate.usage);
                        if (estimate.usageDetails) {
                            for (const key of Object.keys(estimate.usageDetails)) {
                                debug('storage usage > ' + key + ' > ' + estimate.usageDetails[key]);
                            }
                        }
                        else {
                            debug('storage usage details unavailable');
                        }
                    })
                    .catch(handleErr);

                window.indexedDB.databases()
                    .then((dbs) => {
                        dbs.forEach(debugDatabase);
                    })
                    .catch(handleErr);
            }
            catch (err) {
                handleErr(err);
            }
        };


        // -----


        function createNewAssetStore () {
            debug('createNewAssetStore');
            const createrequest = window.indexedDB.open('mlforkidsAssets');
            createrequest.onupgradeneeded = function (event) {
                debug('createNewAssetStore > onupgradeneeded');
                event.target.result.createObjectStore('assets');
            };
            createrequest.onerror = function (event) {
                debug('createNewAssetStore > onerror');
                handleErr(event);
            };
            createrequest.onsuccess = function (event) {
                debug('createNewAssetStore > onsuccess');
                createrequest.result.close();
            };
        }

        $scope.resetAssetsStore = function () {
            divider('resetAssetsStore');
            try {
                const DBDeleteRequest = window.indexedDB.deleteDatabase('mlforkidsAssets');
                DBDeleteRequest.onerror = (event) => {
                    debug('Failed to delete existing assets database');
                    handleErr(event);
                    debug('Pausing for 5 seconds before creating new database');
                    $timeout(createNewAssetStore, 5000);
                };
                DBDeleteRequest.onsuccess = (event) => {
                    debug('Deleted existing assets database');
                    debug('Pausing for 5 seconds before creating new database');
                    $timeout(createNewAssetStore, 5000);
                };
            }
            catch (err) {
                handleErr(err);
            }
        };


        // -----


        function createNewProjectsStore () {
            debug('createNewProjectsStore');
            const createrequest = window.indexedDB.open('mlforkidsLocalProjects');
            createrequest.onupgradeneeded = function (event) {
                debug('createNewProjectStore > onupgradeneeded');
                const table = event.target.result.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                table.createIndex('classid', 'classid', { unique: false });
            };
            createrequest.onerror = function (event) {
                debug('createNewProjectStore > onerror');
                handleErr(event);
            };
            createrequest.onsuccess = function (event) {
                debug('createNewProjectStore > onsuccess');
                createrequest.result.close();
            };
        }

        $scope.resetProjectsStore = function () {
            divider('resetProjectsStore');
            try {
                const DBDeleteRequest = window.indexedDB.deleteDatabase('mlforkidsLocalProjects');
                DBDeleteRequest.onerror = (event) => {
                    debug('Failed to delete existing projects database');
                    handleErr(event);
                    debug('Pausing for 5 seconds before creating new database');
                    $timeout(createNewProjectsStore, 5000);
                };
                DBDeleteRequest.onsuccess = (event) => {
                    debug('Deleted existing projects database');
                    debug('Pausing for 5 seconds before creating new database');
                    $timeout(createNewProjectsStore, 5000);
                };
            }
            catch (err) {
                handleErr(err);
            }
        };

        $scope.clearTensorflowStore = function () {
            divider('clearTensorflowStore');
            try {
                const DBDeleteRequest = window.indexedDB.deleteDatabase('tensorflowjs');
                DBDeleteRequest.onerror = (event) => {
                    debug('Failed to delete existing tensorflowjs database');
                    handleErr(event);
                };
                DBDeleteRequest.onsuccess = (event) => {
                    debug('Deleted existing tensorflowjs database');
                };
            }
            catch (err) {
                handleErr(err);
            }
        };
    }
}());
