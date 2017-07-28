/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';

import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as Types from '../../lib/training/training-types';
import * as conversation from '../../lib/training/conversation';

import * as request from 'request-promise';


describe('ScratchKeys store', () => {

    let project: DbTypes.Project;

    const reusedUserid = uuid();
    const reusedClassid = uuid();

    before(() => {
        return store.init();
    });
    beforeEach(async () => {
        project = await store.storeProject(
            reusedUserid, reusedClassid, 'text', randomstring.generate({ length : 20 }), [],
        );
    });
    after(() => {
        return store.disconnect();
    });
    afterEach(() => {
        return store.deleteEntireProject(reusedUserid, reusedClassid, project);
    });


    it('should create an empty scratch key', async () => {
        const keyid = await store.storeUntrainedScratchKey(project);
        assert(keyid);

        return store.deleteScratchKey(keyid);
    });


    it('should retrieve an empty scratch key', async () => {
        const keyid = await store.storeUntrainedScratchKey(project);

        const retrieved = await store.getScratchKey(keyid);
        assert.equal(retrieved.name, project.name);
        assert(!retrieved.classifierid);
        assert(!retrieved.credentials);

        return store.deleteScratchKey(keyid);
    });


    it('should update an empty scratch key', async () => {
        const keyid = await store.storeUntrainedScratchKey(project);

        const retrievedEmpty: any = await store.getScratchKey(keyid);
        assert.equal(retrievedEmpty.name, project.name);
        assert(!retrievedEmpty.classifierid);
        assert(!retrievedEmpty.credentials);

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        await store.storeOrUpdateScratchKey(project, credentials, classifierid);

        const retrievedAfter: any = await store.getScratchKey(keyid);
        delete credentials.id;
        delete retrievedAfter.credentials.id;

        assert.equal(retrievedAfter.id, keyid);
        assert.equal(retrievedAfter.name, project.name);
        assert.equal(retrievedAfter.type, 'text');
        assert.deepEqual(retrievedAfter.credentials, credentials);
        assert.equal(retrievedAfter.classifierid, classifierid);
    });


    it('should delete an empty scratch key', async () => {
        const keyid = await store.storeUntrainedScratchKey(project);

        const retrieved: any = await store.getScratchKey(keyid);
        assert(retrieved);
        assert(retrieved.name);

        await store.deleteScratchKey(keyid);

        try {
            await store.getScratchKey(keyid);

            assert.fail(1, 0, 'Should not have been able to retrieve a key', '');
        }
        catch (err) {
            assert.equal(err.message, 'Unexpected response when retrieving credentials for Scratch');
        }
    });



    it('should create a scratch key', async () => {
        const credentials: Types.BluemixCredentials = {
            id : uuid(),
            servicetype : 'conv',
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
        );

        return store.deleteScratchKey(keyid);
    });



    it('should retrieve a scratch key', async () => {
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
        );

        const retrieved: any = await store.getScratchKey(keyid);
        delete credentials.id;
        delete retrieved.credentials.id;

        assert.equal(retrieved.id, keyid);
        assert.equal(retrieved.name, project.name);
        assert.equal(retrieved.type, project.type);
        assert.deepEqual(retrieved.credentials, credentials);
        assert.equal(retrieved.classifierid, classifierid);
    });


    it('should find a scratch key for a project', async () => {
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
        );

        const response: any[] = await store.findScratchKeys(project.userid, project.id, project.classid);
        assert.equal(response.length, 1);
        const retrieved = response[0];

        delete credentials.id;
        delete retrieved.credentials.id;

        assert.equal(retrieved.id, keyid);
        assert.equal(retrieved.name, project.name);
        assert.equal(retrieved.type, project.type);
        assert.deepEqual(retrieved.credentials, credentials);
        assert.equal(retrieved.classifierid, classifierid);

        return store.deleteScratchKey(keyid);
    });

    it('should find scratch keys for a project', async () => {
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifieridA = randomstring.generate({ length : 12 });
        const classifieridB = randomstring.generate({ length : 11 });
        const classifieridC = randomstring.generate({ length : 10 });
        const classifieridD = randomstring.generate({ length : 9 });

        const classifierIDs = [ classifieridA, classifieridB, classifieridC, classifieridD ];

        for (const classifierid of classifierIDs) {
            await store.storeScratchKey(project, credentials, classifierid);
        }

        const response: any[] = await store.findScratchKeys(project.userid, project.id, project.classid);
        assert.equal(response.length, classifierIDs.length);

        delete credentials.id;

        for (const retrieved of response) {
            delete retrieved.credentials.id;

            assert.equal(retrieved.name, project.name);
            assert.equal(retrieved.type, project.type);
            assert.deepEqual(retrieved.credentials, credentials);

            assert(classifierIDs.indexOf(retrieved.classifierid) >= 0);
        }
    });



    it('should update a scratch key', async () => {
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
        );

        const newClassifierId = randomstring.generate({ length : 11 });

        const updatedKeyId = await store.storeOrUpdateScratchKey(
            project,
            credentials, newClassifierId,
        );

        assert.equal(updatedKeyId, keyid);

        const retrieved: any = await store.getScratchKey(keyid);

        delete credentials.id;
        delete retrieved.credentials.id;

        assert.equal(retrieved.name, project.name);
        assert.equal(retrieved.type, project.type);
        assert.deepEqual(retrieved.credentials, credentials);

        assert.equal(retrieved.classifierid, newClassifierId);
    });


    it('should delete a scratch key', async () => {
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
        );

        await store.deleteScratchKey(keyid);

        try {
            await store.getScratchKey(keyid);

            assert.fail(1, 0, 'Should not have been able to retrieve a key', '');
        }
        catch (err) {
            assert.equal(err.message, 'Unexpected response when retrieving credentials for Scratch');
        }
    });


    it('should delete keys by projectid', async () => {
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
        );

        await store.deleteScratchKeysByProjectId(project.id);

        try {
            await store.getScratchKey(keyid);

            assert.fail(1, 0, 'Should not have been able to retrieve a key', '');
        }
        catch (err) {
            assert.equal(err.message, 'Unexpected response when retrieving credentials for Scratch');
        }
    });


    it('should reset expired scratch keys', async () => {
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
        await store.storeBluemixCredentials(project.classid, credentials);

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

        await store.storeConversationWorkspace(credentials, project, expired);

        const scratchKey: string = await store.storeOrUpdateScratchKey(
            project,
            credentials, expired.workspace_id,
        );

        const verifyBefore = await store.getScratchKey(scratchKey);
        assert.equal(verifyBefore.classifierid, expired.workspace_id);
        assert.equal(verifyBefore.credentials.username, credentials.username);
        assert.equal(verifyBefore.credentials.password, credentials.password);

        const deleteStub = sinon.stub(request, 'delete').resolves();
        await conversation.cleanupExpiredClassifiers();
        assert(deleteStub.called);
        deleteStub.restore();

        const verifyAfter = await store.getScratchKey(scratchKey);
        assert(!verifyAfter.classifierid);
        assert(!verifyAfter.credentials);

        await store.deleteBluemixCredentials(credentials.id);
        await store.deleteScratchKey(scratchKey);
    });

});
