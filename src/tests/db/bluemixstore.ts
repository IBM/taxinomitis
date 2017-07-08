/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as uuid from 'uuid/v1';

import * as store from '../../lib/db/store';
import * as conversation from '../../lib/training/conversation';
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

        it('should store and retrieve Bluemix credentials', async () => {
            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
            };
            const classid = uuid();

            await store.storeBluemixCredentials(classid, creds);

            const retrieved = await store.getBluemixCredentials(classid, 'conv');
            assert.deepEqual(retrieved, [ creds ]);

            await store.deleteBluemixCredentials(creds.id);
        });

        it('should throw an error when fetching non-existent credentials', async () => {
            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
            };
            const classid = uuid();

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
                labels : ['a'],
                fields : [],
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
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
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
                labels : ['a'],
                fields : [],
            };
            const projectCurrent: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : current.name,
                labels : ['a'],
                fields : [],
            };

            await store.storeConversationWorkspace(credentials, projectExpired, expired);
            await store.storeConversationWorkspace(credentials, projectCurrent, current);

            const retrievedAll = await store.getConversationWorkspaces(projectid);
            assert.deepEqual(retrievedAll, [ expired, current ]);

            const retrievedExpired = await store.getExpiredConversationWorkspaces();
            assert.deepEqual(retrievedExpired, alreadyExpired.concat([ expired ]));
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
                servicetype : 'conv',
                url : uuid(),
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
                labels : ['a'],
                fields : [],
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


        it('should store and retrieve Conversation classifiers', async () => {
            const classid = uuid();
            const projectid = uuid();

            const before = await store.getConversationWorkspaces(projectid);
            assert.equal(before.length, 0);

            const countBefore = await store.countConversationWorkspaces(classid);
            assert.equal(countBefore, 0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'conv',
                url : uuid(),
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
                labels : ['a'],
                fields : [],
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

});
