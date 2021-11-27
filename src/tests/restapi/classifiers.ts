/*eslint-env mocha */
import * as assert from 'assert';
import * as express from 'express';
import * as sinon from 'sinon';
import * as uuid from 'uuid';
import * as request from 'request-promise';
import * as randomstring from 'randomstring';
import * as testRequest from 'supertest';
import * as httpstatus from 'http-status';



import * as dbobjects from '../../lib/db/objects';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';

import testapiserver from './testserver';



let testServer: express.Express;


describe('REST API - classifiers', () => {

    const CLASSID = uuid.v1();
    const USERID = uuid.v4();

    let authStub: sinon.SinonStub<any, any>;

    let nextAuth0Userid = 'studentid';
    let nextAuth0Role: 'student' | 'supervisor' = 'student';
    let nextAuth0Class = 'CLASSID';


    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : nextAuth0Userid,
            app_metadata : {
                role : nextAuth0Role,
                tenant : nextAuth0Class,
            },
        };
        next();
    }

    const conv: TrainingTypes.BluemixServiceType = 'conv';
    const textProjectName = 'TEST_TEXT_PROJECT';

    const username = randomstring.generate(36);
    const password = randomstring.generate(12);

    const convCredentials: TrainingTypes.BluemixCredentials = dbobjects.createBluemixCredentials(conv,
        CLASSID,
        undefined,
        username, password, 'conv_standard');
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





    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);

        await store.init();

        await store.storeBluemixCredentials(CLASSID, dbobjects.getCredentialsAsDbRow(convCredentials));

        await store.storeConversationWorkspace(convCredentials, textProject, validWorkspace);

        testServer = testapiserver();
    });


    after(async () => {
        authStub.restore();

        await store.deleteBluemixCredentials(convCredentials.id);
        await store.deleteConversationWorkspace(validWorkspace.id);

        return store.disconnect();
    });


    describe('get unknown classifiers', () => {

        let getClassifiersStub: sinon.SinonStub<any, any>;
        let getClassStub: sinon.SinonStub<[string], Promise<Types.ClassTenant>>;



        before(() => {
            getClassifiersStub = sinon.stub(request, 'get');
            getClassifiersStub
                .withArgs(sinon.match(/.*workspaces/), sinon.match.any)
                .callsFake(mockConversation.getClassifiers);
            getClassStub = sinon.stub(store, 'getClassTenant').callsFake(mockStore.getClassTenant);
        });

        after(() => {
            authStub.restore();
            getClassifiersStub.restore();
            getClassStub.restore();
        });



        it('should reject requests from managed classes', async () => {
            nextAuth0Userid = 'managed-user';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = 'managed';
            return testRequest(testServer)
                .get('/api/classes/' + CLASSID + '/classifiers')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

        it('should require requests for unmanaged classifiers only', async () => {
            nextAuth0Userid = USERID;
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .get('/api/classes/' + CLASSID + '/classifiers')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);
        });

        it('should reject requests for managed classifiers', async () => {
            nextAuth0Userid = USERID;
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .get('/api/classes/' + CLASSID + '/classifiers?type=managed')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);
        });

        it('should reject requests from students', async () => {
            nextAuth0Userid = USERID;
            nextAuth0Role = 'student';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .get('/api/classes/' + CLASSID + '/classifiers?type=unmanaged')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

        it('should reject requests about other classes', async () => {
            nextAuth0Userid = USERID;
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .get('/api/classes/' + 'WRONG' + '/classifiers?type=unmanaged')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

        it('should return a list of unmanaged classifiers', async () => {
            nextAuth0Userid = USERID;
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .get('/api/classes/' + CLASSID + '/classifiers?type=unmanaged')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((resp) => {
                    assert.strictEqual(resp.header['cache-control'], 'max-age=3600');

                    const allUnknowns = resp.body;

                    assert.strictEqual(allUnknowns.conv.length, 3);
                    assert(allUnknowns.conv.some((unknown: any) => unknown.name === 'First API test'));
                    assert(allUnknowns.conv.some((unknown: any) => unknown.name === 'Second API test'));
                    assert(allUnknowns.conv.some((unknown: any) => unknown.name === 'Third API test'));
                });
        });
    });



    describe('delete classifiers', () => {

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


        it('should reject requests from managed classes', async () => {
            nextAuth0Userid = 'managed-user';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = 'managed';
            return testRequest(testServer)
                .del('/api/classes/' + CLASSID + '/classifiers/classifierid')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

        it('should reject requests without credentials', async () => {
            nextAuth0Userid = 'managed-user';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .del('/api/classes/' + CLASSID + '/classifiers/' + validWorkspace.workspace_id +
                     '?type=conv')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);
        });

        it('should reject requests with missing credentials', async () => {
            nextAuth0Userid = 'managed-user';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .del('/api/classes/' + CLASSID + '/classifiers/classifierid' +
                     '?type=conv&credentialsid=' + 'DOESNOTEXIST')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);
        });

        it('should require valid class id', async () => {
            nextAuth0Userid = 'managed-user';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = 'DIFFERENT';
            return testRequest(testServer)
                .del('/api/classes/' + 'DIFFERENT' + '/classifiers/' + validWorkspace.workspace_id +
                     '?type=conv&credentialsid=' + convCredentials.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

        it('should delete text classifiers', async () => {
            nextAuth0Userid = 'managed-user';
            nextAuth0Role = 'supervisor';
            nextAuth0Class = CLASSID;
            return testRequest(testServer)
                .del('/api/classes/' + CLASSID + '/classifiers/' + validWorkspace.workspace_id +
                     '?type=conv&credentialsid=' + convCredentials.id)
                .expect(httpstatus.NO_CONTENT);
        });
    });


    const mockStore = {
        getClassTenant : (classid: string): Promise<Types.ClassTenant> => {
            const placeholder: Types.ClassTenant = {
                id : classid,
                supportedProjectTypes : [ 'text', 'images', 'numbers' ],
                tenantType : classid === 'managed' ? Types.ClassTenantType.Managed : Types.ClassTenantType.UnManaged,
                maxUsers : 15,
                maxProjectsPerUser : 3,
                textClassifierExpiry : 24,
            };
            return Promise.resolve(placeholder);
        },
    };

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
                'https://gateway.watsonplatform.net/' +
                'conversation/api/v1/workspaces/' +
                validWorkspace.workspace_id);
            return Promise.resolve();
        },
    };
});
