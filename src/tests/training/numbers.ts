/*eslint-env mocha */

import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as request from 'request-promise';

import * as store from '../../lib/db/store';
import * as numbers from '../../lib/training/numbers';
import * as TrainingTypes from '../../lib/training/training-types';




describe('Training - NLC', () => {

    const USERID = 'TESTUSER';
    const CLASSID = 'TESTTENANT';


    let postStub;
    let deleteStub;

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

        it('should manage number classifiers', async () => {
            const fields = ['cats', 'dogs', 'fraction'];

            const project = await store.storeProject(USERID, CLASSID, 'numbers', 'my project', fields);
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

            const classifier = await numbers.trainClassifier(USERID, CLASSID, project.id);
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
                        [ 0, 0, 0.25, 'hates-animals' ],
                        [ 0, 0, 0, 'hates-animals' ],
                        [ 0, 0, 0, 'hates-animals' ],
                        [ 0, 1, 0.1, 'hates-animals' ],
                        [ 0, 0, 0, 'hates-animals' ],
                        [ 0, 0, 0, 'hates-animals' ],
                        [ 3, 0, 0, 'likes-animals' ],
                        [ 1, 1, 0, 'likes-animals' ],
                        [ 0, 1, 2, 'likes-animals' ],
                        [ 1, 2, 0, 'likes-animals' ],
                        [ 0, 0, 1.5, 'likes-animals' ],
                        [ 0, 0, 0, 'likes-animals' ],
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
                    data : [10, 5, 0.5],
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
            return Promise.resolve({
                time : 0.0009050369262695312,
                items : opts.body.data.length,
            });
        },
        testClassifier : (url, opts) => {
            assert(url);
            assert(opts.auth.user);
            assert(opts.auth.pass);
            assert(opts.json);
            return Promise.resolve({
                label_name_1 : 86,
                label_name_2 : 90,
                label_name_3 : 13,
                label_name_4 : 46,
            });
        },
        deleteClassifier : (url, opts) => {
            assert(url);
            assert(opts.auth.user);
            assert(opts.auth.pass);
            return Promise.resolve({ ok : true });
        },
    };

});
