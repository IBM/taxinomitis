/*eslint-env mocha */

import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as express from 'express';
import * as sinon from 'sinon';
import * as IBMCosSDK from 'ibm-cos-sdk';
import * as request from 'supertest';
import * as httpStatus from 'http-status';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as objectstore from '../../lib/objectstore';
import { MAX_AUDIO_POINTS } from '../../lib/restapi/sounds/uploads';
import * as mock from '../imagestore/mockStore';
import testapiserver from './testserver';



let testServer: express.Express;

describe('REST API - sound uploads', () => {

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;
    let requireSupervisorStub: sinon.SinonStub<any, any>;

    const TESTCLASS = 'TESTCLASS';

    let NEXT_USERID = 'studentid';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : NEXT_USERID,
            app_metadata : {},
        };
        next();
    }


    let oldEnvCreds: string | undefined;
    let oldEnvBucket: string | undefined;

    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        oldEnvCreds = process.env.OBJECT_STORE_CREDS;
        oldEnvBucket = process.env.OBJECT_STORE_BUCKET;

        process.env.OBJECT_STORE_CREDS = JSON.stringify({
            endpoint : 'localhost:9999',
            apiKeyId : 'myApiKey',
            ibmAuthEndpoint : 'https://iam.ng.bluemix.net/oidc/token',
            serviceInstanceId : 'uniqServInstanceId',
        });
        process.env.OBJECT_STORE_BUCKET = 'TESTBUCKET';

        await store.init();

        testServer = testapiserver();
    });


    after(async () => {
        process.env.OBJECT_STORE_CREDS = oldEnvCreds;
        process.env.OBJECT_STORE_BUCKET = oldEnvBucket;

        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        await store.deleteProjectsByClassId(TESTCLASS);

        return store.disconnect();
    });


    let cosStub: sinon.SinonStub;

    beforeEach(() => {
        mock.reset();
        cosStub = sinon.stub(IBMCosSDK, 'S3');
        cosStub.returns(mock.mockS3);
        objectstore.init();

        NEXT_USERID = 'studentid';
    });
    afterEach(() => {
        cosStub.restore();
    });





    describe('invalid uploads', () => {

        let projectid = '';

        before(() => {
            return store.storeProject('studentid', TESTCLASS, 'sounds', 'invalids', 'en', [], false)
                .then((proj) => {
                    projectid = proj.id;
                    return store.addLabelToProject('studentid', TESTCLASS, projectid, 'KNOWN');
                });
        });

        it('should require a valid project', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/studentid/projects/NOTAREALPROJECT/sounds')
                .expect(httpStatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Not found' });
                });
        });

        it('should require data', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/studentid/projects/' + projectid + '/sounds')
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Audio label not provided' });
                });
        });

        it('should require audio data', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/studentid/projects/' + projectid + '/sounds')
                .send({ label : 'KNOWN' })
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });

        it('should require a label', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/studentid/projects/' + projectid + '/sounds')
                .send({ data : [ 1, 2, 3, 4 ]})
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Audio label not provided' });
                });
        });

        it('should only support sound projects', async () => {
            const project = await store.storeProject('studentid', TESTCLASS, 'text', 'invalid', 'en', [], false);
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/studentid/projects/' + project.id + '/sounds')
                .send({ label : 'label', data : [ 1, 2, 3 ]})
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Only sounds projects allow sound uploads' });
                });
        });

        it('should require a known label', () => {
            return request(testServer)
                .post('/api/classes/' + TESTCLASS + '/students/studentid/projects/' + projectid + '/sounds')
                .send({ label : 'MYSTERY', data : [ 1, 2, 3 ]})
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Unrecognised label' });
                });
        });
    });


    describe('valid uploads', () => {
        it('should upload test data', async () => {
            const USER = 'TESTSTUDENT';
            const LABEL = 'testlabel';
            const project = await store.storeProject(USER, TESTCLASS, 'sounds', 'test uploads', 'en', [], false);
            await store.addLabelToProject(USER, TESTCLASS, project.id, LABEL);

            const SOUNDSURL = '/api/classes/' + TESTCLASS +
                                '/students/' + USER +
                                '/projects/' + project.id +
                                '/sounds';

            NEXT_USERID = USER;

            const numbers: number[] = [];
            for (let i = 0; i < 10000; i++) {
                numbers.push(Math.random());
            }

            return request(testServer)
                .post(SOUNDSURL)
                .send({ label : LABEL, data : numbers })
                .expect(httpStatus.CREATED)
                .then((res) => {
                    assert(res.body.id);

                    assert.strictEqual(res.body.label, LABEL);
                    assert.strictEqual(res.body.projectid, project.id);


                    assert.strictEqual(res.body.audiourl, SOUNDSURL + '/' + res.body.id);

                    assert(res.header.etag);

                    return store.deleteTraining('sounds', 'TESTPROJECT', res.body.id);
                });
        });


        it('should store very large audio training', async () => {
            const USER = 'TESTSTUDENT';
            const project = await store.storeProject(USER, TESTCLASS, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USER, TESTCLASS, project.id, 'fruit');
            await store.addLabelToProject(USER, TESTCLASS, project.id, 'SECOND');
            const projectid = project.id;

            const trainingurl = '/api/classes/' + TESTCLASS +
                                '/students/' + USER +
                                '/projects/' + projectid +
                                '/sounds';

            NEXT_USERID = USER;

            const numbers: number[] = [];
            for (let i = 0; i < MAX_AUDIO_POINTS; i++) {
                numbers.push(1234567890.01234567890123456789);
            }

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : numbers,
                    label : 'fruit',
                })
                .expect(httpStatus.CREATED)
                .then(() => {
                    return store.deleteEntireUser(USER, TESTCLASS);
                });
        });

    });



    describe('invalid downloads', () => {

        let projectid = '';

        before(() => {
            return store.storeProject('studentid', TESTCLASS, 'sounds', 'invalids', 'en', [], false)
                .then((proj) => {
                    projectid = proj.id;
                });
        });

        it('should handle non-existent images', () => {
            return request(testServer)
                .get('/api/classes/' + TESTCLASS + '/students/studentid/projects/' + projectid + '/sounds/anaudioid')
                .expect(httpStatus.NOT_FOUND)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'File not found' });
                });
        });
    });



    describe('valid downloads', () => {

        it('should download a file', async () => {
            let id;
            const userid = uuid();

            const testdata: number[] = [];
            for (let i = 0; i < 19000; i++) {
                testdata.push(Math.random());
            }

            const project = await store.storeProject(userid, TESTCLASS, 'sounds', 'valid', 'en', [], false);
            const projectid = project.id;

            const label = 'testlabel';
            await store.addLabelToProject(userid, TESTCLASS, projectid, label);

            NEXT_USERID = userid;

            const soundsurl = '/api/classes/' + TESTCLASS +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/sounds';

            await request(testServer)
                .post(soundsurl)
                .send({ label, data : testdata })
                .expect(httpStatus.CREATED)
                .then((res) => {
                    assert(res.body.id);
                    id = res.body.id;

                    assert.strictEqual(res.body.projectid, projectid);
                    assert.strictEqual(res.body.audiourl, soundsurl + '/' + id);
                });

            await request(testServer)
                .get(soundsurl + '/' + id)
                .expect(httpStatus.OK)
                .expect('Content-Type', /json/)
                .then((res) => {
                    assert.deepStrictEqual(res.body, testdata);
                    assert.strictEqual(res.header['cache-control'], 'max-age=31536000');
                });

            if (id) {
                return store.deleteTraining('sounds', projectid, id);
            }
        });


        it('should download sound training details using a Scratch key', async () => {
            let id = 'placeholder';
            const userid = uuid();

            const testdata: number[] = [];
            for (let i = 0; i < 19000; i++) {
                testdata.push(Math.random());
            }

            const project = await store.storeProject(userid, TESTCLASS, 'sounds', 'valid', 'en', [], false);
            const projectid = project.id;

            const label = 'testlabel';
            await store.addLabelToProject(userid, TESTCLASS, projectid, label);

            NEXT_USERID = userid;

            const soundsurl = '/api/classes/' + TESTCLASS +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/sounds';

            await request(testServer)
                .post(soundsurl)
                .send({ label, data : testdata })
                .expect(httpStatus.CREATED)
                .then((res) => {
                    assert(res.body.id);
                    id = res.body.id;

                    assert.strictEqual(res.body.projectid, projectid);
                    assert.strictEqual(res.body.audiourl, soundsurl + '/' + id);
                });

            const scratchKey = await store.storeUntrainedScratchKey(project);

            await request(testServer)
                .get('/api/scratch/' + scratchKey + '/train')
                .expect(httpStatus.OK)
                .expect('Content-Type', /json/)
                .then((res) => {
                    const body = res.body;
                    assert(Array.isArray(body));
                    assert.strictEqual(body.length, 1);
                    assert.strictEqual(body[0].id, id);
                    assert.strictEqual(body[0].label, label);
                    assert.strictEqual(body[0].audiourl, soundsurl + '/' + id);
                    assert.deepStrictEqual(body[0].audiodata, testdata);
                    assert.strictEqual(res.header['cache-control'], 'max-age=120');
                });

            return store.deleteTraining('sounds', projectid, id);
        });

    });

});
