/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';
// import { MAX_AUDIO_POINTS } from '../../lib/restapi/sounds/uploads';



describe('DB store - sound training', () => {

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


    // function createTraining(num = 19952): number[] {
    //     const numbers: number[] = [];
    //     for (let i = 0; i < num; i++) {
    //         numbers.push(Math.random());
    //     }
    //     return numbers;
    // }

    function isTrainingData(item: Objects.SoundTraining): boolean {
        return item &&
               typeof item.id === 'string' &&
               item.id.length === 36 &&
               typeof item.label === 'string' &&
               item.label.length > 0 &&
               typeof item.audiourl === 'string' &&
               item.audiourl.length > 0;
    }

    async function createTestData(projectid: string, numItems: number, numLabels: number): Promise<string[]> {
        const labels = [];

        for (let labelIdx = 0; labelIdx < numLabels; labelIdx++) {
            const label = uuid();
            labels.push(label);

            for (let i = 0; i < numItems; i++) {
                await store.storeSoundTraining(projectid, uuid(), label, uuid());
            }
        }

        return labels;
    }


    describe('storeSoundTraining', () => {

        it('should store training data', async () => {
            const projectid = uuid();
            const audioid = uuid();
            const dataurl = 'test-audio-data-url';
            const label = uuid();

            const training = await store.storeSoundTraining(projectid, dataurl, label, audioid);
            assert(training);
            assert(training.id);

            const retrieve = await store.getSoundTraining(projectid, { limit : 10, start : 0 });
            assert.deepStrictEqual({
                id : training.id,
                audiourl : dataurl,
                label,
            }, retrieve[0]);
            assert.strictEqual(training.label, label);

            assert(isTrainingData(training));

            return store.deleteTrainingByProjectId('sounds', projectid);
        });

    //     it('should reject empty data', async () => {
    //         const projectid = uuid();
    //         const data = createTraining(0);
    //         const label = uuid();

    //         try {
    //             await store.storeSoundTraining(projectid, data, label);
    //             assert.fail('should not reach here');
    //         }
    //         catch (err) {
    //             assert(err);
    //             assert.strictEqual(err.message, 'Empty audio is not allowed');

    //             const count = await store.countTraining('sounds', projectid);
    //             assert.strictEqual(count, 0);
    //         }
    //     });

    //     it('should limit maximum training data length', async () => {
    //         const projectid = uuid();
    //         const data = createTraining(MAX_AUDIO_POINTS * 2);
    //         const label = uuid();

    //         try {
    //             await store.storeSoundTraining(projectid, data, label);
    //             assert.fail('should not reach here');
    //         }
    //         catch (err) {
    //             assert(err);
    //             assert.strictEqual(err.message, 'Audio exceeds maximum allowed length');

    //             const count = await store.countTraining('sounds', projectid);
    //             assert.strictEqual(count, 0);
    //         }
    //     });

    //     it('should enforce limit on the number of rows', async () => {
    //         const projectid = uuid();

    //         const labels = await createTestData(projectid, 20, 5);

    //         try {
    //             await store.storeSoundTraining(projectid, createTraining(), labels[0]);
    //             assert.fail('should not reach here');
    //         }
    //         catch (err) {
    //             assert(err);
    //             assert.strictEqual(err.message, 'Project already has maximum allowed amount of training data');
    //         }

    //         const count = await store.countTraining('sounds', projectid);
    //         assert.strictEqual(count, 100);

    //         return store.deleteTrainingByProjectId('sounds', projectid);
    //     });
    });


    describe('countTraining', () => {

        it('should count the number of training examples', async () => {
            const projectid = uuid();

            await createTestData(projectid, 17, 5);

            let count = await store.countTraining('sounds', projectid);
            assert.strictEqual(count, 17 * 5);

            const retrieved = await store.getSoundTraining(projectid, { start : 0, limit : 10000 });
            assert.strictEqual(retrieved.length, 17 * 5);

            await store.deleteTrainingByProjectId('sounds', projectid);

            count = await store.countTraining('sounds', projectid);
            assert.strictEqual(count, 0);
        });

    });


    describe('deleteSoundTraining', () => {

        it('should delete training data', async () => {
            const projectid = uuid();
            const audioid = uuid();
            const dataurl = 'new-test-audio-data-url';
            const label = uuid();

            const training = await store.storeSoundTraining(projectid, dataurl, label, audioid);
            assert(isTrainingData(training));

            let retrieved = await store.getSoundTraining(projectid, DEFAULT_PAGING);
            assert(isTrainingData(retrieved[0]));
            assert.strictEqual(retrieved.length, 1);

            await store.deleteTrainingByProjectId('sounds', projectid);

            retrieved = await store.getSoundTraining(projectid, DEFAULT_PAGING);
            assert(retrieved);
            assert.strictEqual(retrieved.length, 0);
        });
    });


    describe('getSoundTraining', () => {

    //     it('should retrieve training data', async () => {
    //         const projectid = uuid();
    //         const data = createTraining();
    //         const label = uuid();

    //         const training = await store.storeSoundTraining(projectid, data, label);
    //         assert(isTrainingData(training));

    //         const retrieved = await store.getSoundTraining(projectid, DEFAULT_PAGING);
    //         assert(isTrainingData(retrieved[0]));
    //         assert.strictEqual(retrieved.length, 1);

    //         assert.deepStrictEqual(retrieved[0].audiodata, data);
    //         assert.strictEqual(retrieved[0].label, label);

    //         await store.deleteTrainingByProjectId('sounds', projectid);
    //     });


        it('should fetch specific amount of training data', async () => {
            const projectid = uuid();

            await createTestData(projectid, 16, 6);

            let retrieved = await store.getSoundTraining(projectid, { start : 0, limit : 2 });
            assert.strictEqual(retrieved.length, 2);

            retrieved = await store.getSoundTraining(projectid, { start : 0, limit : 6 });
            assert.strictEqual(retrieved.length, 6);

            retrieved = await store.getSoundTraining(projectid, { start : 0, limit : 52 });
            assert.strictEqual(retrieved.length, 52);

            retrieved = await store.getSoundTraining(projectid, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 50);

            return store.deleteTrainingByProjectId('sounds', projectid);
        });


        it('should fetch training data from a specified offset', async () => {
            const projectid = uuid();

            await createTestData(projectid, 20, 4);

            const allData = await store.getSoundTraining(projectid, { limit : 1000, start : 0 });

            for (let idx = 0; idx < 20; idx++) {
                const search = { start : idx, limit : 25 - idx };
                const retrieved: Objects.SoundTraining[] = await store.getSoundTraining(projectid, search);
                assert.strictEqual(retrieved.length, 25 - idx);

                assert(retrieved.every(isTrainingData));

                assert.deepStrictEqual(retrieved[0], allData[idx]);
                assert.deepStrictEqual(retrieved[1], allData[idx + 1]);
                assert.deepStrictEqual(retrieved[2], allData[idx + 2]);
            }

            return store.deleteTrainingByProjectId('sounds', projectid);
        });
    });


    // describe('renameSoundTrainingLabel', () => {

    //     it('should rename a label', async () => {
    //         const project = await store.storeProject(uuid(), 'UNIQUECLASSID', 'sounds', 'name', 'en', [], false);

    //         const BEFORE = uuid();
    //         const AFTER = uuid();

    //         const UNCHANGED = uuid();

    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);
    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);
    //         await store.storeSoundTraining(project.id, createTraining(), BEFORE);
    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);
    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);
    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);
    //         await store.storeSoundTraining(project.id, createTraining(), BEFORE);
    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);
    //         await store.storeSoundTraining(project.id, createTraining(), BEFORE);
    //         await store.storeSoundTraining(project.id, createTraining(), UNCHANGED);

    //         let counts = await store.countTrainingByLabel(project);
    //         assert.strictEqual(counts[BEFORE], 3);
    //         assert.strictEqual(counts[UNCHANGED], 7);
    //         assert.strictEqual(AFTER in counts, false);

    //         await store.renameTrainingLabel('sounds', project.id, BEFORE, AFTER);

    //         counts = await store.countTrainingByLabel(project);
    //         assert.strictEqual(counts[AFTER], 3);
    //         assert.strictEqual(counts[UNCHANGED], 7);
    //         assert.strictEqual(BEFORE in counts, false);
    //     });

    // });
});
