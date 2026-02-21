import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { v1 as uuid } from 'uuid';
import * as Types from '../../lib/db/db-types';
import * as store from '../../lib/db/store';
import * as training from '../../lib/scratchx/training';
import * as requestUtil from '../../lib/utils/request';

const TESTUSER = 'UNIQUEUSERID';
const TESTCLASS = 'UNIQUECLASSIDTRN';


describe('Scratchx - training', () => {

    let numbersTrainingServiceDeleteStub: sinon.SinonStub<any, any>;


    before(async () => {
        numbersTrainingServiceDeleteStub = sinon.stub(requestUtil, 'del').callsFake(stubbedRequestDelete);

        await store.init();
    });

    after(async () => {
        await store.deleteEntireUser(TESTUSER, TESTCLASS);
        numbersTrainingServiceDeleteStub.restore();
        await store.disconnect();
    });


    describe('text projects', () => {

        it('should store text training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'text', 'name', 'en', [], false);
            assert.strictEqual(testProject.name, 'name');
            assert.strictEqual(testProject.classid, TESTCLASS);
            assert.strictEqual(testProject.userid, TESTUSER);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'MYLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await training.storeTrainingData(scratchKey, 'MYLAB', 'Inserted from Scratch');

            const count = await store.countTraining('text', testProject.id);
            assert.strictEqual(count, 1);

            const retrieved = await store.getTextTraining(testProject.id, { start : 0, limit : 10 });
            assert.strictEqual(retrieved[0].textdata, 'Inserted from Scratch');
            assert.strictEqual(retrieved[0].label, 'MYLAB');
        });

        it('should verify that a project exists before storing text training', async () => {
            const type: Types.ProjectTypeLabel = 'text';

            const scratchKey = {
                id : uuid(),
                projectid : uuid(),
                name : 'fakey fake',
                type,
                updated : new Date(),
            };

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', 'wootywootwoot'),
                { message: 'Project not found' }
            );
        });

        it('should require data to store text training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'text', 'name', 'en', [], false);
            assert.strictEqual(testProject.name, 'name');
            assert.strictEqual(testProject.classid, TESTCLASS);
            assert.strictEqual(testProject.userid, TESTUSER);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'MYLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', ' '),
                { message: 'Missing data' }
            );

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', ''),
                { message: 'Missing data' }
            );
        });
    });


    describe('image projects', () => {

        it('should verify that a project exists before storing image training', async () => {
            const type: Types.ProjectTypeLabel = 'images';

            const scratchKey = {
                id : uuid(),
                projectid : uuid(),
                name : 'fakey fake',
                type,
                updated : new Date(),
            };

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', 'wootywootwoot'),
                { message: 'Project not found' }
            );
        });


        it('should require data and a valid label to store image training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'images', 'name', 'en', [], false);
            assert.strictEqual(testProject.name, 'name');
            assert.strictEqual(testProject.classid, TESTCLASS);
            assert.strictEqual(testProject.userid, TESTUSER);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'MYLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', ' '),
                { message: 'Missing data' }
            );

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', ''),
                { message: 'Missing data' }
            );

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'NOTCORRECT', 'valid'),
                { message: 'Invalid label' }
            );
        });

    });


    describe('number projects', () => {

        it('should store number training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'numbers', 'name', 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                { name : 'c', type : 'number' },
            ], false);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'NUMLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await training.storeTrainingData(scratchKey, 'NUMLAB', ['4', '5', '6']);

            const count = await store.countTraining('numbers', testProject.id);
            assert.strictEqual(count, 1);

            const retrieved = await store.getNumberTraining(testProject.id, { start : 0, limit : 10 });
            assert.deepStrictEqual(retrieved[0].numberdata, [4, 5, 6]);
            assert.strictEqual(retrieved[0].label, 'NUMLAB');
        });


        it('should verify that a project exists before storing image training', async () => {
            const type: Types.ProjectTypeLabel = 'numbers';

            const scratchKey = {
                id : uuid(),
                projectid : uuid(),
                name : 'fakey fake',
                type,
                updated : new Date(),
            };

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'MYLAB', 'wootywootwoot'),
                { message: 'Project not found' }
            );
        });


        it('should require data to store number training', async () => {
            const testProject = await store.storeProject(TESTUSER, TESTCLASS, 'numbers', 'name', 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                { name : 'c', type : 'number' },
            ], false);

            await store.addLabelToProject(TESTUSER, TESTCLASS, testProject.id, 'NUMLAB');

            const scratchKeyId = await store.storeUntrainedScratchKey(testProject);
            const scratchKey = await store.getScratchKey(scratchKeyId);

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'NUMLAB', []),
                { message: 'Missing data' }
            );

            await assert.rejects(
                () => training.storeTrainingData(scratchKey, 'NUMLAB', null),
                { message: 'Missing data' }
            );
        });
    });



    const originalRequestDelete = requestUtil.del;
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
