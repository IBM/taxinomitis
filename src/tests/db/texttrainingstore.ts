/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as randomstring from 'randomstring';

import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';


describe('DB store - text training', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });

    const DEFAULT_PAGING: Objects.PagingOptions = {
        start : 0,
        limit : 50,
    };


    describe('storeTextTraining', () => {

        it('should store training data', async () => {
            const projectid = uuid();
            const text = uuid();
            const label = uuid();

            const training = await store.storeTextTraining(projectid, text, label);
            assert(training);
            assert.strictEqual(training.projectid, projectid);
            assert.strictEqual(training.textdata, text);
            assert.strictEqual(training.label, label);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        it('should reject empty strings', async () => {
            const projectid = uuid();
            const text = '     ';
            const label = uuid();

            try {
                await store.storeTextTraining(projectid, text, label);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert(err);
                assert.strictEqual(err.message, 'Empty text is not allowed');

                const count = await store.countTraining('text', projectid);
                assert.strictEqual(count, 0);
            }
        });

        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const text = randomstring.generate({ length : 1200 });
            const label = uuid();

            try {
                await store.storeTextTraining(projectid, text, label);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert(err);
                assert.strictEqual(err.message, 'Text exceeds maximum allowed length (1024 characters)');

                const count = await store.countTraining('text', projectid);
                assert.strictEqual(count, 0);
            }
        });
    });



    describe('getUniqueTrainingTextsByLabel', () => {
        it('should fetch training without duplicates', async () => {
            const projectid = uuid();
            const label = uuid();

            await store.storeTextTraining(projectid, 'FIRST', label);
            await store.storeTextTraining(projectid, 'SECOND', label);
            await store.storeTextTraining(projectid, 'THIRD', label);
            await store.storeTextTraining(projectid, 'FIRST', label);
            await store.storeTextTraining(projectid, 'FOURTH', label);

            const retrieved = await store.getUniqueTrainingTextsByLabel(projectid, label, { start: 0, limit : 10 });
            assert.deepStrictEqual(retrieved.sort(), ['FIRST', 'SECOND', 'THIRD', 'FOURTH'].sort());

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });



    describe('deleteTextTraining', () => {

        it('should delete training data', async () => {
            const projectid = uuid();
            const text = uuid();
            const label = uuid();

            const training = await store.storeTextTraining(projectid, text, label);
            assert(training);

            let retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 1);

            await store.deleteTrainingByProjectId('text', projectid);

            retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 0);
        });
    });



    describe('bulkStoreTextTraining', () => {

        it('should store multiple rows', async () => {
            const projectid = uuid();
            const data = [];

            let retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 0);

            for (let labelIdx = 0; labelIdx < 5; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 25);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        it('should count training data', async () => {
            const projectid = uuid();
            let count = await store.countTraining('text', projectid);
            assert.strictEqual(count, 0);

            const data = [];

            for (let labelIdx = 0; labelIdx < 6; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 7; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            count = await store.countTraining('text', projectid);
            assert.strictEqual(count, 42);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        it('should count training data by label', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, 'UNIQUECLASSID', 'text', 'name', 'en', [], false);
            const projectid = project.id;
            let counts = await store.countTrainingByLabel(project);
            assert.deepStrictEqual(counts, {});

            const data = [];

            const expected: { [label: string]: number } = {};

            for (let labelIdx = 0; labelIdx < 5; labelIdx++) {
                const label = uuid();

                await store.addLabelToProject(userid, 'UNIQUECLASSID', projectid, label);

                const num = 8 + labelIdx;

                for (let text = 0; text < num; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }

                expected[label] = num;
            }

            await store.bulkStoreTextTraining(projectid, data);

            counts = await store.countTrainingByLabel(project);
            assert.deepStrictEqual(counts, expected);

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });


    describe('getTextTraining', () => {

        it('should retrieve training data', async () => {
            const projectid = uuid();
            const text = uuid();
            const label = uuid();

            const training = await store.storeTextTraining(projectid, text, label);
            assert(training);

            const retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 1);
            assert.strictEqual(retrieved[0].id, training.id);
            assert.strictEqual(retrieved[0].textdata, text);
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
                    const textdata = uuid();

                    testdata.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, testdata);
            return labels;
        }


        it('should fetch specific amount of training data', async () => {
            const projectid = uuid();

            await createTestData(projectid, 6, 9);

            let retrieved = await store.getTextTraining(projectid, { start : 0, limit : 2 });
            assert.strictEqual(retrieved.length, 2);

            retrieved = await store.getTextTraining(projectid, { start : 0, limit : 6 });
            assert.strictEqual(retrieved.length, 6);

            retrieved = await store.getTextTraining(projectid, { start : 0, limit : 52 });
            assert.strictEqual(retrieved.length, 52);

            retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 50);

            return store.deleteTrainingByProjectId('text', projectid);
        });


        it('should fetch training data from a specified offset', async () => {
            const projectid = uuid();
            const label = uuid();

            for (let idx = 0; idx < 10; idx++) {
                await store.storeTextTraining(projectid, idx.toString(), label);
            }

            for (let idx = 0; idx < 10; idx++) {
                const search = { start : idx, limit : 10 - idx };
                const retrieved: Objects.TextTraining[] = await store.getTextTraining(projectid, search);
                assert.strictEqual(retrieved.length, 10 - idx);

                for (let verify = idx; verify < (10 - idx); verify++) {
                    const next = retrieved.shift();
                    assert(next);
                    if (next) {
                        assert.strictEqual(next.label, label);
                        assert.strictEqual(next.textdata, verify.toString());
                    }
                }
            }

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });


    describe('getTextTrainingByLabel', () => {

        it('should retrieve data by label', async () => {
            const projectid = uuid();
            const targetlabel = uuid();
            const data = [
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : targetlabel },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : targetlabel },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : targetlabel },
                { textdata : uuid(), label : uuid() },
            ];

            let retrieved = await store.getTextTrainingByLabel(projectid, targetlabel, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 0);

            await store.bulkStoreTextTraining(projectid, data);

            retrieved = await store.getTextTrainingByLabel(projectid, targetlabel, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 3);
            assert.deepStrictEqual(retrieved.map((item) => item.textdata),
                             [ data[2].textdata, data[5].textdata, data[7].textdata ]);

            retrieved = await store.getTextTrainingByLabel(projectid, targetlabel, { start : 1, limit : 1 });
            assert.strictEqual(retrieved.length, 1);
            assert.deepStrictEqual(retrieved.map((item) => item.textdata),
                             [ data[5].textdata ]);

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });



    describe('renameTextTrainingLabel', () => {

        it('should rename a label', async () => {
            const project = await store.storeProject(uuid(), 'UNIQUECLASSID', 'text', 'name', 'en', [], false);

            const BEFORE = uuid();
            const AFTER = uuid();

            const data = [
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : BEFORE },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : BEFORE },
                { textdata : uuid(), label : uuid() },
                { textdata : uuid(), label : BEFORE },
                { textdata : uuid(), label : uuid() },
            ];
            await store.bulkStoreTextTraining(project.id, data);

            const fetched = await store.getTextTraining(project.id, DEFAULT_PAGING);
            const expected = fetched.map((item) => {
                if (item.label === BEFORE) {
                    return { id: item.id, textdata : item.textdata, label : AFTER };
                }
                return item;
            });

            await store.renameTrainingLabel('text', project.id, BEFORE, AFTER);

            const retrieved = await store.getTextTraining(project.id, DEFAULT_PAGING);
            assert.deepStrictEqual(retrieved, expected);

            const counts = await store.countTrainingByLabel(project);
            assert.strictEqual(counts[AFTER], 3);
            assert.strictEqual(BEFORE in counts, false);
        });

    });

});
