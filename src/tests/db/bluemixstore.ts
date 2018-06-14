/*eslint-env mocha */
import * as assert from 'assert';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as uuid from 'uuid/v1';

import * as store from '../../lib/db/store';
import * as conversation from '../../lib/training/conversation';
import * as visualrecog from '../../lib/training/visualrecognition';
import * as Types from '../../lib/training/training-types';
import * as DbTypes from '../../lib/db/db-types';

import * as request from 'request-promise';


describe('DB store', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    describe('Bluemix credentials', () => {

        it('should retrieve all conv Bluemix credentials', async () => {
            const retrieved = await store.getAllBluemixCredentials('conv');
            assert(retrieved.length > 0);
            for (const cred of retrieved) {
                assert.equal(cred.servicetype, 'conv');
            }
        });

        it('should retrieve all visrec Bluemix credentials', async () => {
            const retrieved = await store.getAllBluemixCredentials('visrec');
            assert(retrieved.length > 0);
            for (const cred of retrieved) {
                assert.equal(cred.servicetype, 'visrec');
            }
        });


        it('should store and retrieve Bluemix credentials', async () => {
            const classid = uuid();

            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
            };

            await store.storeBluemixCredentials(classid, creds);

            const retrieved = await store.getBluemixCredentials(classid, 'conv');
            assert.deepEqual(retrieved, [ creds ]);

            await store.deleteBluemixCredentials(creds.id);
        });

        it('should throw an error when fetching non-existent credentials', async () => {
            const classid = uuid();

            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
            };

            await store.storeBluemixCredentials(classid, creds);

            const retrieved = await store.getBluemixCredentials(classid, 'conv');
            assert.deepEqual(retrieved, [ creds ]);

            await store.deleteBluemixCredentials(creds.id);

            return store.getBluemixCredentials(classid, 'conv')
                .then(() => {
                    assert.fail(1, 0, 'Should not reach here', '');
                })
                .catch((err) => {
                    assert.equal(err.message, 'Unexpected response when retrieving service credentials');
                });
        });

        it('should retrieve credentials for a classifier', async () => {
            const classid = uuid();
            const projectid = uuid();
            const userid = uuid();

            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/workspaces',
                classid,
            };

            await store.storeBluemixCredentials(classid, creds);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : creds.id,
                created,
                expiry: created,
                language : 'en',
                name : randomstring.generate({ length : 12 }),
                url : uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(creds, project, classifierInfo);

            const retrievedCreds = await store.getBluemixCredentialsById(creds.id);
            assert.deepEqual(retrievedCreds, creds);

            await store.deleteBluemixCredentials(creds.id);
            await store.deleteConversationWorkspacesByProjectId(projectid);
        });

    });


    describe('Conversation classifiers', () => {

        it('should return 0 for unknown users', async () => {
            const unknownClass = uuid();
            const count = await store.countConversationWorkspaces(unknownClass);
            assert.equal(count, 0);
        });


        it('should retrieve expired classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const now = new Date();
            now.setMilliseconds(0);

            const future = new Date();
            future.setDate(future.getDate() + 1);
            future.setMilliseconds(0);

            const past = new Date();
            past.setDate(past.getDate() - 1);
            past.setMilliseconds(0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
            };
            const expired: Types.ConversationWorkspace = {
                id : uuid(),
                name : 'ONE',
                workspace_id : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                language : 'en',
                created : now,
                expiry : past,
            };
            const current: Types.ConversationWorkspace = {
                id : uuid(),
                name : 'TWO',
                workspace_id : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                language : 'en',
                created : now,
                expiry : future,
            };

            const alreadyExpired = await store.getExpiredConversationWorkspaces();

            const projectExpired: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : expired.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };
            const projectCurrent: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : current.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, projectExpired, expired);
            await store.storeConversationWorkspace(credentials, projectCurrent, current);

            const retrievedAll = await store.getConversationWorkspaces(projectid);
            assert.deepEqual(retrievedAll, [ expired, current ]);

            const retrievedExpired = await store.getExpiredConversationWorkspaces();
            assert.deepEqual(retrievedExpired.sort(sortWorkspaces),
                             alreadyExpired.concat([ expired ]).sort(sortWorkspaces));
        });


        function sortWorkspaces(a: Types.ConversationWorkspace, b: Types.ConversationWorkspace): number {
            if (a.id < b.id) {
                return -1;
            }
            else if (a.id > b.id) {
                return 1;
            }
            return 0;
        }


        it('should delete expired classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const now = new Date();
            now.setMilliseconds(0);

            const past = new Date();
            past.setDate(past.getDate() - 1);
            past.setMilliseconds(0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
            };
            await store.storeBluemixCredentials(classid, credentials);

            const expired: Types.ConversationWorkspace = {
                id : uuid(),
                name : 'ONE',
                workspace_id : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                language : 'en',
                created : now,
                expiry : past,
            };

            const projectExpired: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : expired.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, projectExpired, expired);

            const verifyBefore = await store.getConversationWorkspace(projectid, expired.workspace_id);
            assert.deepEqual(verifyBefore, expired);

            const countBefore = await store.getExpiredConversationWorkspaces();
            assert(countBefore.length >= 0);

            const deleteStub = sinon.stub(request, 'delete').resolves();
            await conversation.cleanupExpiredClassifiers();
            assert(deleteStub.called);
            deleteStub.restore();

            const countAfter = await store.getExpiredConversationWorkspaces();
            assert.equal(countAfter.length, 0);

            try {
                await store.getConversationWorkspace(projectid, expired.workspace_id);
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert(err);
            }

            await store.deleteBluemixCredentials(credentials.id);
        });


        it('should update Conversation workspace expiry', async () => {
            const classid = uuid();
            const projectid = uuid();
            const userid = uuid();

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
            };

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : credentials.id,
                created,
                expiry : created,
                language : 'en',
                name : 'DUMMY',
                url : uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, project, classifierInfo);

            const updatedDate = new Date();
            updatedDate.setMonth(updatedDate.getMonth() + 6);
            updatedDate.setMilliseconds(0);

            classifierInfo.expiry = updatedDate;

            await store.updateConversationWorkspaceExpiry(classifierInfo);

            const retrieve = await store.getConversationWorkspace(projectid, classifierInfo.workspace_id);
            assert.deepEqual(retrieve.expiry, updatedDate);
        });


        it('should store and retrieve Conversation classifiers', async () => {
            const classid = uuid();
            const projectid = uuid();

            const before = await store.getConversationWorkspaces(projectid);
            assert.equal(before.length, 0);

            const countBefore = await store.countConversationWorkspaces(classid);
            assert.equal(countBefore, 0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
            };
            const userid = uuid();

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : credentials.id,
                created,
                expiry : created,
                language : 'en',
                name : 'DUMMY',
                url : uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, project, classifierInfo);

            const after = await store.getConversationWorkspaces(projectid);
            assert.equal(after.length, 1);

            const countAfter = await store.countConversationWorkspaces(classid);
            assert.equal(countAfter, 1);


            const retrieved = after[0];

            assert.deepEqual(retrieved, classifierInfo);

            await store.deleteConversationWorkspace(classifierInfo.id);

            const empty = await store.getConversationWorkspaces(projectid);
            assert.equal(empty.length, 0);

            const countEmpty = await store.countConversationWorkspaces(classid);
            assert.equal(countEmpty, 0);
        });

    });



    describe('Image classifiers', () => {

        let setTimeoutStub: sinon.SinonStub;

        before(() => {
            setTimeoutStub = sinon.stub(global, 'setTimeout');
        });
        beforeEach(() => {
            setTimeoutStub.resetHistory();
        });
        after(() => {
            setTimeoutStub.restore();
        });


        function sortClassifiers(a: Types.VisualClassifier, b: Types.VisualClassifier): number {
            if (a.id < b.id) {
                return -1;
            }
            else if (a.id > b.id) {
                return 1;
            }
            return 0;
        }

        it('should retrieve expired classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const now = new Date();
            now.setMilliseconds(0);

            const future = new Date();
            future.setDate(future.getDate() + 1);
            future.setMilliseconds(0);

            const past = new Date();
            past.setDate(past.getDate() - 1);
            past.setMilliseconds(0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'visrec',
                url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
                classid,
            };
            const expired: Types.VisualClassifier = {
                id : uuid(),
                name : 'ONE',
                classifierid : uuid(),
                credentialsid : credentials.id,
                url : 'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' + uuid(),
                created : now,
                expiry : past,
            };
            const current: Types.VisualClassifier = {
                id : uuid(),
                name : 'TWO',
                classifierid : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                created : now,
                expiry : future,
            };

            const alreadyExpired = await store.getExpiredImageClassifiers();

            const projectExpired: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'images',
                name : expired.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };
            const projectCurrent: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'images',
                name : current.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeImageClassifier(credentials, projectExpired, expired);
            await store.storeImageClassifier(credentials, projectCurrent, current);

            const retrievedAll = await store.getImageClassifiers(projectid);
            assert.deepEqual(retrievedAll, [ expired, current ]);

            const retrievedExpired = await store.getExpiredImageClassifiers();
            assert.deepEqual(retrievedExpired.sort(sortClassifiers),
                             alreadyExpired.concat([ expired ]).sort(sortClassifiers));
        });



        it('should delete expired classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const now = new Date();
            now.setMilliseconds(0);

            const past = new Date();
            past.setDate(past.getDate() - 1);
            past.setMilliseconds(0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'visrec',
                url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
                classid,
            };
            await store.storeBluemixCredentials(classid, credentials);

            const expired: Types.VisualClassifier = {
                id : uuid(),
                name : 'ONE',
                classifierid : uuid(),
                credentialsid : credentials.id,
                url : 'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' + uuid(),
                created : now,
                expiry : past,
            };

            const projectExpired: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'images',
                name : expired.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeImageClassifier(credentials, projectExpired, expired);

            const verifyBefore = await store.getImageClassifier(projectid, expired.classifierid);
            assert.deepEqual(verifyBefore, expired);

            const countBefore = await store.getExpiredImageClassifiers();
            assert(countBefore.length >= 0);

            const deleteStub = sinon.stub(request, 'delete').resolves();
            await visualrecog.cleanupExpiredClassifiers();
            assert(deleteStub.called);
            deleteStub.restore();

            assert(setTimeoutStub.called);

            const countAfter = await store.getExpiredImageClassifiers();
            assert.equal(countAfter.length, 0);

            try {
                await store.getImageClassifier(projectid, expired.classifierid);
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert(err);
            }

            await store.deleteBluemixCredentials(credentials.id);
        });


        it('should store and retrieve classifiers', async () => {
            const classid = uuid();
            const projectid = uuid();

            const before = await store.getImageClassifiers(projectid);
            assert.equal(before.length, 0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'visrec',
                url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
                classid,
            };
            const userid = uuid();

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.VisualClassifier = {
                id : uuid(),
                classifierid : randomstring.generate({ length : 32 }),
                credentialsid : credentials.id,
                created,
                expiry : created,
                name : 'DUMMY',
                url : 'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' + uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'images',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeImageClassifier(credentials, project, classifierInfo);

            const after = await store.getImageClassifiers(projectid);
            assert.equal(after.length, 1);


            const retrieved = after[0];

            assert.deepEqual(retrieved, classifierInfo);

            await store.deleteImageClassifier(classifierInfo.id);

            const empty = await store.getImageClassifiers(projectid);
            assert.equal(empty.length, 0);
        });

    });


});
