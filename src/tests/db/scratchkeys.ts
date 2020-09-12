/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
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
            reusedUserid, reusedClassid, 'text', randomstring.generate({ length : 20 }), 'en', [], false,
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
        assert.strictEqual(retrieved.name, project.name);
        assert(!retrieved.classifierid);
        assert(!retrieved.credentials);

        return store.deleteScratchKey(keyid);
    });


    it('should tolerate storing keys with missing values', async () => {
        const mockProject: DbTypes.Project = {
            id : uuid(),
            userid : uuid(),
            classid : uuid(),
            type : 'text',
            name : uuid(),
            labels : [],
            language : 'en',
            numfields : 0,
            isCrowdSourced : false,
        };
        const creds: Types.BluemixCredentials = {} as Types.BluemixCredentials;
        const keyid = await store.storeScratchKey(mockProject, creds, uuid(), new Date());

        assert(keyid);
    });


    it('should update an empty scratch key', async () => {
        const keyid = await store.storeUntrainedScratchKey(project);

        const retrievedEmpty: any = await store.getScratchKey(keyid);
        assert.strictEqual(retrievedEmpty.name, project.name);
        assert(!retrievedEmpty.classifierid);
        assert(!retrievedEmpty.credentials);

        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });

        const ts = new Date(2018, 5, 30, 1, 2, 3);

        await store.storeOrUpdateScratchKey(project, credentials, classifierid, ts);

        const retrievedAfter: any = await store.getScratchKey(keyid);

        assert.strictEqual(retrievedAfter.id, keyid);
        assert.strictEqual(retrievedAfter.name, project.name);
        assert.strictEqual(retrievedAfter.type, 'text');
        assert.strictEqual(retrievedAfter.classifierid, classifierid);
        assert.strictEqual(retrievedAfter.updated.getTime(), ts.getTime());

        const credsWithoutId = Object.assign({}, credentials, { id : 'id' });
        const retrievedCredsWithoutId = Object.assign({}, retrievedAfter.credentials, { id : 'id' });
        assert.deepStrictEqual(retrievedCredsWithoutId, credsWithoutId);
    });


    it('should delete an empty scratch key', async () => {
        const keyid = await store.storeUntrainedScratchKey(project);

        const retrieved: any = await store.getScratchKey(keyid);
        assert(retrieved);
        assert(retrieved.name);

        await store.deleteScratchKey(keyid);

        try {
            await store.getScratchKey(keyid);

            assert.fail('Should not have been able to retrieve a key');
        }
        catch (err) {
            assert.strictEqual(err.message, 'Unexpected response when retrieving credentials for Scratch');
        }
    });



    it('should create a scratch key', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';
        const servicetype: Types.BluemixServiceType = 'conv';

        const credentials = {
            id : uuid(),
            servicetype,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid, new Date(),
        );

        return store.deleteScratchKey(keyid);
    });



    it('should retrieve a scratch key', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });
        const ts = new Date(2018, 3, 2, 1, 15, 12);

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid, ts,
        );

        const retrieved: any = await store.getScratchKey(keyid);

        assert.strictEqual(retrieved.id, keyid);
        assert.strictEqual(retrieved.name, project.name);
        assert.strictEqual(retrieved.type, project.type);
        assert.strictEqual(retrieved.classifierid, classifierid);
        assert.strictEqual(retrieved.updated.getTime(), ts.getTime());

        const credsWithoutId = Object.assign({}, credentials, { id : 'id' });
        const retrievedCredsWithoutId = Object.assign({}, retrieved.credentials, { id : 'id' });
        assert.deepStrictEqual(retrievedCredsWithoutId, credsWithoutId);
    });


    it('should find a scratch key for a project', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });
        const ts = new Date(2018, 3, 18, 3, 10, 0);

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid, ts,
        );

        const response: any[] = await store.findScratchKeys(project.userid, project.id, project.classid);
        assert.strictEqual(response.length, 1);
        const retrieved = response[0];

        assert.strictEqual(retrieved.id, keyid);
        assert.strictEqual(retrieved.name, project.name);
        assert.strictEqual(retrieved.type, project.type);
        assert.strictEqual(retrieved.classifierid, classifierid);
        assert.strictEqual(retrieved.updated.getTime(), ts.getTime());

        const credsWithoutId = Object.assign({}, credentials, { id : 'id' });
        const retrievedCredsWithoutId = Object.assign({}, retrieved.credentials, { id : 'id' });
        assert.deepStrictEqual(retrievedCredsWithoutId, credsWithoutId);

        return store.deleteScratchKey(keyid);
    });

    it('should find scratch keys for a project', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifieridA = randomstring.generate({ length : 12 });
        const classifieridB = randomstring.generate({ length : 11 });
        const classifieridC = randomstring.generate({ length : 10 });
        const classifieridD = randomstring.generate({ length : 9 });

        const classifierIDs = [ classifieridA, classifieridB, classifieridC, classifieridD ];

        const ts = new Date(2018, 1, 1, 1, 1, 1);

        for (const classifierid of classifierIDs) {
            await store.storeScratchKey(project, credentials, classifierid, ts);
        }

        const response: any[] = await store.findScratchKeys(project.userid, project.id, project.classid);
        assert.strictEqual(response.length, classifierIDs.length);

        const credsWithoutId = Object.assign({}, credentials, { id : 'id' });


        for (const retrieved of response) {
            delete retrieved.credentials.id;

            assert.strictEqual(retrieved.name, project.name);
            assert.strictEqual(retrieved.type, project.type);
            assert.strictEqual(retrieved.updated.getTime(), ts.getTime());

            assert(classifierIDs.indexOf(retrieved.classifierid) >= 0);

            const retrievedCredsWithoutId = Object.assign({}, retrieved.credentials, { id : 'id' });
            assert.deepStrictEqual(retrievedCredsWithoutId, credsWithoutId);
        }
    });



    it('should update a scratch key', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });

        const before = new Date(2018, 1, 1, 0, 0, 0);

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid, before,
        );

        const newClassifierId = randomstring.generate({ length : 11 });

        const after = new Date(2018, 2, 2, 0, 0, 0);

        const updatedKeyId = await store.storeOrUpdateScratchKey(
            project,
            credentials, newClassifierId, after,
        );

        assert.strictEqual(updatedKeyId, keyid);

        const retrieved: any = await store.getScratchKey(keyid);

        assert.strictEqual(retrieved.name, project.name);
        assert.strictEqual(retrieved.type, project.type);

        assert.strictEqual(retrieved.classifierid, newClassifierId);
        assert.strictEqual(retrieved.updated.getTime(), after.getTime());

        const credsWithoutId = Object.assign({}, credentials, { id : 'id' });
        const retrievedCredsWithoutId = Object.assign({}, retrieved.credentials, { id : 'id' });
        assert.deepStrictEqual(retrievedCredsWithoutId, credsWithoutId);
    });


    it('should delete a scratch key', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });
        const ts = new Date();

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid, ts,
        );

        await store.deleteScratchKey(keyid);

        try {
            await store.getScratchKey(keyid);

            assert.fail('Should not have been able to retrieve a key');
        }
        catch (err) {
            assert.strictEqual(err.message, 'Unexpected response when retrieving credentials for Scratch');
        }
    });


    it('should delete keys by projectid', async () => {
        const credstype: Types.BluemixCredentialsTypeLabel = 'unknown';

        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
            classid : reusedClassid,
            credstype,
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project,
            credentials, classifierid,
            new Date(),
        );

        await store.deleteScratchKeysByProjectId(project.id);

        try {
            await store.getScratchKey(keyid);

            assert.fail('Should not have been able to retrieve a key');
        }
        catch (err) {
            assert.strictEqual(err.message, 'Unexpected response when retrieving credentials for Scratch');
        }
    });


    it('should reset expired scratch keys', async () => {
        const now = new Date();
        now.setMilliseconds(0);

        const past = new Date();
        past.setDate(past.getDate() - 1);
        past.setMilliseconds(0);

        const credentialsInfo: Types.BluemixCredentialsDbRow = {
            id : uuid(),
            username : randomstring.generate(36),
            password : randomstring.generate(12),
            servicetype : 'conv',
            url : uuid(),
            classid : reusedClassid,
            credstypeid : 1,
        };
        const credentials = await store.storeBluemixCredentials(project.classid, credentialsInfo);

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
            credentials, expired.workspace_id, now,
        );

        const verifyBefore = await store.getScratchKey(scratchKey);
        assert.strictEqual(verifyBefore.classifierid, expired.workspace_id);
        assert(verifyBefore.credentials);
        if (verifyBefore.credentials) {
            assert.strictEqual(verifyBefore.credentials.username, credentials.username);
            assert.strictEqual(verifyBefore.credentials.password, credentials.password);
        }

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
