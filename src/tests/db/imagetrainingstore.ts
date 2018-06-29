/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
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
            assert.equal(retrieved.length, 0);

            for (const item of data) {
                await store.storeImageTraining(projectid, item.imageurl, item.label, false);
            }

            retrieved = await store.getImageTrainingByLabel(projectid, targetlabel, DEFAULT_PAGING);
            assert.equal(retrieved.length, 3);
            assert.deepEqual(retrieved.map((item) => item.imageurl),
                                [ data[1].imageurl, data[4].imageurl, data[6].imageurl ]);

            retrieved = await store.getImageTrainingByLabel(projectid, targetlabel, { start : 1, limit : 1 });
            assert.equal(retrieved.length, 1);
            assert.deepEqual(retrieved.map((item) => item.imageurl),
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
            assert.equal(training.projectid, projectid);
            assert.equal(training.imageurl, url);
            assert.equal(training.label, label);
            assert.equal(training.isstored, false);

            const isStored = await store.isImageStored(training.id);
            assert.equal(isStored, false);

            return store.deleteTrainingByProjectId('images', projectid);
        });


        it('should store image data', async () => {
            const projectid = uuid();
            const url = uuid();
            const label = uuid();

            const training = await store.storeImageTraining(projectid, url, label, true);
            assert(training);
            assert.equal(training.projectid, projectid);
            assert.equal(training.imageurl, url);
            assert.equal(training.label, label);
            assert.equal(training.isstored, true);

            const isStored = await store.isImageStored(training.id);
            assert.equal(isStored, true);

            return store.deleteTrainingByProjectId('images', projectid);
        });


        it('should limit maximum training data length', async () => {
            const projectid = uuid();
            const url = randomstring.generate({ length : 1500 });
            const label = uuid();

            try {
                await store.storeImageTraining(projectid, url, label, false);
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
