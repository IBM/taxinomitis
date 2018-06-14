/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as request from 'request-promise';
import * as store from '../../lib/db/store';
import * as conversation from '../../lib/training/conversation';
import * as numbers from '../../lib/training/numbers';
import * as classifier from '../../lib/scratchx/classify';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import loggerSetup from '../../lib/utils/logger';

const log = loggerSetup();


const TESTCLASS = 'UNIQUECLASSID';


describe('Scratchx - classify', () => {

    before(() => {
        return store.init();
    });

    after(async () => {
        await store.deleteProjectsByClassId(TESTCLASS);
        return store.disconnect();
    });



    describe('images projects', () => {

        it('should require image data', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                updated : new Date(),
            };

            try {
                await classifier.classify(key, '  ');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }
        });

        it('should require a real project', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                updated : new Date(),
            };

            try {
                await classifier.classify(key, 'something');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Project not found');
            }
        });


        it('should return random classes for projects without classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'images', 'test project', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'left');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'right');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'IMGTEST',
                type : 'images',
                projectid : project.id,
                updated : new Date(),
            };

            const classifications = await classifier.classify(key, 'image data to be classified');
            assert.equal(classifications.length, 2);
            for (const classification of classifications) {
                assert(classification.random);
                assert.equal(classification.confidence, 50);
            }
        });

    });


    describe('text projects', () => {

        let requestPostStub: sinon.SinonStub;
        before((done) => {
            requestPostStub = sinon.stub(request, 'post');
            requestPostStub.callsFake(() => {
                log.debug('Calling the mock conversation API');
                return Promise.resolve({
                    intents : [
                        {
                            intent : 'BETA',
                            confidence : 0.84,
                        },
                        {
                            intent : 'ALPHA',
                            confidence : 0.16,
                        },
                    ],
                    entities : [],
                    input : {
                        text : 'question text',
                    },
                    output : {
                        text : [],
                        nodes_visited : [],
                        warning : 'No dialog node matched for the input at a root level. ' +
                                    '(and there is 1 more warning in the log)',
                        log_messages : [
                            {
                                level : 'warn',
                                msg : 'No dialog node matched for the input at a root level.',
                            },
                            {
                                level : 'warn',
                                msg : 'No dialog node condition matched to true in the last dialog round - ' +
                                        'context.nodes_visited is empty. ' +
                                        'Falling back to the root node in the next round.',
                            },
                        ],
                    },
                    context : {
                        conversation_id : uuid(),
                        system : {
                            dialog_stack : [
                                {
                                    dialog_node : 'root',
                                },
                            ],
                            dialog_turn_counter : 1,
                            dialog_request_counter : 1,
                        },
                    },
                });
            });


            stubbedClassifier = proxyquire('../../lib/scratchx/classify', {
                '../training/conversation' : {
                    'request-promise' : requestPostStub,
                },
            });

            setTimeout(done, 1000);
        });
        after(() => {
            requestPostStub.restore();
        });

        let stubbedClassifier: any;

        it('should require text', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                updated : new Date(),
            };

            try {
                await classifier.classify(key, '  ');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }
        });


        it('should require a valid project', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                updated : new Date(),
            };

            try {
                await classifier.classify(key, 'HELLO');
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Project not found');
            }
        });


        it('should return random classes for projects without classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'animal');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'mineral');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : project.id,
                updated : new Date(),
            };

            const classifications = await classifier.classify(key, 'text to be classified');
            assert.equal(classifications.length, 3);
            for (const classification of classifications) {
                assert(classification.random);
                assert.equal(classification.confidence, 33);
            }
        });


        it('should return Conversation classes for projects with classifiers', async () => {
            log.info('should return Conversation classes for projects with classifiers');

            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', 'test project', 'en', [], false);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'ALPHA');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'BETA');

            const created = await store.getProject(project.id);
            log.debug({ project, created, userid }, 'created project');

            const ts = new Date();
            ts.setMilliseconds(0);

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : project.id,
                classifierid : 'good',
                credentials : {
                    id : uuid(),
                    username : 'useruseruseruseruseruseruseruseruser',
                    password : 'passpasspass',
                    servicetype : 'conv',
                    url : 'url',
                    classid : TESTCLASS,
                },
                updated : ts,
            };

            const classifications = await stubbedClassifier.classify(key, 'text to be classified');
            log.info({ classifications }, 'classifications');

            assert.deepEqual(classifications, [
                { class_name: 'BETA', confidence: 84, classifierTimestamp : ts },
                { class_name: 'ALPHA', confidence: 16, classifierTimestamp : ts },
            ]);
        });
    });



    describe('numbers projects', () => {

        let requestPostStub: sinon.SinonStub;

        before(() => {
            requestPostStub = sinon.stub(request, 'post');
            requestPostStub.callsFake(() => {
                log.debug('Calling the mock numbers API');
                return Promise.resolve({
                    label_name_1 : 86,
                    label_name_2 : 90,
                });
            });
        });
        after(() => {
            requestPostStub.restore();
        });

        it('should require numbers', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
                updated : new Date(),
            };

            try {
                await classifier.classify(key, []);
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Missing data');
            }
        });


        it('should require a real project', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
                updated : new Date(),
            };

            try {
                await classifier.classify(key, ['123']);
                assert.fail(0, 1, 'Should not reach here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Project not found');
            }
        });


        it('should return random classes for projects without classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'numbers', 'test project', 'en', [
                { name : 'size', type : 'number' },
            ], false);
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'fruit');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'vegetable');

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : project.id,
                updated : new Date(),
            };

            const classifications = await classifier.classify(key, ['123']);
            assert.equal(classifications.length, 2);
            for (const classification of classifications) {
                assert(classification.random);
                assert.equal(classification.confidence, 50);
            }
        });



        it('should return classes for projects with classifiers', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'numbers', 'test project', 'en', [
                { name : 'a', type : 'number' },
            ], false);

            await store.addLabelToProject(userid, TESTCLASS, project.id, 'label_name_1');
            await store.addLabelToProject(userid, TESTCLASS, project.id, 'label_name_1');

            const ts = new Date();
            ts.setMilliseconds(0);

            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : project.id,
                classifierid : 'good',
                credentials : {
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    url : 'url',
                    classid : TESTCLASS,
                },
                updated : ts,
            };

            const classifications = await classifier.classify(key, ['123']);
            assert.deepEqual(classifications, [
                { class_name: 'label_name_2', confidence: 90, classifierTimestamp : ts },
                { class_name: 'label_name_1', confidence: 86, classifierTimestamp : ts },
            ]);
        });
    });
});
