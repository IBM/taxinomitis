/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';

import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';


describe('DB store - training', () => {

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
            assert.equal(training.projectid, projectid);
            assert.equal(training.textdata, text);
            assert.equal(training.label, label);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const text = randomstring.generate({ length : 1200 });
            const label = uuid();

            try {
                await store.storeTextTraining(projectid, text, label);
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert(err);
                assert.equal(err.message, 'Text exceeds maximum allowed length (1024 characters)');

                const count = await store.countTraining('text', projectid);
                assert.equal(count, 0);
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
            assert.deepEqual(retrieved.sort(), ['FIRST', 'SECOND', 'THIRD', 'FOURTH'].sort());

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });


    describe('storeNumberTraining', () => {

        it('should store training data', async () => {
            const projectid = uuid();
            const label = uuid();
            const data = [1, 2, 3, 4];

            const training = await store.storeNumberTraining(projectid, data, label);
            assert(training);
            assert.equal(training.projectid, projectid);
            assert.deepEqual(training.numberdata, [1, 2, 3, 4]);
            assert.equal(training.label, label);

            return store.deleteTrainingByProjectId('numbers', projectid);
        });

        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
            const label = uuid();

            try {
                await store.storeNumberTraining(projectid, data, label);
            }
            catch (err) {
                assert.equal(err.message, 'Number of data items exceeded maximum');
                return;
            }
            assert.fail(1, 0, 'Failed to reject training', '');
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
            assert.equal(retrieved.length, 1);

            await store.deleteTrainingByProjectId('text', projectid);

            retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.equal(retrieved.length, 0);
        });
    });




    describe('deleteNumberTraining', () => {

        it('should delete training data', async () => {
            const projectid = uuid();
            const data = [1, 2, 3];
            const label = uuid();

            const training = await store.storeNumberTraining(projectid, data, label);
            assert(training);

            let retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.equal(retrieved.length, 1);

            const before = await store.countTraining('numbers', projectid);
            assert.equal(before, 1);

            await store.deleteTrainingByProjectId('numbers', projectid);

            retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.equal(retrieved.length, 0);

            const count = await store.countTraining('numbers', projectid);
            assert.equal(count, 0);
        });


        function wait() {
            return new Promise((resolve) => setTimeout(resolve, 1000));
        }


        it('should delete training by label', async () => {
            const userid = uuid();
            const classid = 'UNIQUECLASSID';

            const project = await store.storeProject(
                userid, classid,
                'numbers',
                'project name',
                ['first', 'second', 'third']);


            await store.addLabelToProject(userid, classid, project.id, 'TENS');
            await store.addLabelToProject(userid, classid, project.id, 'HUNDREDS');
            await store.addLabelToProject(userid, classid, project.id, 'THOUSANDS');

            store.storeNumberTraining(project.id, [1000, 2000, 3000], 'THOUSANDS');
            store.storeNumberTraining(project.id, [10, 20, 30], 'TENS');
            store.storeNumberTraining(project.id, [100, 300, 500], 'HUNDREDS');
            store.storeNumberTraining(project.id, [50, 60, 70], 'TENS');
            store.storeNumberTraining(project.id, [200, 300, 400], 'HUNDREDS');
            store.storeNumberTraining(project.id, [20, 40, 60], 'TENS');

            await wait();

            let counts = await store.countTrainingByLabel('numbers', project.id);
            assert.deepEqual(counts, { TENS : 3, HUNDREDS : 2, THOUSANDS : 1 });

            const labels = await store.removeLabelFromProject(userid, classid, project.id, 'HUNDREDS');
            assert.deepEqual(labels, ['TENS', 'THOUSANDS']);

            const updated = await store.getProject(project.id);
            assert.deepEqual(updated.labels, ['TENS', 'THOUSANDS']);

            counts = await store.countTrainingByLabel('numbers', project.id);
            assert.deepEqual(counts, { TENS : 3, THOUSANDS : 1 });

            await store.deleteEntireProject(userid, classid, project);
        });
    });




    describe('bulkStoreTextTraining', () => {

        it('should store multiple rows', async () => {
            const projectid = uuid();
            const data = [];

            let retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.equal(retrieved.length, 0);

            for (let labelIdx = 0; labelIdx < 5; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.equal(retrieved.length, 25);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        it('should count training data', async () => {
            const projectid = uuid();
            let count = await store.countTraining('text', projectid);
            assert.equal(count, 0);

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
            assert.equal(count, 42);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        it('should count training data by label', async () => {
            const projectid = uuid();
            let counts = await store.countTrainingByLabel('text', projectid);
            assert.deepEqual(counts, {});

            const data = [];

            const expected = {};

            for (let labelIdx = 0; labelIdx < 5; labelIdx++) {
                const label = uuid();
                const num = 8 + labelIdx;

                for (let text = 0; text < num; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }

                expected[label] = num;
            }

            await store.bulkStoreTextTraining(projectid, data);

            counts = await store.countTrainingByLabel('text', projectid);
            assert.deepEqual(counts, expected);

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
            assert.equal(retrieved.length, 1);
            assert.equal(retrieved[0].id, training.id);
            assert.equal(retrieved[0].textdata, text);
            assert.equal(retrieved[0].label, label);

            return store.deleteTrainingByProjectId('text', projectid);
        });

        async function createTestData(projectid, numLabels, numText) {
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
            assert.equal(retrieved.length, 2);

            retrieved = await store.getTextTraining(projectid, { start : 0, limit : 6 });
            assert.equal(retrieved.length, 6);

            retrieved = await store.getTextTraining(projectid, { start : 0, limit : 52 });
            assert.equal(retrieved.length, 52);

            retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.equal(retrieved.length, 50);

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
                const retrieved = await store.getTextTraining(projectid, search);
                assert.equal(retrieved.length, 10 - idx);

                for (let verify = idx; verify < (10 - idx); verify++) {
                    const next = retrieved.shift();
                    assert.equal(next.label, label);
                    assert.equal(next.textdata, verify);
                }
            }

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });


    describe('getNumberTraining', () => {

        it('should retrieve training data', async () => {
            const projectid = uuid();
            const data = [1, 3, 5];
            const label = uuid();

            const training = await store.storeNumberTraining(projectid, data, label);
            assert(training);

            const retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.equal(retrieved.length, 1);
            assert.equal(retrieved[0].id, training.id);
            assert.deepEqual(retrieved[0].numberdata, [1, 3, 5]);
            assert.equal(retrieved[0].label, label);

            return store.deleteTrainingByProjectId('text', projectid);
        });


        async function createTestData(projectid, numLabels, numText) {
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
            assert.equal(retrieved.length, 2);

            retrieved = await store.getNumberTraining(projectid, { start : 0, limit : 6 });
            assert.equal(retrieved.length, 6);

            retrieved = await store.getNumberTraining(projectid, { start : 0, limit : 52 });
            assert.equal(retrieved.length, 52);

            retrieved = await store.getNumberTraining(projectid, DEFAULT_PAGING);
            assert.equal(retrieved.length, 50);

            return store.deleteTrainingByProjectId('numbers', projectid);
        });


        it('should count training data', async () => {
            const projectid = uuid();
            let count = await store.countTraining('numbers', projectid);
            assert.equal(count, 0);

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
            assert.equal(count, 42);

            return store.deleteTrainingByProjectId('numbers', projectid);
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
            assert.equal(retrieved.length, 0);

            await store.bulkStoreTextTraining(projectid, data);

            retrieved = await store.getTextTrainingByLabel(projectid, targetlabel, DEFAULT_PAGING);
            assert.equal(retrieved.length, 3);
            assert.deepEqual(retrieved.map((item) => item.textdata),
                             [ data[2].textdata, data[5].textdata, data[7].textdata ]);

            retrieved = await store.getTextTrainingByLabel(projectid, targetlabel, { start : 1, limit : 1 });
            assert.equal(retrieved.length, 1);
            assert.deepEqual(retrieved.map((item) => item.textdata),
                             [ data[5].textdata ]);

            return store.deleteTrainingByProjectId('text', projectid);
        });
    });


    describe('renameTextTrainingLabel', () => {

        it('should rename a label', async () => {
            const projectid = uuid();
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
            await store.bulkStoreTextTraining(projectid, data);

            const fetched = await store.getTextTraining(projectid, DEFAULT_PAGING);
            const expected = fetched.map((item) => {
                if (item.label === BEFORE) {
                    return { id: item.id, textdata : item.textdata, label : AFTER };
                }
                return item;
            });

            await store.renameTrainingLabel('text', projectid, BEFORE, AFTER);

            const retrieved = await store.getTextTraining(projectid, DEFAULT_PAGING);
            assert.deepEqual(retrieved, expected);

            const counts = await store.countTrainingByLabel('text', projectid);
            assert.equal(counts[AFTER], 3);
            assert.equal(BEFORE in counts, false);
        });

    });


    describe('storeImageTraining', () => {

        it('should store image data', async () => {
            const projectid = uuid();
            const url = uuid();
            const label = uuid();

            const training = await store.storeImageTraining(projectid, url, label);
            assert(training);
            assert.equal(training.projectid, projectid);
            assert.equal(training.imageurl, url);
            assert.equal(training.label, label);

            return store.deleteTrainingByProjectId('images', projectid);
        });

        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const url = randomstring.generate({ length : 1500 });
            const label = uuid();

            try {
                await store.storeImageTraining(projectid, url, label);
                assert.fail(0, 1, 'should not reach here', '');
            }
            catch (err) {
                assert(err);
                assert.equal(err.message, 'Image URL exceeds maximum allowed length (1024 characters)');

                const count = await store.countTraining('text', projectid);
                assert.equal(count, 0);
            }
        });
    });



});
