/*eslint-env mocha */

import * as assert from 'assert';
import * as store from '../../lib/db/store';
import * as dbtypes from '../../lib/db/db-types';
import * as numbers from '../../lib/training/numbers';



(process.env.TRAVIS ? describe.skip : describe)('Training - numbers service', () => {

    const USERID = 'TESTUSER';
    const CLASSID = 'TESTTENANT';

    let goodProject: string;

    before(() => {
        return store.init();
    });
    after(() => {
        return store.deleteEntireUser(USERID, CLASSID)
            .then(() => {
                return store.disconnect();
            });
    });

    describe('test classifier', () => {

        it('should check the range of numbers for the numbers service', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields, false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes_animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates_animals');
            project.labels = ['likes_animals', 'hates_animals'];

            try {
                await numbers.testClassifier(USERID, CLASSID, new Date(), project.id,
                    [1, 204040404040404040404040404040404040404040404040404040404040404040404040404040000000000000, 3]);
                assert.fail('should not have allowed this');
            }
            catch (err) {
                assert(err.message.startsWith('Value ('));
                assert(err.message.endsWith(') is too big'));
                assert.strictEqual(err.statusCode, 400);
            }

            await store.deleteEntireProject(USERID, CLASSID, project);
        });
    });

    describe('create classifier', () => {


        it('should get model visualisations', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields, false);
            goodProject = project.id;
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

            const classifier = await numbers.trainClassifier(project);
            assert.strictEqual(classifier.status, 'Available');

            goodProject = 'CLEARED';

            const classifierTimestamp = new Date();
            classifierTimestamp.setMilliseconds(0);

            const classifications = await numbers.testClassifier(
                USERID, CLASSID,
                classifierTimestamp,
                project.id, [0, 1, 1]);

            assert.deepStrictEqual(classifications, [
                { class_name: 'likes_animals', classifierTimestamp, confidence: 100 },
                { class_name: 'hates_animals', classifierTimestamp, confidence: 0 },
            ]);


            const viz = await numbers.getModelVisualisation(project);
            assert.deepStrictEqual(viz.vocabulary, [ 'cats', 'dogs', 'fraction' ]);
            assert(viz.dot && viz.dot.startsWith('digraph Tree {'));
            assert(viz.svg &&
                   viz.svg.startsWith('<?xml version="1.0" encoding="UTF-8"') &&
                   viz.svg.includes('class = hates_animals') &&
                   viz.svg.includes('class = likes_animals') &&
                   viz.svg.endsWith('</svg>') &&
                   viz.svg.length > 7000);

            await store.deleteEntireProject(USERID, CLASSID, project);
        });

        it('should manage number classifiers', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields, false);
            goodProject = project.id;
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes_animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates_animals');
            project.labels = ['likes_animals', 'hates_animals'];

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'likes_animals', numberdata : [3, 0, 0] },
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
                { label : 'hates_animals', numberdata : [0, 0, 0] },
                { label : 'ignored', numberdata : [1, 2, 3] },
            ]);

            const fetched = await store.getProject(goodProject);
            if (!fetched) {
                return assert.fail('');
            }

            const classifier = await numbers.trainClassifier(fetched);
            assert.strictEqual(classifier.classifierid, project.id);
            assert(classifier.created instanceof Date);
            assert.strictEqual(classifier.status, 'Available');

            let keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.strictEqual(keys.length, 1);
            assert.strictEqual(keys[0].classifierid, project.id);
            assert.strictEqual(keys[0].projectid, project.id);
            assert.strictEqual(keys[0].type, 'numbers');
            const credentials = keys[0].credentials;
            assert(credentials);
            if (credentials) {
                assert.strictEqual(credentials.servicetype, 'num');
                assert.strictEqual(credentials.username, USERID);
                assert.strictEqual(credentials.password, CLASSID);
            }

            const classifierTimestamp = new Date();
            classifierTimestamp.setMilliseconds(0);

            const classifications = await numbers.testClassifier(
                USERID, CLASSID,
                classifierTimestamp,
                project.id, [0, 0, 0.1]);

            assert.deepStrictEqual(classifications, [
                { class_name: 'hates_animals', classifierTimestamp, confidence: 100 },
                { class_name: 'likes_animals', classifierTimestamp, confidence: 0 },
            ]);

            await store.deleteEntireProject(USERID, CLASSID, project);

            keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.strictEqual(keys.length, 0);
        });
    });
});
