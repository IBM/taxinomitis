/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';
import { v1 as uuid } from 'uuid';
import * as randomstring from 'randomstring';
import * as requestPromise from 'request-promise';
import * as store from '../../lib/db/store';
import * as keys from '../../lib/scratchx/keys';
import * as TrainingTypes from '../../lib/training/training-types';


const TESTCLASS = 'UNIQUECLASSID';


describe('Scratchx - keys', () => {

    let numbersTrainingServiceDeleteStub: sinon.SinonStub<any, any>;


    before(() => {
        // @ts-ignore
        numbersTrainingServiceDeleteStub = sinon.stub(requestPromise, 'delete').callsFake(stubbedRequestDelete);

        return store.init();
    });

    after(() => {
        return store.deleteProjectsByClassId(TESTCLASS)
            .then(() => {
                numbersTrainingServiceDeleteStub.restore();
                return store.disconnect();
            });
    });



    describe('text projects', () => {

        it('should create an empty key for projects without classifiers', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'text', 'test project', 'en', [], false);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.strictEqual(scratchkey.name, project.name);
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
                credstypeid : 2,
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
            assert.strictEqual(key.model, conversationwkspace.workspace_id);
            const scratchkey = await store.getScratchKey(key.id);
            assert.strictEqual(scratchkey.name, project.name);
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
            assert.strictEqual(scratchkey.name, project.name);
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
            assert.strictEqual(project.id, key.model);

            const scratchkey = await store.getScratchKey(key.id);
            assert.strictEqual(scratchkey.name, project.name);
            assert.strictEqual(scratchkey.classifierid, project.id);

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
            assert.strictEqual(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });

    });


    describe('sound projects', () => {

        it('should create an empty key', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'sounds', 'test project', 'en', [], false);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.strictEqual(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });
    });



    const originalRequestDelete = requestPromise.delete;
    const stubbedRequestDelete = (url: string, opts?: any) => {
        if (url === 'undefined/api/models') {
            // no test numbers service available
            return Promise.resolve();
        }
        else {
            // use a real test numbers service
            return originalRequestDelete(url, opts);
        }
    };
});
