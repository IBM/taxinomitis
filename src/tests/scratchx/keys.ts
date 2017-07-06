/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
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
            const project = await store.storeProject(uuid(), TESTCLASS, 'text', 'test project', []);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });


        it('should create an empty key for projects with classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', []);
            const creds = await store.storeBluemixCredentials(TESTCLASS, {
                id : uuid(),
                username : 'user',
                password : 'pass',
                servicetype : 'conv',
                url : 'http://url.com',
            });
            const conversationwkspace: TrainingTypes.ConversationWorkspace = {
                workspace_id: randomstring.generate({ length : 20 }),
                created: new Date(),
                language : 'en',
                name : project.name,
                url : 'url',
            };
            await store.storeConversationWorkspace(creds, userid, TESTCLASS, project.id, conversationwkspace);

            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(key.model);
            assert.equal(key.model, conversationwkspace.workspace_id);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
            await store.deleteConversationWorkspace(project.id, userid, TESTCLASS, conversationwkspace.workspace_id);
            await store.deleteBluemixCredentials(creds.id);
        });


    });


    describe('numbers projects', () => {

        it('should create an empty key', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'numbers', 'test project', ['one', 'two']);
            const key = await keys.createKey(project.id);
            assert(key.id);
            assert(!key.model);
            const scratchkey = await store.getScratchKey(key.id);
            assert.equal(scratchkey.name, project.name);
            await store.deleteScratchKey(key.id);
        });

    });


    describe('images projects', () => {

        it('should return an error status', async () => {
            const project = await store.storeProject(uuid(), TESTCLASS, 'images', 'test project', []);

            try {
                await keys.createKey(project.id);
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Not implemented yet');
            }
        });
    });


});
