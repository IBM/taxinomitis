/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as Types from '../../lib/training/training-types';



describe('ScratchKeys store', () => {

    let project: DbTypes.Project;

    const reusedUserid = uuid();
    const reusedClassid = uuid();

    before(async () => {
        await store.init();

        project = await store.storeProject(
            reusedUserid, reusedClassid, 'text', randomstring.generate({ length : 20 }), [],
        );
    });
    after(async () => {
        await store.deleteEntireProject(reusedUserid, reusedClassid, project);
        return store.disconnect();
    });


    it('should create an empty scratch key', async () => {
        const projectid = uuid();
        const projectname = randomstring.generate({ length : 20 });
        const userid = uuid();
        const classid = uuid();
        const keyid = await store.storeUntrainedScratchKey(
            projectid, projectname, 'text',
            userid, classid);

        return store.deleteScratchKey(keyid);
    });


    it('should retrieve an empty scratch key', async () => {
        const projectid = uuid();
        const projectname = randomstring.generate({ length : 20 });
        const userid = uuid();
        const classid = uuid();
        const keyid = await store.storeUntrainedScratchKey(
            projectid, projectname, 'text',
            userid, classid);

        const retrieved = await store.getScratchKey(keyid);
        assert.equal(retrieved.name, projectname);
        assert(!retrieved.classifierid);
        assert(!retrieved.credentials);

        return store.deleteScratchKey(keyid);
    });


    it('should update an empty scratch key', async () => {
        const userid = uuid();
        const classid = uuid();
        const projectid = uuid();
        const projectname = randomstring.generate({ length : 20 });

        const keyid = await store.storeUntrainedScratchKey(
            projectid, projectname, 'text',
            userid, classid);

        const retrievedEmpty: any = await store.getScratchKey(keyid);
        assert.equal(retrievedEmpty.name, projectname);
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

        await store.storeOrUpdateScratchKey(
            projectid, 'text', userid, classid,
            credentials, classifierid);

        const retrievedAfter: any = await store.getScratchKey(keyid);
        delete credentials.id;
        delete retrievedAfter.credentials.id;

        assert.equal(retrievedAfter.id, keyid);
        assert.equal(retrievedAfter.name, projectname);
        assert.equal(retrievedAfter.type, 'text');
        assert.deepEqual(retrievedAfter.credentials, credentials);
        assert.equal(retrievedAfter.classifierid, classifierid);

        return store.deleteScratchKey(keyid);
    });


    it('should delete an empty scratch key', async () => {
        const projectid = uuid();
        const projectname = randomstring.generate({ length : 20 });
        const userid = uuid();
        const classid = uuid();

        const keyid = await store.storeUntrainedScratchKey(
            projectid, projectname, 'text',
            userid, classid);

        const retrieved: any = await store.getScratchKey(keyid);
        assert(retrieved);
        assert(retrieved.name);

        await store.deleteScratchKey(keyid);

        try {
            await store.getScratchKey(keyid);

            assert.fail(1, 0, 'Should not have been able to retrieve a key', '');
        }
        catch (err) {
            assert.equal(err.message, 'Unexpected response when retrieving service credentials');
        }
    });



    it('should create a scratch key', async () => {
        const userid = uuid();
        const classid = uuid();
        const credentials: Types.BluemixCredentials = {
            id : uuid(),
            servicetype : 'conv',
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
            credentials, classifierid,
        );

        return store.deleteScratchKey(keyid);
    });



    it('should retrieve a scratch key', async () => {
        const userid = uuid();
        const classid = uuid();
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
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
        const userid = uuid();
        const classid = uuid();
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
            credentials, classifierid,
        );

        const response: any[] = await store.findScratchKeys(userid, project.id, classid);
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
        const userid = uuid();
        const classid = uuid();
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
            await store.storeScratchKey(
                project.id, project.name, project.type,
                userid, classid,
                credentials, classifierid,
            );
        }

        const response: any[] = await store.findScratchKeys(userid, project.id, classid);
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
        const userid = uuid();
        const classid = uuid();
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
            credentials, classifierid,
        );

        const newClassifierId = randomstring.generate({ length : 11 });

        const updatedKeyId = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
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
        const userid = uuid();
        const classid = uuid();
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
            credentials, classifierid,
        );

        await store.deleteScratchKey(keyid);

        try {
            await store.getScratchKey(keyid);

            assert.fail(1, 0, 'Should not have been able to retrieve a key', '');
        }
        catch (err) {
            assert.equal(err.message, 'Unexpected response when retrieving service credentials');
        }
    });


    it('should delete keys by projectid', async () => {
        const userid = uuid();
        const classid = uuid();
        const credentials = {
            id : uuid(),
            servicetype : 'conv' as Types.BluemixServiceType,
            username : randomstring.generate({ length : 10 }),
            password : randomstring.generate({ length : 20 }),
            url : uuid(),
        };
        const classifierid = randomstring.generate({ length : 12 });

        const keyid = await store.storeOrUpdateScratchKey(
            project.id, project.type,
            userid, classid,
            credentials, classifierid,
        );

        await store.deleteScratchKeysByProjectId(project.id);

        try {
            await store.getScratchKey(keyid);

            assert.fail(1, 0, 'Should not have been able to retrieve a key', '');
        }
        catch (err) {
            assert.equal(err.message, 'Unexpected response when retrieving service credentials');
        }
    });

});
