/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as randomstring from 'randomstring';

import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';


describe('DB store - image training', () => {

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


    describe('getImageTrainingByLabel', () => {

        it('should retrieve data by label', async () => {
            const projectid = uuid();
            const targetlabel = uuid();
            const data = [
                { imageurl : uuid(), label : uuid() },
                { imageurl : uuid(), label : targetlabel },
                { imageurl : uuid(), label : uuid() },
                { imageurl : uuid(), label : uuid() },
                { imageurl : uuid(), label : targetlabel },
                { imageurl : uuid(), label : uuid() },
                { imageurl : uuid(), label : targetlabel },
            ];

            let retrieved = await store.getImageTrainingByLabel(projectid, targetlabel, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 0);

            for (const item of data) {
                await store.storeImageTraining(projectid, item.imageurl, item.label, false);
            }

            retrieved = await store.getImageTrainingByLabel(projectid, targetlabel, DEFAULT_PAGING);
            assert.strictEqual(retrieved.length, 3);
            assert.deepStrictEqual(retrieved.map((item) => item.imageurl),
                                [ data[1].imageurl, data[4].imageurl, data[6].imageurl ]);

            retrieved = await store.getImageTrainingByLabel(projectid, targetlabel, { start : 1, limit : 1 });
            assert.strictEqual(retrieved.length, 1);
            assert.deepStrictEqual(retrieved.map((item) => item.imageurl),
                                [ data[4].imageurl ]);

            return store.deleteTrainingByProjectId('images', projectid);
        });
    });


    describe('storeImageTraining', () => {

        it('should store remote image data', async () => {
            const projectid = uuid();
            const url = uuid();
            const label = uuid();

            const training = await store.storeImageTraining(projectid, url, label, false);
            assert(training);
            assert.strictEqual(training.projectid, projectid);
            assert.strictEqual(training.imageurl, url);
            assert.strictEqual(training.label, label);
            assert.strictEqual(training.isstored, false);

            const isStored = await store.isImageStored(training.id);
            assert.strictEqual(isStored, false);

            return store.deleteTrainingByProjectId('images', projectid);
        });

        it('should recognize non-existent images are not stored', () => {
            return store.isImageStored(uuid())
                .then((resp) => {
                    assert.strictEqual(resp, false);
                });
        });

        it('should store image data', async () => {
            const projectid = uuid();
            const url = uuid();
            const label = uuid();

            const training = await store.storeImageTraining(projectid, url, label, true);
            assert(training);
            assert.strictEqual(training.projectid, projectid);
            assert.strictEqual(training.imageurl, url);
            assert.strictEqual(training.label, label);
            assert.strictEqual(training.isstored, true);

            const isStored = await store.isImageStored(training.id);
            assert.strictEqual(isStored, true);

            return store.deleteTrainingByProjectId('images', projectid);
        });


        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const url = randomstring.generate({ length : 1500 });
            const label = uuid();

            try {
                await store.storeImageTraining(projectid, url, label, false);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert(err);
                assert.strictEqual(err.message, 'Image URL exceeds maximum allowed length (1024 characters)');

                const count = await store.countTraining('text', projectid);
                assert.strictEqual(count, 0);
            }
        });
    });



});
