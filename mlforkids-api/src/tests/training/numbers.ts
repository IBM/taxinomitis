import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as store from '../../lib/db/store';
import * as dbtypes from '../../lib/db/db-types';
import * as numbers from '../../lib/training/numbers';
import * as request from '../../lib/utils/request';



(process.env.TRAVIS ? describe.skip : describe)('Training - numbers service', () => {

    const USERID = 'TESTUSER';
    const CLASSID = 'TESTTENANT';

    before(async () => {
        await store.init();
    });
    after(async () => {
        await store.deleteEntireUser(USERID, CLASSID);
        await store.disconnect();
    });


    function pause() {
        return new Promise((resolve) => { setTimeout(resolve, 2000); });
    }
    async function waitForModel(statusUrl: string): Promise<numbers.NumbersApiResponsePayloadClassifierItem> {
        await pause();
        const resp = await request.get(statusUrl, { json : true });
        if (resp.status === 'training') {
            return waitForModel(statusUrl);
        }
        return resp;
    }


    describe('create classifier', () => {


        it('should get model visualisations', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields, false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes_animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates_animals');
            project.labels = ['likes_animals', 'hates_animals'];

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'likes_animals', numberdata : [1, 1, 0] },
                { label : 'likes_animals', numberdata : [0, 1, 2] },
                { label : 'likes_animals', numberdata : [1, 2, 0] },
                { label : 'likes_animals', numberdata : [0, 0, 1.5] },
                { label : 'likes_animals', numberdata : [0, 0, 0] },
                { label : 'hates_animals', numberdata : [0, 0, 0.25] },
                { label : 'hates_animals', numberdata : [0, 0, 0] },
                { label : 'hates_animals', numberdata : [0, 0, 0] },
                { label : 'hates_animals', numberdata : [0, 1, 0.1] },
                { label : 'hates_animals', numberdata : [0, 0, 0] },
            ]);

            const classifier = await numbers.trainClassifierCloudProject(project);
            assert.strictEqual('Training', classifier.status);
            assert(classifier.urls);

            await waitForModel(classifier.urls.status);

            const viz = await request.get(classifier.urls.tree, {  });
            assert(viz.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
                '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'));

            await store.deleteEntireProject(USERID, CLASSID, project);
        });


        it('should store the model url before returning', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'stored project', 'en', fields, false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'one');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'two');
            project.labels = ['one', 'two'];

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'one', numberdata : [1, 1] },
                { label : 'one', numberdata : [2, 2] },
                { label : 'one', numberdata : [3, 3] },
                { label : 'two', numberdata : [1, 10] },
                { label : 'two', numberdata : [2, 20] },
                { label : 'two', numberdata : [3, 30] },
            ]);

            // slow down storing the url, so that a caller that doesn't
            //  wait for it would always see it missing
            const realStore = store.storeNumbersClassifier;
            const slowStore = sinon.stub(store, 'storeNumbersClassifier').callsFake(async (userid, classid, projectid, url) => {
                await new Promise((resolve) => { setTimeout(resolve, 500); });
                return realStore(userid, classid, projectid, url);
            });

            try {
                const classifier = await numbers.trainClassifierCloudProject(project);
                assert.strictEqual('Training', classifier.status);
                assert(classifier.urls);

                const stored = await store.getNumbersClassifiers(project.id);
                assert.strictEqual(stored.length, 1);
                assert.strictEqual(stored[0].url, classifier.urls.status);
            }
            finally {
                slowStore.restore();
                await store.deleteEntireProject(USERID, CLASSID, project);
            }
        });
    });
});
