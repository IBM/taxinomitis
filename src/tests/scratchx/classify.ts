/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as request from 'request-promise';
import * as store from '../../lib/db/store';
import * as nlc from '../../lib/training/nlc';
import * as classifier from '../../lib/scratchx/classify';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';



const TESTCLASS = 'UNIQUECLASSID';


describe('Scratchx - classify', () => {

    before(() => {
        return store.init();
    });

    after(async () => {
        await store.deleteProjectsByClassId(TESTCLASS);
        return store.disconnect();
    });




    describe('text projects', () => {


        it('should require text', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
            };

            try {
                await classifier.classify(key, '  ');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }
        });



        it('should return random classes for projects without classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', []);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'mineral');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : project.id,
            };

            const classifications = await classifier.classify(key, 'text to be classified');
            assert.equal(classifications.length, 3);
            for (const classification of classifications) {
                assert(classification.random);
                assert.equal(classification.confidence, 33);
            }
        });


        it('should return random classes for projects with training classifiers', async () => {
            const requestPostStub = sinon.stub(request, 'post').rejects({
                error : {
                    code : 409,
                    error : 'Classifier not ready',
                    description : 'The classifier is not ready. The status of the classifier is \'Training\'.',
                },
            });

            proxyquire('../../lib/training/nlc', {
                'request-promise' : {
                    post : requestPostStub,
                },
            });

            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', []);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'ALPHA');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'BETA');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : project.id,
                classifierid : 'good',
                credentials : {
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'nlc',
                    url : 'url',
                },
            };

            const classifications = await classifier.classify(key, 'text to be classified');
            assert.equal(classifications.length, 2);
            for (const classification of classifications) {
                assert(classification.random);
                assert.equal(classification.confidence, 50);
            }

            requestPostStub.restore();
        });


        it('should return NLC classes for projects with classifiers', async () => {
            const requestPostStub = sinon.stub(request, 'post').resolves({
                classifier_id : 'good',
                url : 'http://nlc.service/v1/classifiers/good/classify',
                text : 'question text',
                top_class : 'BETA',
                classes : [
                    {
                        class_name : 'BETA',
                        confidence : 0.84,
                    },
                    {
                        class_name : 'ALPHA',
                        confidence : 0.16,
                    },
                ],
            });

            proxyquire('../../lib/training/nlc', {
                'request-promise' : {
                    post : requestPostStub,
                },
            });

            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', []);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'ALPHA');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'BETA');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : project.id,
                classifierid : 'good',
                credentials : {
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'nlc',
                    url : 'url',
                },
            };

            const classifications = await classifier.classify(key, 'text to be classified');
            assert.deepEqual(classifications, [
                { class_name: 'BETA', confidence: 84 },
                { class_name: 'ALPHA', confidence: 16 },
            ]);

            requestPostStub.restore();
        });


    });



    describe('numbers projects', () => {


        it('should require numbers', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
            };

            try {
                await classifier.classify(key, '[]');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }
        });



        it('should return random classes for projects without classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'numbers', 'test project', ['size']);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'fruit');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : project.id,
            };

            const classifications = await classifier.classify(key, '[ 123 ]');
            assert.equal(classifications.length, 2);
            for (const classification of classifications) {
                assert(classification.random);
                assert.equal(classification.confidence, 50);
            }
        });


    });



    describe('images projects', () => {

        it('should return an error status', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : uuid(),
            };

            try {
                await classifier.classify(key, '{}');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Not implemented yet');
            }
        });
    });
});
