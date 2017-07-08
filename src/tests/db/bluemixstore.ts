/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as randomstring from 'randomstring';
import * as uuid from 'uuid/v1';

import * as store from '../../lib/db/store';
import * as Types from '../../lib/training/training-types';



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

            await store.storeConversationWorkspace(
                creds, userid, classid, projectid,
                classifierInfo,
            );

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

            await store.storeConversationWorkspace(
                credentials, userid, classid, projectid,
                classifierInfo,
            );

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
