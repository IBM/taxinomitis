/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as randomstring from 'randomstring';
import * as store from '../../lib/db/store';
import * as training from '../../lib/scratchx/training';

const TESTUSER = 'UNIQUEUSERID';
const TESTCLASS = 'UNIQUECLASSID';


describe('Scratchx - keys', () => {

    before(() => {
        return store.init();
    });

    after(async () => {
        await store.deleteEntireUser(TESTUSER, TESTCLASS);
        return store.disconnect();
    });


    describe('image projects', () => {
        it('not implemented yet', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'images', 'name', []);

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            try {
                await training.storeTrainingData(scratchKey, 'LABEL', 'DATA');
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Not implemented yet');
            }
        });
    });


    describe('text projects', () => {

        it('should store text training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'text', 'name', []);
            assert.equal(testProject.name, 'name');
            assert.equal(testProject.classid, TESTCLASS);
            assert.equal(testProject.userid, TESTUSER);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'MYLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await training.storeTrainingData(scratchKey, 'MYLAB', 'Inserted from Scratch');

            const count = await store.countTraining('text', testProject.id);
            assert.equal(count, 1);

            const retrieved = await store.getTextTraining(testProject.id, { start : 0, limit : 10 });
            assert.equal(retrieved[0].textdata, 'Inserted from Scratch');
            assert.equal(retrieved[0].label, 'MYLAB');
        });

        it('should require data to store text training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'text', 'name', []);
            assert.equal(testProject.name, 'name');
            assert.equal(testProject.classid, TESTCLASS);
            assert.equal(testProject.userid, TESTUSER);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'MYLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            try {
                await training.storeTrainingData(scratchKey, 'MYLAB', ' ');
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }

            try {
                await training.storeTrainingData(scratchKey, 'MYLAB', '');
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }

        });
    });


    describe('number projects', () => {

        it('should store number training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'numbers', 'name', ['a', 'b', 'c']);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'NUMLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await training.storeTrainingData(scratchKey, 'NUMLAB', ['4', '5', '6']);

            const count = await store.countTraining('numbers', testProject.id);
            assert.equal(count, 1);

            const retrieved = await store.getNumberTraining(testProject.id, { start : 0, limit : 10 });
            assert.deepEqual(retrieved[0].numberdata, [4, 5, 6]);
            assert.equal(retrieved[0].label, 'NUMLAB');
        });


        it('should require data to store number training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'numbers', 'name', ['a', 'b', 'c']);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'NUMLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            try {
                await training.storeTrainingData(scratchKey, 'NUMLAB', []);
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }

            try {
                await training.storeTrainingData(scratchKey, 'NUMLAB', null);
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }
        });
    });
});
