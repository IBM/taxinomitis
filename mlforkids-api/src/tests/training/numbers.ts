/*eslint-env mocha */

import * as assert from 'assert';
import * as store from '../../lib/db/store';
import * as dbtypes from '../../lib/db/db-types';
import * as numbers from '../../lib/training/numbers';
import * as request from '../../lib/utils/request';



(process.env.TRAVIS ? describe.skip : describe)('Training - numbers service', () => {

    const USERID = 'TESTUSER';
    const CLASSID = 'TESTTENANT';

    before(() => {
        return store.init();
    });
    after(() => {
        return store.deleteEntireUser(USERID, CLASSID)
            .then(() => {
                return store.disconnect();
            });
    });


    function pause() {
        return new Promise((resolve) => { setTimeout(resolve, 2000); });
    }
    function waitForModel(statusUrl: string): Promise<numbers.NumbersApiResponsePayloadClassifierItem> {
        return pause()
            .then(() => {
                return request.get(statusUrl, { json : true });
            })
            .then((resp) => {
                if (resp.status === 'training') {
                    return waitForModel(statusUrl);
                }
                return resp;
            });
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

            const viz = await request.get(classifier.urls.viz, {  });
            assert(viz.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));

            await store.deleteEntireProject(USERID, CLASSID, project);
        });
    });
});
