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
import * as visrec from '../../lib/training/visualrecognition';
import * as trainingtypes from '../../lib/training/training-types';
import testapiserver from './testserver';

let testServer: express.Express;


describe('REST API - image training for managed pool classes', () => {

    const userid = uuid();
    const classid = randomstring({ charset: 'alphabetic', length: 30 }).toLowerCase();

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;
    let requireSupervisorStub: sinon.SinonStub<any, any>;
    let getStub: sinon.SinonStub<[string, (requestPromise.RequestPromiseOptions | undefined)?, (requestLegacy.RequestCallback | undefined)?], requestPromise.RequestPromise>;
    let createStub: sinon.SinonStub<[string, (requestPromise.RequestPromiseOptions | undefined)?, (requestLegacy.RequestCallback | undefined)?], requestPromise.RequestPromise>;
    let deleteStub: sinon.SinonStub<[string,
        (requestPromise.RequestPromiseOptions | undefined)?,
        (requestLegacy.RequestCallback | undefined)?], requestPromise.RequestPromise>;

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

    const firstCredsApi = '1234567890123456789012345678901234567890';
    const secondCredsApi = '0123456789012345678901234567890123456789';

    let failCredsId: string;

    let firstCredsId: string;
    let secondCredsId: string;
    let firstProject: types.Project;
    let secondProject: types.Project;
    let thirdProject: types.Project;
    let workspaceId: string;

    function setupPoolCreds() {
        const firstCredsSvc = 'visrec';
        const firstCredsUser = undefined;
        const firstCredsPass = undefined;
        const firstCredsType = 'visrec_lite';
        const firstCredsNote = 'test img creds';

        const secondCredsSvc = 'visrec';
        const secondCredsUser = undefined;
        const secondCredsPass = undefined;
        const secondCredsType = 'visrec_lite';
        const secondCredsNote = 'additional img creds';

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
        const projType = 'images';

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
        const firstLabel = 'spider';
        const secondLabel = 'fly';

        const data: { imageurl: string, label: string}[] = [
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/0/04/2016.09.02.-11-Kaefertaler_Wald-Mannheim--Gartenkreuzspinne-Weibchen.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Wet_Spider_01_%28MK%29.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/0/08/2013.07.01-14-Wustrow-Neu_Drosedow-Erdbeerspinne-Maennchen.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/5/59/Araneus_diadematus_qtl1.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Araneus_diadematus_%28Clerck%2C_1757%29.JPG' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/6/67/Araneus_trifolium_and_its_web_with_fog_droplets_at_Twin_Peaks_in_San_Francisco.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Argiope_bruennichi_08Oct10.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/7/77/Argiope_bruennichi_QXGA.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/5/54/Argiope_lobata%2C_female._Villeveyrac_01.jpg' },
            { label : firstLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Argiope_July_2012-3.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/e/e4/2017.07.11.-04-Lindenberg_%28Tauche%29--Barbarossa-Fliege-Maennchen.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/d/d0/2017.06.18.-20-Viernheim--Barbarossa-Fliege-Weibchen.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/5/54/2015.07.16.-16-Viernheim--Grosse_Wolfsfliege-Weibchen.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/4/40/Schwarze_Habichtsfliege_Dioctria_atricapilla.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/4/46/2015.07.16.-02-Viernheim--Barbarossa-Fliege-Maennchen.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/c/ce/2015.07.16.-01-Viernheim--Barbarossa-Fliege-Maennchen.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Asilidae_by_kadavoor.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Asilidae_2_by_kadavoor.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/d/dc/Calliphora_hilli.jpg' },
            { label : secondLabel, imageurl : 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Unid_Brachycera_diagonal_20070604.jpg' },
        ];

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
                return store.bulkStoreImageTraining(firstProject.id, data);
            })
            .then(() => {
                return store.bulkStoreImageTraining(secondProject.id, data);
            })
            .then(() => {
                return store.bulkStoreImageTraining(thirdProject.id, data);
            });
    }

    let fakeTimer: sinon.SinonFakeTimers;

    before(async () => {
        fakeTimer = sinon.useFakeTimers({
            now : Date.now(),
            shouldAdvanceTime : true,
        });

        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        // @ts-ignore
        getStub = sinon.stub(requestPromise, 'get');
        // @ts-ignore
        getStub.withArgs(sinon.match(/https:\/\/gateway-a.watsonplatform.net\/visual-recognition\/api\/v3\/classifiers\/.*/), sinon.match.any).callsFake(getClassifier);
        getStub.callThrough();

        // @ts-ignore
        createStub = sinon.stub(requestPromise, 'post');
        // @ts-ignore
        createStub.withArgs(sinon.match('https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers'), sinon.match.any).callsFake(createClassifier);

        // @ts-ignore
        deleteStub = sinon.stub(requestPromise, 'delete').callsFake(deleteClassifier);

        await store.init();

        testServer = testapiserver();

        return store.deleteBluemixCredentialsPoolForTests()
            .then(() => {
                return store.storeManagedClassTenant(classid, 10, types.ClassTenantType.ManagedPool);
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
        // deleting a visual rec model will automatically retry
        //  after 20 minutes, so to stop mocha waiting 20 minutes
        //  for this, we skip the clock forward 30 minutes before
        //  ending the test
        fakeTimer.tick(1000 * 60 * 30);

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
        fakeTimer.restore();

        return store.disconnect();
    });




    describe('visualrecognition', () => {

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
                    assert.strictEqual(res.body.name, 'my_project_model');
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
                    assert.strictEqual(res.body[0].name, 'my_project_model');
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
                    assert.strictEqual(res.body.name, 'my_project_model');
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
                    assert.strictEqual(res.body.name, 'my_project_model');
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


        it('should delete a model', () => {
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
                });
        });

        it('should handle exhausted pool creds', async() => {
            failCredsId = 'all';

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
                .post('/api/classes/' + classid + '/students/' + userid + '/projects/' + thirdProject.id + '/models')
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT)
                .then(async (res) => {
                    assert.deepStrictEqual(res.body, {
                        code: 'MLMOD06',
                        error: 'Your class already has created their maximum allowed number of models. ' +
                               'Please let your teacher or group leader know that their "Watson Visual Recognition ' +
                               'API keys have no more classifiers available"',
                    });

                    first = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, firstCredsId);
                    second = await store.getBluemixCredentialsById(types.ClassTenantType.ManagedPool, secondCredsId);

                    firstCredsCheck = first as trainingtypes.BluemixCredentialsPool;
                    secondCredsCheck = second as trainingtypes.BluemixCredentialsPool;

                    assert(firstCredsCheck.lastfail.getTime() > timestamp);
                    assert(secondCredsCheck.lastfail.getTime() > timestamp);
                });
        });

    });


    const getClassifier = (url: string/*, options: express.Request */) => {
        assert(url.endsWith(workspaceId), url + ' should end with ' + workspaceId);

        const classifierDate = new Date();
        classifierDate.setMilliseconds(0);

        return new Promise((resolve) => {
            resolve({
                classifier_id : 'good',
                name : 'my_project_model',
                owner : 'bob',
                status : 'ready',
                created : classifierDate.toISOString(),
                classes : [
                    { class : 'rock' },
                    { class : 'paper' },
                ],
            });
        });
    };

    const createClassifier = (url: string, options: visrec.LegacyTrainingRequest) => {
        return new Promise((resolve, reject) => {
            assert(url);
            assert(options.formData);

            if (failCredsId === 'all') {
                return reject({
                    error : {
                        error :  {
                            description : 'Cannot execute learning task. : this plan instance can have only 1 custom classifier(s), and 1 already exist.',
                            code : 400,
                            error_id : 'input_error',
                        },
                    },
                    statusCode : 400,
                    status : 400,
                });
            }
            if (options.formData.name === 'my other project') {
                if (failCredsId === 'neither') {
                    if (options.qs.api_key === firstCredsApi) {
                        failCredsId = firstCredsId;
                    }
                    else if (options.qs.api_key === secondCredsApi) {
                        failCredsId = secondCredsId;
                    }
                    else {
                        assert.fail('Unexpected credentials');
                    }
                    return reject({
                        error : {
                            error :  {
                                description : 'Cannot execute learning task. : this plan instance can have only 1 custom classifier(s), and 1 already exist.',
                                code : 400,
                                error_id : 'input_error',
                            },
                        },
                        statusCode : 400,
                        status : 400,
                    });
                }
                else {
                    if (options.qs.api_key === firstCredsApi) {
                        assert.strictEqual(failCredsId, secondCredsId);
                    }
                    else if (options.qs.api_key === secondCredsApi) {
                        assert.strictEqual(failCredsId, firstCredsId);
                    }
                    else {
                        assert.fail('Unexpected credentials');
                    }

                    const classifierDate = new Date();
                    classifierDate.setMilliseconds(0);
                    workspaceId = uuid();
                    return resolve({
                        classifier_id : workspaceId,
                        name : 'my_project_model',
                        owner : 'bob',
                        status : 'training',
                        created : classifierDate.toISOString(),
                        classes : [
                            { class : 'spider' },
                            { class : 'fly' },
                        ],
                    });
                }
            }

            const newClassifierDate = new Date();
            newClassifierDate.setMilliseconds(0);
            workspaceId = uuid();

            resolve({
                classifier_id : workspaceId,
                name : 'my_project_model',
                owner : 'bob',
                status : 'training',
                created : newClassifierDate.toISOString(),
                classes : [
                    { class : 'spider' },
                    { class : 'fly' },
                ],
            });
        });
    };
    const deleteClassifier = (url: string) => {
        assert(url);
        return Promise.resolve();
    };


    const wait = () => {
        return new Promise((resolve) => {
            setTimeout(resolve, 500);
        });
    };
});
