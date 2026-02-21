import { describe, it, before, after, beforeEach } from 'node:test';
import { promisify } from 'node:util';
import * as fs from 'fs';
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import * as filecompare from 'filecompare';
import * as tmp from 'tmp';
import { status as httpstatus } from 'http-status';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as limits from '../../lib/db/limits';
import * as auth from '../../lib/restapi/auth';
import * as imageCheck from '../../lib/utils/imageCheck';
import * as visrec from '../../lib/training/visualrecognition';
import * as requestUtil from '../../lib/utils/request';
import testapiserver from './testserver';



let testServer: express.Express;


describe('REST API - training', () => {

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;
    let requireSupervisorStub: sinon.SinonStub<any, any>;

    let numbersTrainingServicePostStub: sinon.SinonStub<any, any>;
    let numbersTrainingServiceDeleteStub: sinon.SinonStub<any, any>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole: 'student' | 'supervisor' = 'student';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : nextAuth0UserId,
            app_metadata : {
                tenant : nextAuth0UserTenant,
                role : nextAuth0UserRole,
            },
        };
        next();
    }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        numbersTrainingServicePostStub = sinon.stub(requestUtil, 'post').callsFake(stubbedRequestPost);
        numbersTrainingServiceDeleteStub = sinon.stub(requestUtil, 'del').callsFake(stubbedRequestDelete);

        await store.init();

        testServer = testapiserver();
    });

    beforeEach(() => {
        nextAuth0UserId = 'userid';
        nextAuth0UserTenant = 'classid';
        nextAuth0UserRole = 'student';

        imageCheck.init();
    });


    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        numbersTrainingServicePostStub.restore();
        numbersTrainingServiceDeleteStub.restore();

        return store.disconnect();
    });


    describe('getLabels()', () => {

        it('should verify project exists', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();

            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });


        it('should fetch empty training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {});

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .get('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should get text training labels', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;
            await store.addLabelToProject(userid, classid, projectid, 'fruit');
            await store.addLabelToProject(userid, classid, projectid, 'vegetable');
            await store.addLabelToProject(userid, classid, projectid, 'meat');

            await store.storeTextTraining(projectid, 'apple', 'fruit');
            await store.storeTextTraining(projectid, 'banana', 'fruit');
            await store.storeTextTraining(projectid, 'tomato', 'vegetable');
            await store.storeTextTraining(projectid, 'cabbage', 'vegetable');
            await store.storeTextTraining(projectid, 'potato', 'vegetable');
            await store.storeTextTraining(projectid, 'beef', 'meat');

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                fruit : 2, vegetable : 3, meat : 1,
            });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should get numbers training labels', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'a', type : 'number' },
            ], false);
            const projectid = project.id;
            await store.addLabelToProject(userid, classid, projectid, 'fruit');
            await store.addLabelToProject(userid, classid, projectid, 'vegetable');

            await store.storeNumberTraining(projectid, false, [1], 'fruit');
            await store.storeNumberTraining(projectid, false, [2], 'vegetable');
            await store.storeNumberTraining(projectid, false, [3], 'vegetable');
            await store.storeNumberTraining(projectid, false, [4], 'vegetable');

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, {
                fruit : 1, vegetable : 3,
            });

            await store.deleteEntireProject(userid, classid, project);
        });
    });


    describe('storeTraining()', () => {

        it('should verify project exists', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();

            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/training')
                .send({ data : 'abc' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });

        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/training')
                .send({ data : 'abc' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireUser(userid, classid);
        });


        it('should require text data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should reject empty text data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                    data : '    ',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Empty text is not allowed' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should require numeric data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'x', type : 'number' },
            ], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should require non-empty numeric data in training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'x', type : 'number' },
            ], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    label : 'nothing-to-label',
                    data : [],
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should limit maximum length of text training data', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : randomstring.generate({ length : 1100 }),
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Text exceeds maximum allowed length (1024 characters)' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should limit maximum number of numeric training data', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'one', type : 'number' }, { name : 'two', type : 'number' },
                { name : 'three', type : 'number' },
            ], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should store numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'first', type : 'number' }, { name : 'second', type : 'number' },
                { name : 'third', type : 'number' },
            ], false);

            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post(trainingurl)
                .send({
                    data : [1, 2, 3],
                    label : 'fruit',
                })
                .expect(httpstatus.CREATED);

            await store.deleteEntireUser(userid, classid);
        });


        it('should reject missing numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'first', type : 'number' }, { name : 'second', type : 'number' },
                { name : 'third', type : 'number' },
            ], false);

            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : [1, 2, ' '],
                    label : 'fruit',
                })
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error : 'Data contains non-numeric items',
            });
        });


        it('should reject huge numbers in numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'first', type : 'number' },
            ], false);

            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : [350000000000000000000000000000000000000],
                    label : 'fruit',
                })
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error : 'Number is too big',
            });
        });

        it('should reject tiny numbers in numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'first', type : 'number' },
            ], false);

            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : [-350000000000000000000000000000000000000],
                    label : 'fruit',
                })
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error : 'Number is too small',
            });
        });


        it('should reject image training that is not a URL', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'not a valid url',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error: 'Not a valid web address' });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should reject image training that is not an image', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'http://info.cern.ch/hypertext/WWW/TheProject.html',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error: 'Unsupported file type (unknown). Only jpg and png images are supported.',
            });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should reject image training that is too big', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const reduceMaxFileSize = sinon.stub(visrec, 'getMaxImageFileSize').returns(1000);

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'https://www.w3.org/html/logo/downloads/HTML5_Logo_128.png',
                    label : 'test',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            reduceMaxFileSize.restore();

            assert.deepStrictEqual({
                error : 'Image file size (1.43 kB) is too big. Please choose images smaller than 1 kB',
            }, res.body);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should store image training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'https://www.w3.org/html/logo/downloads/HTML5_Logo_128.png',
                    label : 'test',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const getRes = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.length, 1);
            assert.strictEqual(getRes.body[0].label, 'test');
            assert.strictEqual(getRes.body[0].imageurl, 'https://www.w3.org/html/logo/downloads/HTML5_Logo_128.png');
            assert.strictEqual(getRes.body[0].isstored, false);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should store number training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'first', type : 'number' },
            ], false);

            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : [1234],
                    label : 'fruit',
                })
                .expect(httpstatus.CREATED);

            assert.deepStrictEqual(res.body.numberdata[0], 1234);
        });

        it('should store text training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'apple',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const getRes = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.length, 1);
            assert.strictEqual(getRes.header['content-range'], 'items 0-0/1');

            assert.strictEqual(getRes.body[0].textdata, 'apple');
            assert.strictEqual(getRes.body[0].label, 'fruit');

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should handle auth errors when storing image training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'https://lh4.googleusercontent.com/ytIqqhmtwSe-0fG_' +
                           'cTnOIz4ZAQAjtbD1OcaGQ9wZ5ELUBdbie0lkivWjbSw6BCiw1sRvKUI=w371',
                    label : 'test',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, {
                error : 'lh4.googleusercontent.com would not allow ' +
                        '"Machine Learning for Kids" to use that image',
            });

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should enforce limits', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            await store.storeTextTraining(projectid, uuid(), 'label');
            await store.storeTextTraining(projectid, uuid(), 'label');

            const limitsStub = sinon.stub(limits, 'getStoreLimits');
            limitsStub.returns({
                textTrainingItemsPerProject : 2,
                numberTrainingItemsPerProject : 2,
                numberTrainingItemsPerClassProject : 2,
                imageTrainingItemsPerProject : 100,
                soundTrainingItemsPerProject : 50,
            });

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .post(trainingurl)
                .send({
                    data : 'apple',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.deepStrictEqual(res.body, {
                error: 'Project already has maximum allowed amount of training data',
            });

            limitsStub.restore();

            await store.deleteEntireProject(userid, classid, project);
        });
    });



    describe('editLabel()', () => {

        it('should verify request', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'one', type : 'number' }, { name : 'two', type : 'number' },
            ], false);
            const projectid = project.id;

            const projecturl = '/api/classes/' + classid +
                               '/students/' + userid +
                               '/projects/' + projectid;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post(projecturl + '/training')
                .send({
                    data : [0.01, 0.02],
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            const badReqRes = await request(testServer)
                .put(projecturl + '/labels')
                .send({
                    after : 'healthy',
                })
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(badReqRes.body, { error : 'Missing data' });

            const getRes = await request(testServer)
                .get(projecturl + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.length, 1);
            assert.strictEqual(getRes.header['content-range'], 'items 0-0/1');

            assert.deepStrictEqual(getRes.body[0].numberdata, [0.01, 0.02]);
            assert.strictEqual(getRes.body[0].label, 'fruit');

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should edit training label', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const projecturl = '/api/classes/' + classid +
                               '/students/' + userid +
                               '/projects/' + projectid;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .post(projecturl + '/training')
                .send({
                    data : 'apple',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED);

            await request(testServer)
                .put(projecturl + '/labels')
                .send({
                    before : 'fruit',
                    after : 'healthy',
                })
                .expect(httpstatus.OK);

            const getRes = await request(testServer)
                .get(projecturl + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes.body.length, 1);
            assert.strictEqual(getRes.header['content-range'], 'items 0-0/1');

            assert.strictEqual(getRes.body[0].textdata, 'apple');
            assert.strictEqual(getRes.body[0].label, 'healthy');

            await store.deleteEntireUser(userid, classid);
        });

    });



    describe('getTraining()', () => {

        it('should verify project exists', async () => {
            const classid = uuid();
            const studentid = uuid();
            const projectid = uuid();

            nextAuth0UserId = studentid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + studentid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.strictEqual(res.body.error, 'Not found');
        });


        it('should fetch empty training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.deepStrictEqual(res.body, []);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should verify user id', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .get('/api/classes/' + classid + '/students/DIFFERENTUSER/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should get training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 2; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 3; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body: { id: string, label: string, textdata: string }[] = res.body;
            assert.strictEqual(body.length, 6);

            body.forEach((item) => {
                assert(item.id);
                assert(item.label);
                assert(item.textdata);
            });

            await store.deleteEntireProject(userid, classid, project);
        });

        it('should ensure access is prevented to other students', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 2; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 3; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const trainingurl = '/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training';

            const firstRes = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body: { id: string, label: string, textdata: string }[] = firstRes.body;
            assert.strictEqual(body.length, 6);

            nextAuth0UserId = 'a-different-user';

            const forbiddenRes = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            assert.deepStrictEqual(forbiddenRes.body, { error : 'Invalid access' });

            await store.deleteEntireProject(userid, classid, project);
        });

        it('should ensure allow teachers to have read-only access to training data', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 2; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 3; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const trainingurl = '/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training';

            await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            nextAuth0UserId = 'yet-another-different-user';
            nextAuth0UserRole = 'supervisor';

            const supervisorRes = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body: { id: string, label: string, textdata: string }[] = supervisorRes.body;
            assert.strictEqual(body.length, 6);

            await store.deleteEntireProject(userid, classid, project);
        });

        it('should get a page of training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 4; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    const textdata = uuid();

                    data.push({ textdata, label });
                }
            }

            await store.bulkStoreTextTraining(projectid, data);

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .set('Range', 'items=0-9')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body: { id: string, label: string, textdata: string }[] = res.body;
            assert.strictEqual(body.length, 10);

            body.forEach((item) => {
                assert(item.id);
                assert(item.label);
                assert(item.textdata);
            });

            assert.strictEqual(res.header['content-range'], 'items 0-9/20');

            await store.deleteEntireProject(userid, classid, project);
        });



        it('should get a page of numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en',
                [
                    { name : 'one', type : 'number' }, { name : 'two', type : 'number' },
                    { name : 'three', type : 'number' }, { name : 'four', type : 'number' },
                    { name : 'five', type : 'number' },
                ], false);
            const projectid = project.id;

            const data = [];

            for (let labelIdx = 0; labelIdx < 4; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    const numberdata = [1, 2, labelIdx, text, labelIdx * text ];

                    data.push({ numberdata, label });
                }
            }

            await store.bulkStoreNumberTraining(projectid, data);

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training')
                .set('Range', 'items=0-9')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const body: { id: string, label: string, numberdata: number[] }[] = res.body;
            assert.strictEqual(body.length, 10);

            body.forEach((item) => {
                assert(item.id);
                assert(item.label);
                assert(item.numberdata);
                assert.strictEqual(item.numberdata.length, 5);
                for (const num of item.numberdata) {
                    assert(!isNaN(num));
                }
            });

            assert.strictEqual(res.header['content-range'], 'items 0-9/20');

            await store.deleteEntireProject(userid, classid, project);
        });
    });


    describe('deleteTraining()', () => {

        it('should verify permissions', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            const apple = await store.storeTextTraining(projectid, 'apple', 'fruit');
            const banana = await store.storeTextTraining(projectid, 'banana', 'fruit');

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const getRes1 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 2);
            assert.strictEqual(getRes1.header['content-range'], 'items 0-1/2');

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + 'differentuserid' +
                        '/projects/' + projectid +
                        '/training/' + apple.id)
                .expect(httpstatus.FORBIDDEN);

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + 'differentprojectid' +
                        '/training/' + banana.id)
                .expect(httpstatus.NOT_FOUND);

            const getRes2 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes2.body.length, 2);
            assert.strictEqual(getRes2.header['content-range'], 'items 0-1/2');

            await request(testServer)
                .delete('/api/classes/' + classid +
                        '/students/' + userid +
                        '/projects/' + projectid +
                        '/training/' + banana.id)
                .expect(httpstatus.NO_CONTENT);

            const getRes3 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes3.body.length, 1);
            assert.strictEqual(getRes3.header['content-range'], 'items 0-0/1');

            await store.deleteEntireUser(userid, classid);
        });


        it('should delete training', async () => {
            const classid = uuid();
            const userid = uuid();

            await store.deleteAllPendingJobs();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            await store.storeTextTraining(projectid, 'apple', 'fruit');
            await store.storeTextTraining(projectid, 'banana', 'fruit');

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const getRes1 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 2);
            assert.strictEqual(getRes1.header['content-range'], 'items 0-1/2');

            await request(testServer)
                .delete(trainingurl + '/' + getRes1.body[0].id)
                .expect(httpstatus.NO_CONTENT);

            const getRes2 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes2.body.length, 1);
            assert.strictEqual(getRes2.header['content-range'], 'items 0-0/1');

            const job = await store.getNextPendingJob();
            assert(!job);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should delete image training', async () => {
            const classid = uuid();
            const userid = uuid();

            await store.deleteAllPendingJobs();

            const project = await store.storeProject(userid, classid, 'images', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingOne = await store.storeImageTraining(projectid, 'someurl', 'label', true);
            const trainingTwo = await store.storeImageTraining(projectid, 'someurl', 'label', false);

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const getRes1 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 2);
            assert.strictEqual(getRes1.header['content-range'], 'items 0-1/2');

            await request(testServer)
                .delete(trainingurl + '/' + trainingOne.id)
                .expect(httpstatus.NO_CONTENT);

            const job = await store.getNextPendingJob();
            assert(job);
            if (job) {
                assert.strictEqual(job.jobtype, 1);
                assert.strictEqual(job.attempts, 0);
                assert.deepStrictEqual(job.jobdata, {
                    projectid, userid, classid,
                    objectid : trainingOne.id,
                });

                await store.deletePendingJob(job);
            }

            const getRes2 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes2.body.length, 1);
            assert.strictEqual(getRes2.header['content-range'], 'items 0-0/1');

            await request(testServer)
                .delete(trainingurl + '/' + trainingTwo.id)
                .expect(httpstatus.NO_CONTENT);

            const job2 = await store.getNextPendingJob();
            assert(!job2);

            await store.deleteEntireProject(userid, classid, project);
        });


        it('should delete numeric training', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'numbers', 'demo', 'en', [
                { name : 'field', type : 'number' },
            ], false);
            const projectid = project.id;

            await store.storeNumberTraining(projectid, false, [100], 'fruit');
            await store.storeNumberTraining(projectid, false, [123], 'fruit');

            const trainingurl = '/api/classes/' + classid +
                                '/students/' + userid +
                                '/projects/' + projectid +
                                '/training';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const getRes1 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes1.body.length, 2);
            assert.strictEqual(getRes1.header['content-range'], 'items 0-1/2');

            await request(testServer)
                .delete(trainingurl + '/' + getRes1.body[0].id)
                .expect(httpstatus.NO_CONTENT);

            const getRes2 = await request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            assert.strictEqual(getRes2.body.length, 1);
            assert.strictEqual(getRes2.header['content-range'], 'items 0-0/1');

            await store.deleteEntireProject(userid, classid, project);
        });

    });





    describe('deleteProject()', () => {

        it('should delete everything', async () => {
            const classid = uuid();
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'text', 'demo', 'en', [], false);
            const projectid = project.id;

            await store.addLabelToProject(userid, classid, projectid, 'animal');
            await store.addLabelToProject(userid, classid, projectid, 'vegetable');
            await store.addLabelToProject(userid, classid, projectid, 'mineral');

            await store.storeTextTraining(projectid, 'tomato', 'vegetable');
            await store.storeTextTraining(projectid, 'giraffe', 'animal');
            await store.storeTextTraining(projectid, 'zebra', 'animal');

            const projecturl = '/api/classes/' + classid +
                               '/students/' + userid +
                               '/projects/' + projectid;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await request(testServer)
                .delete(projecturl)
                .expect(httpstatus.NO_CONTENT);

            const count = await store.countTraining('text', projectid);
            assert.strictEqual(count, 0);

            const check = await store.getProject(projectid)
            assert.ifError(check);
        });

    });



    describe('getTrainingItem', () => {

        it('should retrieve resized image data ready for training', async () => {
            const classid = 'BETA';
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'imgtfjs', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await store.addLabelToProject(userid, classid, projectid, 'testlabel');
            const trainingitem = await store.storeImageTraining(project.id,
                'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/John_McCarthy_%28computer_scientist%29_Stanford_2006_%28272020300%29.jpg/1280px-John_McCarthy_%28computer_scientist%29_Stanford_2006_%28272020300%29.jpg',
                'testlabel',
                false);

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training/' + trainingitem.id)
                .expect('Content-Type', /octet-stream/)
                .expect(httpstatus.OK);

            const retrievedFile = await writeDataToTempFile(res.body);
            await filecomparepromise('./src/tests/utils/resources/mccarthy.jpg', retrievedFile);
            await store.deleteEntireProject(userid, classid, project);
        });


        it('should handle requests to retrieve images that are no longer available', async () => {
            const classid = 'BETA';
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'imgtfjs', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            await store.addLabelToProject(userid, classid, projectid, 'testlabel');
            const trainingitem = await store.storeImageTraining(project.id,
                'https://this-is-not-a-real-web-address/pretend-image.png',
                'testlabel',
                false);

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training/' + trainingitem.id)
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            assert.deepStrictEqual(res.body, {
                code: 'MLMOD12',
                error: 'One of your training images could not be downloaded',
                location: {
                    type: 'download',
                    imageid: trainingitem.id,
                    url: 'https://this-is-not-a-real-web-address/pretend-image.png'
                }
            });
            await store.deleteEntireProject(userid, classid, project);
        });


        it('should handle requests for unknown training items', async () => {
            const classid = 'BETA';
            const userid = uuid();

            const project = await store.storeProject(userid, classid, 'imgtfjs', 'demo', 'en', [], false);
            const projectid = project.id;

            nextAuth0UserId = userid;
            nextAuth0UserTenant = classid;

            const res = await request(testServer)
                .get('/api/classes/' + classid + '/students/' + userid + '/projects/' + projectid + '/training/' + uuid())
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            assert.deepStrictEqual(res.body, {
                error : 'Not found',
            });
            await store.deleteEntireProject(userid, classid, project);
        });

    });


    const tmpFile = promisify(tmp.file);
    const fsWriteFile = promisify(fs.writeFile);
    const filecomparePromise = promisify(filecompare);

    async function writeDataToTempFile(data: Buffer): Promise<string> {
        const path = await tmpFile();
        await fsWriteFile(path, data);
        return path;
    }

    async function filecomparepromise(filea: string, fileb: string): Promise<void> {
        const isEq = await filecomparePromise(filea, fileb);
        assert(isEq, filea + ' ' + fileb);
    }



    const originalRequestPost = requestUtil.post;
    const originalRequestDelete = requestUtil.del;
    const stubbedRequestPost = (url: string, opts?: any, retryOnTimeout?: boolean) => {
        if (url === 'undefined/api/models') {
            // no test numbers service available
            return Promise.resolve();
        }
        else {
            // use a real test numbers service
            return originalRequestPost(url, opts, retryOnTimeout || false);
        }
    };
    const stubbedRequestDelete = (url: string, opts?: any) => {
        if (url === 'undefined/api/models') {
            // no test numbers service available
            return Promise.resolve();
        }
        else {
            // use a real test numbers service
            return originalRequestDelete(url, opts);
        }
    };

});
