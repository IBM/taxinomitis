/*eslint-env mocha */
import * as assert from 'assert';
import { v4 as uuid } from 'uuid';
import { generate as randomstring } from 'randomstring';
import * as request from 'supertest';
import * as requestPromise from 'request-promise';
import * as requestLegacy from 'request';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as types from '../../lib/db/db-types';
import * as dbobjects from '../../lib/db/objects';
import * as auth from '../../lib/restapi/auth';
import * as conversation from '../../lib/training/conversation';
import * as trainingtypes from '../../lib/training/training-types';
import { FIFTY_MINUTES } from '../../lib/utils/constants';
import testapiserver from './testserver';



let testServer: express.Express;


describe('REST API - text training for managed pool classes', () => {

    const userid = uuid();
    const classid = randomstring({ charset: 'alphabetic', length: 30 }).toLowerCase();

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;
    let requireSupervisorStub: sinon.SinonStub<any, any>;
    let getStub: sinon.SinonStub<[string, (requestPromise.RequestPromiseOptions | undefined)?, (requestLegacy.RequestCallback | undefined)?], requestPromise.RequestPromise>;
    let createStub: sinon.SinonStub<[string, (requestPromise.RequestPromiseOptions | undefined)?, (requestLegacy.RequestCallback | undefined)?], requestPromise.RequestPromise>;
    let deleteStub: sinon.SinonStub<[string, (requestPromise.RequestPromiseOptions | undefined)?, (requestLegacy.RequestCallback | undefined)?], requestPromise.RequestPromise>;



    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : userid,
            app_metadata : {
                tenant : classid,
                role : 'student',
            },
        };
        next();
    }

    const firstCredsUser = '33333333-1111-2222-3333-444444444444';
    const secondCredsUser = '11111111-2222-3333-4444-555566667777';

    let firstCredsId: string;
    let secondCredsId: string;
    let firstProject: types.Project;
    let secondProject: types.Project;
    let thirdProject: types.Project;
    let workspaceId: string;

    function setupPoolCreds() {
        const firstCredsSvc = 'conv';
        const firstCredsApi = undefined;
        const firstCredsPass = '56789abcdef0';
        const firstCredsType = 'conv_lite';
        const firstCredsNote = 'test creds';

        const secondCredsSvc = 'conv';
        const secondCredsApi = undefined;
        const secondCredsPass = '89abcdef0123';
        const secondCredsType = 'conv_lite';
        const secondCredsNote = 'additional creds';

        const firstCreds = dbobjects.createBluemixCredentialsPool(firstCredsSvc, firstCredsApi, firstCredsUser, firstCredsPass, firstCredsType);
        firstCreds.notes = firstCredsNote;
        firstCredsId = firstCreds.id;
        const firstCredsObj = dbobjects.getCredentialsPoolAsDbRow(firstCreds);

        const secondCreds = dbobjects.createBluemixCredentialsPool(secondCredsSvc, secondCredsApi, secondCredsUser, secondCredsPass, secondCredsType);
        secondCreds.notes = secondCredsNote;
        secondCredsId = secondCreds.id;
        const secondCredsObj = dbobjects.getCredentialsPoolAsDbRow(secondCreds);

        return store.storeBluemixCredentialsPool(firstCredsObj)
            .then(() => {
                return store.storeBluemixCredentialsPool(secondCredsObj);
            });
    }

    function setupProjects() {
        const firstProjectName = 'my project';
        const secondProjectName = 'my other project';
        const thirdProjectName = 'my final project';
        const projType = 'text';

        return store.storeProject(userid, classid, projType, firstProjectName, 'en', [], false)
            .then((proj) => {
                firstProject = proj;
                return store.storeProject(userid, classid, projType, secondProjectName, 'en', [], false);
            })
            .then((proj) => {
                secondProject = proj;
                return store.storeProject(userid, classid, projType, thirdProjectName, 'en', [], false);
            })
            .then((proj) => {
                thirdProject = proj;
            });
    }

    function setupTrainingData() {
        const firstLabel = randomstring(8);
        const secondLabel = randomstring(6);

        const data: { textdata: string, label: string}[] = [];

        for (let text = 0; text < 10; text++) {
            data.push({ textdata : randomstring(30), label : firstLabel });
            data.push({ textdata : randomstring(30), label : secondLabel });
        }

        return store.addLabelToProject(userid, classid, firstProject.id, firstLabel)
            .then(() => {
                return store.addLabelToProject(userid, classid, secondProject.id, firstLabel);
            })
            .then(() => {
                return store.addLabelToProject(userid, classid, thirdProject.id, firstLabel);
            })
            .then(() => {
                return store.addLabelToProject(userid, classid, firstProject.id, secondLabel);
            })
            .then(() => {
                return store.addLabelToProject(userid, classid, secondProject.id, secondLabel);
            })
            .then(() => {
                return store.addLabelToProject(userid, classid, thirdProject.id, secondLabel);
            })
            .then(() => {
                return store.bulkStoreTextTraining(firstProject.id, data);
            })
            .then(() => {
                return store.bulkStoreTextTraining(secondProject.id, data);
            })
            .then(() => {
                return store.bulkStoreTextTraining(thirdProject.id, data);
            });
    }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        // @ts-ignore
        getStub = sinon.stub(requestPromise, 'get');
        // @ts-ignore
        getStub.withArgs(sinon.match(/https:\/\/gateway.watsonplatform.net\/conversation\/api\/v1\/workspaces\/.*/), sinon.match.any).callsFake(getClassifier);
        getStub.callThrough();

        // @ts-ignore
        createStub = sinon.stub(requestPromise, 'post');
        // @ts-ignore
        createStub.withArgs(sinon.match('https://gateway.watsonplatform.net/conversation/api/v1/workspaces'), sinon.match.any).callsFake(createClassifier);

        // @ts-ignore
        deleteStub = sinon.stub(requestPromise, 'delete').callsFake(deleteClassifier);

        await store.init();

        testServer = testapiserver();

        return store.deleteBluemixCredentialsPoolForTests()
            .then(() => {
                return store.storeManagedClassTenant(classid, 10, 3, types.ClassTenantType.ManagedPool);
            })
            .then(() => {
                return setupPoolCreds();
            })
            .then(() => {
                return setupProjects();
            })
            .then(() => {
                return setupTrainingData();
            });
    });

    after(async () => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        await store.deleteEntireProject(userid, classid, firstProject);
        await store.deleteEntireProject(userid, classid, secondProject);
        await store.deleteEntireProject(userid, classid, thirdProject);
        await store.deleteClassTenant(classid);
        await store.deleteBluemixCredentialsPool(firstCredsId);
        await store.deleteBluemixCredentialsPool(secondCredsId);

        getStub.restore();
        createStub.restore();
        deleteStub.restore();

        return store.disconnect();
    });



    describe('conversation', () => {

        it('should train a model', () => {
            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + firstProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    assert(res.body.classifierid);
                    assert(res.body.updated);
                    assert(res.body.expiry);
                    assert(new Date(res.body.updated).getTime() < new Date(res.body.expiry).getTime());
                    assert(res.body.credentialsid === firstCredsId || res.body.credentialsid === secondCredsId);
                    assert.strictEqual(res.body.name, 'my project');
                    assert.strictEqual(res.body.status, 'Training');
                });
        });

        it('should get a model status', () => {
            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + firstProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert.strictEqual(res.body.length, 1);
                    assert(res.body[0].classifierid);
                    assert(res.body[0].updated);
                    assert(res.body[0].expiry);
                    assert(res.body[0].credentialsid === firstCredsId || res.body[0].credentialsid === secondCredsId);
                    assert.strictEqual(res.body[0].name, 'my project');
                    assert.strictEqual(res.body[0].status, 'Available');
                });
        });

        it('should update a model', () => {
            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + firstProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((res) => {
                    assert(res.body.classifierid);
                    assert(res.body.updated);
                    assert(res.body.expiry);
                    assert(new Date(res.body.updated).getTime() < new Date(res.body.expiry).getTime());
                    assert(res.body.credentialsid === firstCredsId || res.body.credentialsid === secondCredsId);
                    assert.strictEqual(res.body.name, 'my project');
                    assert.strictEqual(res.body.status, 'Training');
                });
        });

        it('should record failures', async () => {
            failCredsId = 'neither';

            await wait();
            const timestamp = new Date().getTime();
            await wait();

            let first = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, firstCredsId);
            let second = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, secondCredsId);

            let firstCredsCheck = first as trainingtypes.BluemixCredentialsPool;
            let secondCredsCheck = second as trainingtypes.BluemixCredentialsPool;

            const firstCredsCheckTime = firstCredsCheck.lastfail.getTime();
            const secondCredsCheckTime = secondCredsCheck.lastfail.getTime();

            assert(firstCredsCheckTime < timestamp);
            assert(secondCredsCheckTime < timestamp);

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + secondProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then(async (res) => {
                    assert(res.body.classifierid);
                    assert(res.body.updated);
                    assert(res.body.expiry);
                    assert(new Date(res.body.updated).getTime() < new Date(res.body.expiry).getTime());
                    assert(res.body.credentialsid === firstCredsId || res.body.credentialsid === secondCredsId);
                    assert(res.body.credentialsid !== failCredsId);
                    assert.strictEqual(res.body.name, 'my other project');
                    assert.strictEqual(res.body.status, 'Training');

                    first = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, firstCredsId);
                    second = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, secondCredsId);

                    firstCredsCheck = first as trainingtypes.BluemixCredentialsPool;
                    secondCredsCheck = second as trainingtypes.BluemixCredentialsPool;

                    if (failCredsId === firstCredsId) {
                        assert(firstCredsCheck.lastfail.getTime() > timestamp);
                        assert(secondCredsCheck.lastfail.getTime() === secondCredsCheckTime);
                    }
                    else if (failCredsId === secondCredsId) {
                        assert(secondCredsCheck.lastfail.getTime() > timestamp);
                        assert(firstCredsCheck.lastfail.getTime() === firstCredsCheckTime);
                    }
                    else {
                        assert.fail('No credentials recorded failure');
                    }
                });
        });


        it('should delete a model', async () => {
            const models = await store.getConversationWorkspaces(secondProject.id);
            const credentialsUsedId = models[0].credentialsid;
            const credentialsUsed = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, credentialsUsedId);
            const credentialsTimestamp = (credentialsUsed as trainingtypes.BluemixCredentialsPool).lastfail.getTime();

            return request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + secondProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    assert.strictEqual(res.body.length, 1);
                    return request(testServer)
                        .delete('/api/classes/' + classid + '/students/' + userid + '/projects/' + secondProject.id + '/models/' + res.body[0].classifierid)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + secondProject.id + '/models')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    assert.strictEqual(res.body.length, 0);
                    return store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, credentialsUsedId);
                })
                .then((updatedCreds) => {
                    // check that the timestamp for the credentials was updated to reflect the credentials
                    //  have freed up space for another model now
                    const newTimestamp = (updatedCreds as trainingtypes.BluemixCredentialsPool).lastfail.getTime();
                    assert(newTimestamp < (credentialsTimestamp - FIFTY_MINUTES));
                });
        });

        it('should handle exhausted pool creds', async() => {
            failCredsId = 'all';

            let first = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, firstCredsId);
            let second = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, secondCredsId);

            let firstCredsCheck = first as trainingtypes.BluemixCredentialsPool;
            let secondCredsCheck = second as trainingtypes.BluemixCredentialsPool;

            const firstCredsCheckTime = firstCredsCheck.lastfail.getTime();
            const secondCredsCheckTime = secondCredsCheck.lastfail.getTime();

            return request(testServer)
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + thirdProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT)
                .then(async (res) => {
                    assert.deepStrictEqual(res.body, {
                        code: 'MLMOD15',
                        error: 'Your class is sharing Watson Assistant "API keys" with many other schools, and ' +
                                'unfortunately there are currently none available. ' +
                                'Please let your teacher or group leader know that you will have to train ' +
                                'your machine learning model later',
                    });

                    first = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, firstCredsId);
                    second = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, secondCredsId);

                    firstCredsCheck = first as trainingtypes.BluemixCredentialsPool;
                    secondCredsCheck = second as trainingtypes.BluemixCredentialsPool;

                    assert(firstCredsCheck.lastfail.getTime() > firstCredsCheckTime);
                    assert(secondCredsCheck.lastfail.getTime() > secondCredsCheckTime);

                    // more than one day
                    assert(firstCredsCheck.lastfail.getTime() > (firstCredsCheckTime + 86400000));
                    assert(secondCredsCheck.lastfail.getTime() > (secondCredsCheckTime + 86400000));
                    // less than two days
                    assert(firstCredsCheck.lastfail.getTime() < (firstCredsCheckTime + 172800000));
                    assert(secondCredsCheck.lastfail.getTime() < (secondCredsCheckTime + 172800000));
                });
        });
    });



    const wait = () => {
        return new Promise((resolve) => {
            setTimeout(resolve, 500);
        });
    };


    let failCredsId = '';

    const getClassifier = (url: string/*, options: express.Request */) => {
        assert(url.endsWith(workspaceId), url + ' should end with ' + workspaceId);

        const classifierDate = new Date();
        classifierDate.setMilliseconds(0);

        return new Promise((resolve) => {
            resolve({
                name : 'name',
                language : 'en',
                metadata : null,
                description : null,
                workspace_id : workspaceId,
                status : 'Available',
                created : classifierDate.toISOString(),
                updated : classifierDate.toISOString(),
            });
        });
    };

    const createClassifier = (url: string, options: conversation.LegacyTrainingRequest) => {
        return new Promise((resolve, reject) => {
            if (failCredsId === 'all') {
                return reject({
                    error : {
                        error : 'Maximum workspaces limit exceeded. Limit = 5',
                        code : 400,
                    },
                });
            }

            if (options.body.name === 'my other project')
            {
                if (failCredsId === 'neither') {
                    if (options.auth.user === firstCredsUser) {
                        failCredsId = firstCredsId;
                    }
                    else if (options.auth.user === secondCredsUser) {
                        failCredsId = secondCredsId;
                    }
                    else {
                        assert.fail('Unexpected credentials');
                    }
                    return reject({
                        error : {
                            error : 'Maximum workspaces limit exceeded. Limit = 5',
                            code : 400,
                        },
                    });
                }
                else {
                    if (options.auth.user === firstCredsUser) {
                        assert.strictEqual(failCredsId, secondCredsId);
                    }
                    else if (options.auth.user === secondCredsUser) {
                        assert.strictEqual(failCredsId, firstCredsId);
                    }
                    else {
                        assert.fail('Unexpected credentials');
                    }

                    const classifierDate = new Date();
                    classifierDate.setMilliseconds(0);
                    workspaceId = uuid();
                    return resolve({
                        name : options.body.name,
                        created : classifierDate.toISOString(),
                        updated : classifierDate.toISOString(),
                        language : options.body.language,
                        metadata : null,
                        description : null,
                        workspace_id : workspaceId,
                    });
                }
            }

            const newClassifierDate = new Date();
            newClassifierDate.setMilliseconds(0);
            workspaceId = uuid();
            resolve({
                name : options.body.name,
                created : newClassifierDate.toISOString(),
                updated : newClassifierDate.toISOString(),
                language : options.body.language,
                metadata : null,
                description : null,
                workspace_id : workspaceId,
            });
        });
    };
    const deleteClassifier = (/*url: string*/) => {
        return Promise.resolve();
    };
});
