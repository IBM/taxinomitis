/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as sinon from 'sinon';

import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';
import * as numbers from '../../lib/training/numbers';


describe('DB store - numbers training', () => {

    let numbersStubDeleteClassifierStub: sinon.SinonStub<any, any>;

    before(() => {
        numbersStubDeleteClassifierStub = sinon.stub(numbers, 'deleteClassifier')
            .callsFake((user: string, classid: string, project: string) => {
                assert(user);
                assert(classid);
                assert(project);
                return Promise.resolve();
            });

        return store.init();
    });
    after(() => {
        numbersStubDeleteClassifierStub.restore();

        return store.disconnect();
    });

    const DEFAULT_PAGING: Objects.PagingOptions = {
        start : 0,
        limit : 50,
    };


    describe('storeNumberTraining', () => {

        it('should store training data', async () => {
            const projectid = uuid();
            const label = uuid();
            const data = [1, 2, 3, 4];

            const training = await store.storeNumberTraining(projectid, false, data, label);
            assert(training);
            assert.strictEqual(training.projectid, projectid);
            assert.deepStrictEqual(training.numberdata, [1, 2, 3, 4]);
            assert.strictEqual(training.label, label);

            return store.deleteTrainingByProjectId('numbers', projectid);
        });

        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
            const label = uuid();

            try {
                await store.storeNumberTraining(projectid, false, data, label);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Number of data items exceeded maximum');
                return;
            }
            assert.fail('Failed to reject training');
        });
    });



    describe('deleteNumberTraining', () => {

        it('should delete training data', async () => {
            const projectid = uuid();
            const data = [1, 2, 3];
            const label = uuid();

            const training = await store.storeNumberTraining(projectid, false, data, label);
            assert(training);

            let retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 1);

            const before = await store.countTraining('numbers', projectid);
            assert.strictEqual(before, 1);

            await store.deleteTrainingByProjectId('numbers', projectid);

            retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 0);

            const count = await store.countTraining('numbers', projectid);
            assert.strictEqual(count, 0);
        });


        function wait() {
            return new Promise((resolve) => setTimeout(resolve, 3000));
        }


        it('should delete training by label', async () => {
            const userid = uuid();
            const classid = 'UNIQUECLASSID';

            const project = await store.storeProject(
                userid, classid,
                'numbers',
                'project name',
                'en',
                [
                    { name : 'first', type : 'number' }, { name : 'second', type : 'number' },
                    { name : 'third', type : 'number' },
                ],
                false);


            await store.addLabelToProject(userid, classid, project.id, 'TENS');
            await store.addLabelToProject(userid, classid, project.id, 'HUNDREDS');
            await store.addLabelToProject(userid, classid, project.id, 'THOUSANDS');

            store.storeNumberTraining(project.id, false, [1000, 2000, 3000], 'THOUSANDS');
            store.storeNumberTraining(project.id, false, [10, 20, 30], 'TENS');
            store.storeNumberTraining(project.id, false, [100, 300, 500], 'HUNDREDS');
            store.storeNumberTraining(project.id, false, [50, 60, 70], 'TENS');
            store.storeNumberTraining(project.id, false, [200, 300, 400], 'HUNDREDS');
            store.storeNumberTraining(project.id, false, [20, 40, 60], 'TENS');

            await wait();

            let counts = await store.countTrainingByLabel(project);
            assert.deepStrictEqual(counts, { TENS : 3, HUNDREDS : 2, THOUSANDS : 1 });

            const labels = await store.removeLabelFromProject(userid, classid, project.id, 'HUNDREDS');
            assert.deepStrictEqual(labels, ['TENS', 'THOUSANDS']);

            const updated = await store.getProject(project.id);
            assert(updated);
            if (updated) {
                assert.deepStrictEqual(updated.labels, ['TENS', 'THOUSANDS']);
            }

            counts = await store.countTrainingByLabel(project);
            assert.deepStrictEqual(counts, { TENS : 3, THOUSANDS : 1 });

            await store.deleteEntireProject(userid, classid, project);
        });
    });


    describe('getNumberTraining', () => {

        it('should retrieve training data', async () => {
            const projectid = uuid();
            const data = [1, 3, 5];
            const label = uuid();

            const training = await store.storeNumberTraining(projectid, false, data, label);
            assert(training);

            const retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 1);
            assert.strictEqual(retrieved[0].id, training.id);
            assert.deepStrictEqual(retrieved[0].numberdata, [1, 3, 5]);
            assert.strictEqual(retrieved[0].label, label);

            return store.deleteTrainingByProjectId('text', projectid);
        });


        async function createTestData(projectid: string, numLabels: number, numText: number) {
            const testdata = [];
            const labels = [];

            for (let labelIdx = 0; labelIdx < numLabels; labelIdx++) {
                const label = uuid();
                labels.push(label);

                for (let text = 0; text < numText; text++) {
                    const numberdata = [ labelIdx, text ];

                    testdata.push({ numberdata, label });
                }
            }

            await store.bulkStoreNumberTraining(projectid, testdata);
            return labels;
        }


        it('should fetch specific amount of training data', async () => {
            const projectid = uuid();

            await createTestData(projectid, 6, 9);

            let retrieved = await store.getNumberTraining(projectid, { start : 0, limit : 2 });
            assert.strictEqual(retrieved.length, 2);

            retrieved = await store.getNumberTraining(projectid, { start : 0, limit : 6 });
            assert.strictEqual(retrieved.length, 6);

            retrieved = await store.getNumberTraining(projectid, { start : 0, limit : 52 });
            assert.strictEqual(retrieved.length, 52);

            retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 50);

            return store.deleteTrainingByProjectId('numbers', projectid);
        });


        it('should count training data', async () => {
            const projectid = uuid();
            let count = await store.countTraining('numbers', projectid);
            assert.strictEqual(count, 0);

            const data = [];

            for (let labelIdx = 0; labelIdx < 6; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 7; text++) {
                    const numberdata = [labelIdx, text];

                    data.push({ numberdata, label });
                }
            }

            await store.bulkStoreNumberTraining(projectid, data);

            count = await store.countTraining('numbers', projectid);
            assert.strictEqual(count, 42);

            return store.deleteTrainingByProjectId('numbers', projectid);
        });
    });

});
