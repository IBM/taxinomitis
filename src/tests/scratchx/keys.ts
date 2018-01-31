/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';
import * as store from '../../lib/db/store';
import * as conversation from '../../lib/training/conversation';
import * as status from '../../lib/scratchx/status';
import * as keys from '../../lib/scratchx/keys';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';


const TESTCLASS = 'UNIQUECLASSID';


describe('Scratchx - keys', () => {


    before(() => {
        return store.init();
    });

    after(async () => {
        await store.deleteProjectsByClassId(TESTCLASS);
        return store.disconnect();
    });



    describe('text projects', () => {

        it('should create an empty key for projects without classifiers', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'text', 'test project', 'en', [], false);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });


        it('should create an empty key for projects with classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', 'en', [], false);
            const creds = await store.storeBluemixCredentials(TESTCLASS, {
                id : uuid(),
                username : 'user',
                password : 'pass',
                servicetype : 'conv',
                url : 'http://url.com',
                classid : TESTCLASS,
            });
            const conversationwkspace: TrainingTypes.ConversationWorkspace = {
                id : uuid(),
                workspace_id: randomstring.generate({ length : 20 }),
                credentialsid : creds.id,
                created: new Date(),
                expiry: new Date(),
                language : 'en',
                name : project.name,
                url : 'url',
            };
            await store.storeConversationWorkspace(creds, project, conversationwkspace);

            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(key.model);
            assert.equal(key.model, conversationwkspace.workspace_id);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
            await store.deleteConversationWorkspace(conversationwkspace.id);
            await store.deleteBluemixCredentials(creds.id);
        });
    });


    describe('numbers projects', () => {

        it('should create an empty key', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'numbers', 'test project', 'en', [
                { name : 'one', type : 'number' }, { name : 'two', type : 'number' },
            ], false);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });


        it('should create a key for projects with a classifier', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'numbers', 'test project', 'en', [
                { name : 'a', type : 'number' },
            ], false);

            await store.storeNumbersClassifier(userid, TESTCLASS, project.id, 'Available');

            const key = await keys.createKey(project.id);
            assert(key.id);
            assert.equal(project.id, key.model);

            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            assert.equal(scratchkey.classifierid, project.id);

            await store.deleteEntireProject(userid, TESTCLASS, project);
        });
    });




    describe('images projects', () => {

        it('should create an empty key for projects without classifiers', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'images', 'images project', 'en', [], false);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });


        it('should create an empty key for projects with classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'images', 'images project', 'en', [], false);
            const creds = await store.storeBluemixCredentials(TESTCLASS, {
                id : uuid(),
                username : 'user',
                password : 'pass',
                servicetype : 'visrec',
                url : 'http://url.com',
                classid : TESTCLASS,
            });
            const visualclassifier: TrainingTypes.VisualClassifier = {
                id : uuid(),
                classifierid: randomstring.generate({ length : 20 }),
                credentialsid : creds.id,
                created: new Date(),
                expiry: new Date(),
                name : project.name,
                url : 'url',
            };
            await store.storeImageClassifier(creds, project, visualclassifier);

            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(key.model);
            assert.equal(key.model, visualclassifier.classifierid);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
            await store.deleteImageClassifier(visualclassifier.id);
            await store.deleteBluemixCredentials(creds.id);
        });
    });

});
