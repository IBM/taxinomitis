/*eslint-env mocha */

import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as request from 'request-promise';

import * as store from '../../lib/db/store';
import * as dbtypes from '../../lib/db/db-types';
import * as numbers from '../../lib/training/numbers';
import * as TrainingTypes from '../../lib/training/training-types';




describe('Training - numbers service', () => {

    const USERID = 'TESTUSER';
    const CLASSID = 'TESTTENANT';

    let postStub;
    let deleteStub;

    let goodProject;
    let missingProject;

    before(() => {
        postStub = sinon.stub(request, 'post');
        postStub.withArgs(sinon.match(/.*models/), sinon.match.any).callsFake(mockNumbers.createClassifier);
        postStub.withArgs(sinon.match(/.*classify/), sinon.match.any).callsFake(mockNumbers.testClassifier);
        deleteStub = sinon.stub(request, 'delete').callsFake(mockNumbers.deleteClassifier);

        return store.init();
    });
    after(() => {
        postStub.restore();
        deleteStub.restore();

        return store.deleteEntireUser(USERID, CLASSID)
            .then(() => {
                return store.disconnect();
            });
    });


    describe('create classifier', () => {

        it('should handle training failures', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes-animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates-animals');

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'likes-animals', numberdata : [3, 0, 0] },
                { label : 'likes-animals', numberdata : [1, 1, 0] },
                { label : 'likes-animals', numberdata : [0, 1, 2] },
                { label : 'hates-animals', numberdata : [0, 1, 0.1] },
                { label : 'hates-animals', numberdata : [0, 0, 0] },
                { label : 'hates-animals', numberdata : [0, 0, 0] },
            ]);

            const classifier = await numbers.trainClassifier(project);
            assert.equal(classifier.classifierid, project.id);
            assert(classifier.created instanceof Date);
            assert.equal(classifier.status, 'Failed');

            let keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.equal(keys.length, 0);

            await store.deleteEntireProject(USERID, CLASSID, project);

            assert(deleteStub.calledWith(sinon.match.any, {
                auth : {
                    user : process.env.NUMBERS_SERVICE_USER,
                    pass : process.env.NUMBERS_SERVICE_PASS,
                },
                qs : {
                    tenantid : CLASSID,
                    studentid : USERID,
                    projectid : project.id,
                },
                json : true,
            }));

            keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.equal(keys.length, 0);
        });



        it('should handle test failures due to missing training', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields);
            goodProject = project.id;
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes-animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates-animals');

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'likes-animals', numberdata : [3, 0, 0] },
                { label : 'hates-animals', numberdata : [0, 1, 0.1] },
            ]);

            const classifier = await numbers.trainClassifier(project);
            assert.equal(classifier.status, 'Available');

            goodProject = 'CLEARED';
            missingProject = project.id;

            const classifications = await numbers.testClassifier(USERID, CLASSID, project.id, [10, 5, 0.5]);
            assert.deepEqual(classifications, [
                { class_name: 'label_name_2', confidence: 90 },
                { class_name: 'label_name_1', confidence: 86 },
                { class_name: 'label_name_4', confidence: 46 },
                { class_name: 'label_name_3', confidence: 13 },
            ]);

            await store.deleteEntireProject(USERID, CLASSID, project);
        });



        it('should manage number classifiers', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields);
            goodProject = project.id;
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes-animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates-animals');

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'likes-animals', numberdata : [3, 0, 0] },
                { label : 'likes-animals', numberdata : [1, 1, 0] },
                { label : 'likes-animals', numberdata : [0, 1, 2] },
                { label : 'likes-animals', numberdata : [1, 2, 0] },
                { label : 'likes-animals', numberdata : [0, 0, 1.5] },
                { label : 'likes-animals', numberdata : [0, 0, 0] },
                { label : 'hates-animals', numberdata : [0, 0, 0.25] },
                { label : 'hates-animals', numberdata : [0, 0, 0] },
                { label : 'hates-animals', numberdata : [0, 0, 0] },
                { label : 'hates-animals', numberdata : [0, 1, 0.1] },
                { label : 'hates-animals', numberdata : [0, 0, 0] },
                { label : 'hates-animals', numberdata : [0, 0, 0] },
            ]);

            const classifier = await numbers.trainClassifier(project);
            assert.equal(classifier.classifierid, project.id);
            assert(classifier.created instanceof Date);
            assert.equal(classifier.status, 'Available');

            assert(postStub.calledWith(sinon.match.any, {
                auth : {
                    user : process.env.NUMBERS_SERVICE_USER,
                    pass : process.env.NUMBERS_SERVICE_PASS,
                },
                body : {
                    tenantid : CLASSID,
                    studentid : USERID,
                    projectid : project.id,
                    data : [
                        [ { cats : 0, dogs : 0, fraction : 0.25 },  'hates-animals' ],
                        [ { cats : 0, dogs : 0, fraction : 0 },  'hates-animals' ],
                        [ { cats : 0, dogs : 0, fraction : 0 },  'hates-animals' ],
                        [ { cats : 0, dogs : 1, fraction : 0.1 },  'hates-animals' ],
                        [ { cats : 0, dogs : 0, fraction : 0 },  'hates-animals' ],
                        [ { cats : 0, dogs : 0, fraction : 0 },  'hates-animals' ],
                        [ { cats : 3, dogs : 0, fraction : 0 },  'likes-animals' ],
                        [ { cats : 1, dogs : 1, fraction : 0 },  'likes-animals' ],
                        [ { cats : 0, dogs : 1, fraction : 2 },  'likes-animals' ],
                        [ { cats : 1, dogs : 2, fraction : 0 },  'likes-animals' ],
                        [ { cats : 0, dogs : 0, fraction : 1.5 },  'likes-animals' ],
                        [ { cats : 0, dogs : 0, fraction : 0 }, 'likes-animals' ],
                    ],
                },
                json : true,
                gzip : true,
            }));


            let keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.equal(keys.length, 1);
            assert.equal(keys[0].classifierid, project.id);
            assert.equal(keys[0].projectid, project.id);
            assert.equal(keys[0].type, 'numbers');
            assert.equal(keys[0].credentials.servicetype, 'num');
            assert.equal(keys[0].credentials.username, USERID);
            assert.equal(keys[0].credentials.password, CLASSID);

            const classifications = await numbers.testClassifier(USERID, CLASSID, project.id, [10, 5, 0.5]);
            assert.deepEqual(classifications, [
                { class_name: 'label_name_2', confidence: 90 },
                { class_name: 'label_name_1', confidence: 86 },
                { class_name: 'label_name_4', confidence: 46 },
                { class_name: 'label_name_3', confidence: 13 },
            ]);

            assert(postStub.calledWith(sinon.match.any, {
                auth : {
                    user : process.env.NUMBERS_SERVICE_USER,
                    pass : process.env.NUMBERS_SERVICE_PASS,
                },
                body : {
                    tenantid : CLASSID,
                    studentid : USERID,
                    projectid : project.id,
                    data : { cats : 10, dogs : 5, fraction : 0.5 },
                },
                json : true,
                gzip : true,
            }));

            await store.deleteEntireProject(USERID, CLASSID, project);

            assert(deleteStub.calledWith(sinon.match.any, {
                auth : {
                    user : process.env.NUMBERS_SERVICE_USER,
                    pass : process.env.NUMBERS_SERVICE_PASS,
                },
                qs : {
                    tenantid : CLASSID,
                    studentid : USERID,
                    projectid : project.id,
                },
                json : true,
            }));

            keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.equal(keys.length, 0);
        });
    });




    const mockNumbers = {
        createClassifier : (url, opts) => {
            if (opts.body.projectid === goodProject) {
                return Promise.resolve({
                    time : 0.0009050369262695312,
                    items : opts.body.data.length,
                });
            }
            else {
                return Promise.reject({ error : 'Bad things' });
            }
        },
        testClassifier : (url, opts) => {
            assert(url);
            assert(opts.auth.user);
            assert(opts.auth.pass);
            assert(opts.json);
            if (opts.body.projectid === goodProject) {
                return Promise.resolve({
                    label_name_1 : 86,
                    label_name_2 : 90,
                    label_name_3 : 13,
                    label_name_4 : 46,
                });
            }
            else if (opts.body.projectid === missingProject) {
                goodProject = opts.body.projectid;
                return Promise.reject({ statusCode : 404 });
            }
            else {
                return Promise.reject({ error : 'Bad things' });
            }
        },
        deleteClassifier : (url, opts) => {
            assert(url);
            assert(opts.auth.user);
            assert(opts.auth.pass);
            return Promise.resolve({ ok : true });
        },
    };

});
