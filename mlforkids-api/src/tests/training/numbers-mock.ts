/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as coreReq from 'request';
import * as request from 'request-promise';

import * as store from '../../lib/db/store';
import * as dbtypes from '../../lib/db/db-types';
import * as numbers from '../../lib/training/numbers';
import * as deployment from '../../lib/utils/deployment';
import requestPromise = require('request-promise');




describe('Training - numbers service (mocked)', () => {

    const USERID = 'TESTUSER';
    const CLASSID = 'TESTTENANT';

    let postStub: sinon.SinonStub<any, any>;
    let deleteStub: sinon.SinonStub<any, any>;

    let goodProject: string;
    let missingProject: string;

    before(() => {
        postStub = sinon.stub(request, 'post');
        postStub.withArgs(sinon.match(/.*models/), sinon.match.any).callsFake(mockNumbers.createClassifier);
        postStub.withArgs(sinon.match(/.*classify/), sinon.match.any).callsFake(mockNumbers.testClassifier);
        // @ts-ignore
        deleteStub = sinon.stub(request, 'delete').callsFake(mockNumbers.deleteClassifier);

        return store.init();
    });
    beforeEach(() => {
        postStub.resetHistory();
    });
    after(() => {
        return store.deleteEntireUser(USERID, CLASSID)
            .then(() => {
                return store.disconnect();
            })
            .then(() => {
                postStub.restore();
                deleteStub.restore();
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

        it('should handle training failures', async () => {
            const fields: dbtypes.NumbersProjectFieldSummary[] = [
                { name : 'cats', type : 'number' }, { name : 'dogs', type : 'number' },
                { name : 'fraction', type : 'number' },
            ];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'good project', 'en', fields, false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'likes_animals');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'hates_animals');
            project.labels = ['likes_animals', 'hates_animals'];

            await store.bulkStoreNumberTraining(project.id, [
                { label : 'likes_animals', numberdata : [3, 0, 0] },
                { label : 'likes_animals', numberdata : [1, 1, 0] },
                { label : 'likes_animals', numberdata : [0, 1, 2] },
                { label : 'hates_animals', numberdata : [0, 1, 0.1] },
                { label : 'hates_animals', numberdata : [0, 0, 0] },
                { label : 'hates_animals', numberdata : [0, 0, 0] },
            ]);

            const classifier = await numbers.trainClassifier(project);
            assert.strictEqual(classifier.classifierid, project.id);
            assert(classifier.created instanceof Date);
            assert.strictEqual(classifier.status, 'Failed');

            let keys = await store.findScratchKeys(USERID, project.id, CLASSID);
            assert.strictEqual(keys.length, 0);

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
            assert.strictEqual(keys.length, 0);
        });



        it('should handle test failures due to missing training', async () => {
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
                { label : 'hates_animals', numberdata : [0, 1, 0.1] },
            ]);

            const classifier = await numbers.trainClassifier(project);
            assert.strictEqual(classifier.status, 'Available');

            goodProject = 'CLEARED';
            missingProject = project.id;

            const classifierTimestamp = new Date();
            classifierTimestamp.setMilliseconds(0);

            const classifications = await numbers.testClassifier(
                USERID, CLASSID,
                classifierTimestamp,
                project.id, [10, 5, 0.5]);

            assert.deepStrictEqual(classifications, [
                { class_name: 'label_name_2', confidence: 90, classifierTimestamp },
                { class_name: 'label_name_1', confidence: 86, classifierTimestamp },
                { class_name: 'label_name_4', confidence: 46, classifierTimestamp },
                { class_name: 'label_name_3', confidence: 13, classifierTimestamp },
            ]);

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

            const sortFn = (item1: any, item2: any) => {
                const label1 = item1[1];
                const label2 = item2[1];

                if (label1 < label2) {
                    return -1;
                }
                if (label1 > label2) {
                    return 1;
                }

                const data1 = item1[0];
                const data2 = item2[0];
                if (data1.cats < data2.cats) {
                    return -1;
                }
                if (data1.cats > data2.cats) {
                    return 1;
                }

                if (data1.dogs < data2.dogs) {
                    return -1;
                }
                if (data1.dogs > data2.dogs) {
                    return 1;
                }

                if (data1.fraction < data2.fraction) {
                    return -1;
                }
                if (data1.fraction > data2.fraction) {
                    return 1;
                }

                return 0;
            };

            const expectedCall = sinon.match((call) => {
                call.body.data = call.body.data.sort(sortFn);

                try {
                    assert.deepStrictEqual(call, {
                        auth : {
                            user : process.env.NUMBERS_SERVICE_USER,
                            pass : process.env.NUMBERS_SERVICE_PASS,
                        },
                        body : {
                            tenantid : CLASSID,
                            studentid : USERID,
                            projectid : project.id,
                            data : [
                                [ { cats: 0, dogs: 0, fraction: 0.25 }, 'hates_animals' ],
                                [ { cats: 0, dogs: 0, fraction: 0 }, 'hates_animals' ],
                                [ { cats: 0, dogs: 0, fraction: 0 }, 'hates_animals' ],
                                [ { cats: 0, dogs: 1, fraction: 0.1 }, 'hates_animals' ],
                                [ { cats: 0, dogs: 0, fraction: 0 }, 'hates_animals' ],
                                [ { cats: 0, dogs: 0, fraction: 0 }, 'hates_animals' ],
                                [ { cats: 3, dogs: 0, fraction: 0 }, 'likes_animals' ],
                                [ { cats: 1, dogs: 1, fraction: 0 }, 'likes_animals' ],
                                [ { cats: 0, dogs: 1, fraction: 2 }, 'likes_animals' ],
                                [ { cats: 1, dogs: 2, fraction: 0 }, 'likes_animals' ],
                                [ { cats: 0, dogs: 0, fraction: 1.5 }, 'likes_animals' ],
                                [ { cats: 0, dogs: 0, fraction: 0 }, 'likes_animals' ],
                            ].sort(sortFn),
                        },
                        json : true,
                        gzip : true,
                    });
                    return true;
                }
                catch (err) {
                    return false;
                }
            });
            assert(postStub.calledWith(sinon.match.string, expectedCall));

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
                project.id, [10, 5, 0.5]);
            assert.deepStrictEqual(classifications, [
                { class_name: 'label_name_2', confidence: 90, classifierTimestamp },
                { class_name: 'label_name_1', confidence: 86, classifierTimestamp },
                { class_name: 'label_name_4', confidence: 46, classifierTimestamp },
                { class_name: 'label_name_3', confidence: 13, classifierTimestamp },
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
            assert.strictEqual(keys.length, 0);
        });
    });



    const mockNumbers = {
        createClassifier : (url: string, opts: numbers.NumbersApiRequestPayloadClassifierItem) => {
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
        testClassifier : (url: string, opts: numbers.NumbersApiRequestPayloadTestItem) => {
            assert(url);
            assert(opts && opts.auth);

            if (deployment.isProdDeployment()) {
                assert(opts && opts.auth && opts.auth.user);
                assert(opts && opts.auth && opts.auth.pass);
            }

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
        deleteClassifier : (url: string, options?: coreReq.CoreOptions) => {
            // TODO this is ridiculous... do I really have to fight with TypeScript like this?
            const unk: unknown = options as unknown;
            const opts: numbers.NumbersApiDeleteClassifierRequest = unk as numbers.NumbersApiDeleteClassifierRequest;

            assert(url);
            assert(opts && opts.auth);

            if (deployment.isProdDeployment()) {
                assert(opts && opts.auth && opts.auth.user);
                assert(opts && opts.auth && opts.auth.pass);
            }

            const prom: unknown = Promise.resolve();
            return prom as requestPromise.RequestPromise;
        },
    };

});





