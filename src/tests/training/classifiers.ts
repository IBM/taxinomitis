/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as uuid from 'uuid';
import * as request from 'request-promise';
import * as randomstring from 'randomstring';
import * as dbobjects from '../../lib/db/objects';
import * as store from '../../lib/db/store';
import * as TrainingTypes from '../../lib/training/training-types';
import * as classifiers from '../../lib/training/classifiers';



describe('Training - Unmanaged classifiers', () => {

    const CLASSID = 'TESTTENANT';
    const USERID = uuid.v4();

    const conv: TrainingTypes.BluemixServiceType = 'conv';
    const visrec: TrainingTypes.BluemixServiceType = 'visrec';
    const textProjectName = 'TEST_TEXT_PROJECT';
    const imagesProjectName = 'TEST_IMG_PROJECT';

    const username = randomstring.generate(36);
    const password = randomstring.generate(12);
    const apikey = randomstring.generate(40);

    const convCredentials = dbobjects.createBluemixCredentials(conv,
        CLASSID,
        undefined,
        username, password, 'conv_lite');
    const visrecCredentials = dbobjects.createBluemixCredentials(visrec,
        CLASSID,
        apikey,
        undefined, undefined, 'visrec_lite');


    const textProject = dbobjects.getProjectFromDbRow(dbobjects.createProject(USERID, CLASSID,
        'text',
        textProjectName,
        'en',
        [],
        false));
    const validWorkspace: TrainingTypes.ConversationWorkspace = {
        id : uuid.v4(),
        workspace_id : uuid.v1(),
        credentialsid : convCredentials.id,
        url : 'https://gateway-test.watsonplatform.net/conversation/api',
        name : textProjectName,
        language : 'en',
        created : new Date(),
        expiry : new Date(),
    };

    const imagesProject = dbobjects.getProjectFromDbRow(dbobjects.createProject(USERID, CLASSID,
        'images',
        imagesProjectName,
        'en',
        [],
        false));
    const validClassifier: TrainingTypes.VisualClassifier = {
        id : uuid.v4(),
        classifierid : uuid.v1(),
        credentialsid : visrecCredentials.id,
        created : new Date(),
        expiry : new Date(),
        name : imagesProjectName,
        url : 'https://gateway-test.watsonplatform.net/visual-recognition/api',
    };


    describe('get unknown classifiers', () => {

        let getClassifiersStub: sinon.SinonStub<any, any>;

        before(async () => {
            getClassifiersStub = sinon.stub(request, 'get');
            getClassifiersStub
                .withArgs(sinon.match(/.*workspaces/), sinon.match.any)
                .callsFake(mockConversation.getClassifiers);
            getClassifiersStub
                .withArgs(sinon.match(/.*classifiers/), sinon.match.any)
                .callsFake(mockVisRec.getClassifiers);


            await store.init();

            await store.storeBluemixCredentials(CLASSID, dbobjects.getCredentialsAsDbRow(convCredentials));
            await store.storeBluemixCredentials(CLASSID, dbobjects.getCredentialsAsDbRow(visrecCredentials));

            await store.storeConversationWorkspace(convCredentials, textProject, validWorkspace);
            await store.storeImageClassifier(visrecCredentials, imagesProject, validClassifier);
        });

        after(async () => {
            getClassifiersStub.restore();

            await store.deleteBluemixCredentials(convCredentials.id);
            await store.deleteBluemixCredentials(visrecCredentials.id);
            await store.deleteConversationWorkspace(validWorkspace.id);
            await store.deleteImageClassifier(validClassifier.id);

            await store.disconnect();
        });


        it('should get a list of unknown text classifiers', async () => {
            const unknowns = await classifiers.getUnknownTextClassifiers(CLASSID);
            assert.strictEqual(unknowns.length, 3);
            assert(unknowns.some((unknown) => unknown.name === 'First API test'));
            assert(unknowns.some((unknown) => unknown.name === 'Second API test'));
            assert(unknowns.some((unknown) => unknown.name === 'Third API test'));
        });

        it('should get a list of unknown text classifiers', async () => {
            const unknowns = await classifiers.getUnknownImageClassifiers(CLASSID);
            assert.strictEqual(unknowns.length, 2);
            assert(unknowns.some((unknown) => unknown.name === 'dogs'));
            assert(unknowns.some((unknown) => unknown.name === 'Cars vs Trucks'));
        });

    });


    describe('delete classifier from Bluemix', () => {

        let deleteClassifiersStub: sinon.SinonStub<any, any>;

        before(async () => {
            deleteClassifiersStub = sinon.stub(request, 'delete');
            deleteClassifiersStub
                .withArgs(sinon.match(/.*workspaces\/.*/), sinon.match.any)
                .callsFake(mockConversation.deleteClassifier);
            deleteClassifiersStub
                .withArgs(sinon.match(/.*classifiers/), sinon.match.any)
                .callsFake(mockVisRec.deleteClassifier);
        });

        after(async () => {
            deleteClassifiersStub.restore();
        });


        it('should delete a text classifier', () => {
            return classifiers.deleteClassifier('conv', convCredentials, validWorkspace.workspace_id);
        });
        it('should delete a images classifier', () => {
            return classifiers.deleteClassifier('visrec', visrecCredentials, validClassifier.classifierid);
        });
        it('should ignore requests to delete invalid types', () => {
            return classifiers.deleteClassifier('num', visrecCredentials, validClassifier.classifierid);
        });

    });



    const mockConversation = {
        getClassifiers : () => {
            return Promise.resolve({
                pagination: {
                    refresh_url: '/v1/workspaces?version=2018-09-20',
                },
                workspaces: [
                    {
                        description: 'Example workspace created via API.',
                        language: 'en',
                        learning_opt_out: false,
                        name: 'First API test',
                        workspace_id: '91df2b80-56ed-11e8-9724-8b1321c226c8',
                    },
                    {
                        description: 'Sample project created by the Conversation UI',
                        language: 'en',
                        learning_opt_out: false,
                        name: 'Car Dashboard - Sample',
                        workspace_id: uuid.v1(),
                    },
                    {
                        description: 'Example workspace created via API.',
                        language: 'en',
                        learning_opt_out: false,
                        name: 'Second API test',
                        workspace_id: '590cb3ca-526a-464c-8b8e-4cd5f84fc5d2',
                    },
                    {
                        description: 'Workspace created by machinelearningforkids',
                        language: 'en',
                        learning_opt_out: false,
                        name: validWorkspace.name,
                        workspace_id: validWorkspace.workspace_id,
                    },
                    {
                        description: 'Example workspace created via API.',
                        language: 'en',
                        learning_opt_out: false,
                        name: 'Third API test',
                        workspace_id: 'cd8b1091-1ff9-4cc1-a1a3-3bb4bc5d4392',
                    },
                ],
            });
        },
        deleteClassifier : (url: string) => {
            assert.strictEqual(url,
                'https://gateway.watsonplatform.net/conversation/api/v1/workspaces/' + validWorkspace.workspace_id);
            return Promise.resolve();
        },
    };

    const mockVisRec = {
        getClassifiers : () => {
            return Promise.resolve({
                classifiers: [
                    {
                        classifier_id: 'dogs_1477088859',
                        name: 'dogs',
                        status: 'ready',
                        owner: '99d0114d-9959-4071-b06f-654701909be4',
                        created: '2018-03-17T19:01:30.536Z',
                        updated: '2018-03-17T19:42:19.906Z',
                        classes: [{
                            class: 'husky',
                        }, {
                            class: 'goldenretriever',
                        }, {
                            class: 'beagle',
                        }],
                        core_ml_enabled: true,
                    },
                    {
                        classifier_id: validClassifier.classifierid,
                        name: validClassifier.name,
                        status: 'ready',
                        owner: '99d0114d-9959-4071-b06f-654701909be4',
                        created: '2018-03-17T19:01:30.536Z',
                        updated: '2018-03-17T19:42:19.906Z',
                        classes: [{
                            class: 'happy',
                        }, {
                            class: 'sad',
                        }],
                        core_ml_enabled: true,
                    },
                    {
                        classifier_id: 'CarsvsTrucks_1479118188',
                        name: 'Cars vs Trucks',
                        status: 'ready',
                        owner: '99d0114d-9959-4071-b06f-654701909be4',
                        created: '2016-07-19T15:24:08.743Z',
                        updated: '2016-07-19T15:24:08.743Z',
                        classes: [{
                            class: 'cars',
                        }],
                        core_ml_enabled: false,
                    },
                ],
            });
        },
        deleteClassifier : (url: string) => {
            assert.strictEqual(url,
                'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' +
                validClassifier.classifierid);
            return Promise.resolve();
        },
    };


});
