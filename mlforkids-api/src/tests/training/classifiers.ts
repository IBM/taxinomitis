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
    const textProjectName = 'TEST_TEXT_PROJECT';

    const username = randomstring.generate(36);
    const password = randomstring.generate(12);

    const convCredentials = dbobjects.createBluemixCredentials(conv,
        CLASSID,
        undefined,
        username, password, 'conv_lite');


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




    describe('get unknown classifiers', () => {

        let getClassifiersStub: sinon.SinonStub<any, any>;

        before(async () => {
            getClassifiersStub = sinon.stub(request, 'get');
            getClassifiersStub
                .withArgs(sinon.match(/.*workspaces/), sinon.match.any)
                .callsFake(mockConversation.getClassifiers);

            await store.init();

            await store.storeBluemixCredentials(CLASSID, dbobjects.getCredentialsAsDbRow(convCredentials));

            await store.storeConversationWorkspace(convCredentials, textProject, validWorkspace);
        });

        after(async () => {
            getClassifiersStub.restore();

            await store.deleteBluemixCredentials(convCredentials.id);
            await store.deleteConversationWorkspace(validWorkspace.id);

            await store.disconnect();
        });


        it('should return unknown text classifiers for new classes', async () => {
            const tenant = await store.getClassTenant(uuid.v4());
            const unknowns = await classifiers.getUnknownTextClassifiers(tenant);
            assert.deepStrictEqual(unknowns, []);
        });

        it('should get a list of unknown text classifiers', async () => {
            const tenant = await store.getClassTenant(CLASSID);
            const unknowns = await classifiers.getUnknownTextClassifiers(tenant);
            assert.strictEqual(unknowns.length, 3);
            assert(unknowns.some((unknown) => unknown.name === 'First API test'));
            assert(unknowns.some((unknown) => unknown.name === 'Second API test'));
            assert(unknowns.some((unknown) => unknown.name === 'Third API test'));
        });

    });


    describe('delete classifier from Bluemix', () => {

        let deleteClassifiersStub: sinon.SinonStub<any, any>;

        before(async () => {
            deleteClassifiersStub = sinon.stub(request, 'delete');
            deleteClassifiersStub
                .withArgs(sinon.match(/.*workspaces\/.*/), sinon.match.any)
                .callsFake(mockConversation.deleteClassifier);
        });

        after(async () => {
            deleteClassifiersStub.restore();
        });


        it('should delete a text classifier', () => {
            return classifiers.deleteClassifier('conv', convCredentials, validWorkspace.workspace_id);
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

});
