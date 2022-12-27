/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as express from 'express';
import * as auth0objects from '../../lib/auth0/auth-types';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0users from '../../lib/auth0/users';
import testapiserver from './testserver';


let testServer: express.Express;


const TESTCLASS = 'UNIQUECLASSID';


describe('REST API - imported projects', () => {

    let authStub: sinon.SinonStub<any, any>;
    let studentsByUserIdStub: sinon.SinonStub<any, any>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole = 'student';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        // @ts-ignore
        req.user = {
            'sub' : nextAuth0UserId,
            'https://machinelearningforkids.co.uk/api/role' : nextAuth0UserRole,
            'https://machinelearningforkids.co.uk/api/tenant' : nextAuth0UserTenant,
        };
        next();
    }

    function emptyClass(): Promise<{ [id: string]: auth0objects.Student }> {
        return Promise.resolve({});
    }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        studentsByUserIdStub = sinon.stub(auth0users, 'getStudentsByUserId').callsFake(emptyClass);

        await store.init();

        testServer = testapiserver();

        return store.deleteProjectsByClassId(TESTCLASS);
    });

    beforeEach(() => {
        nextAuth0UserId = 'userid';
        nextAuth0UserTenant = 'classid';
        nextAuth0UserRole = 'student';
    });

    after(async () => {
        authStub.restore();
        studentsByUserIdStub.restore();

        await store.deleteProjectsByClassId(TESTCLASS);
        await store.deleteAllPendingJobs();
        return store.disconnect();
    });



    describe('imports', () => {

        it('should create a text project from a predefined dataset', () => {
            const userid = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + userid + '/projects';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = TESTCLASS;

            const type = 'text';

            return request(testServer)
                .post(url)
                .send({ dataset : 'test-only-txt', type })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((resp) => {
                    const body = resp.body;
                    const id = body.id;
                    delete body.id;
                    assert.deepStrictEqual(body, {
                        userid,
                        classid: TESTCLASS,
                        type,
                        name: 'Test project',
                        labels: ['compliment', 'insult'],
                        language: 'en',
                        numfields: 0,
                        fields: [],
                        isCrowdSourced: false,
                    });

                    return request(testServer)
                        .get(url + '/' + id + '/training')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((resp) => {
                    const body = resp.body;
                    assert.strictEqual(body.length, 7);
                    body.forEach((item: any) => {
                        assert(item.id);
                        assert(item.textdata);
                        assert(item.label === 'compliment' || item.label === 'insult');
                    });
                });
        });


        it('should hold out test data for an imported text project from a predefined dataset', () => {
            const userid = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + userid + '/projects';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = TESTCLASS;

            const type = 'text';

            return request(testServer)
                .post(url)
                .send({ dataset : 'test-only-txt', type, testratio: 50 })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((resp) => {
                    const body = resp.body;

                    const id = body.id;
                    delete body.id;

                    const testdata = body.testdata;
                    const firstTestRow = testdata.shift();
                    assert.deepStrictEqual(firstTestRow, [ 'text', 'label' ]);
                    assert.strictEqual(testdata.length, 4);
                    testdata.forEach((item: any) => {
                        assert.strictEqual(item.length, 2);
                        assert.strictEqual(typeof item[0], 'string');
                        assert(item[1] === 'compliment' || item[1] === 'insult');
                    });
                    delete body.testdata;

                    assert.deepStrictEqual(body, {
                        userid,
                        classid: TESTCLASS,
                        type,
                        name: 'Test project',
                        labels: ['compliment', 'insult'],
                        language: 'en',
                        numfields: 0,
                        fields: [],
                        isCrowdSourced: false,
                    });

                    return request(testServer)
                        .get(url + '/' + id + '/training')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((resp) => {
                    const body = resp.body;
                    assert.strictEqual(body.length, 3);
                    body.forEach((item: any) => {
                        assert(item.id);
                        assert(item.textdata);
                        assert(item.label === 'compliment' || item.label === 'insult');
                    });
                });
        });


        it('should create a whole-class numbers project from a predefined dataset', () => {
            const userid = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + userid + '/projects';

            nextAuth0UserId = userid;
            nextAuth0UserRole = 'supervisor';
            nextAuth0UserTenant = TESTCLASS;

            const type = 'numbers';
            const isCrowdSourced = true;

            return request(testServer)
                .post(url)
                .send({ dataset : 'test-only-num', type, isCrowdSourced })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((resp) => {
                    const body = resp.body;
                    const id = body.id;
                    delete body.id;
                    assert.deepStrictEqual(body, {
                        userid,
                        classid: TESTCLASS,
                        type,
                        name: 'My project',
                        labels: ['first', 'second', 'third'],
                        language: '',
                        numfields: 4,
                        fields: [
                            { choices: [], type: 'number', name : 'count' },
                            { choices: ['BIG', 'SMALL'], type: 'multichoice', name: 'size' },
                            { choices: [], type: 'number', name: 'age' },
                            { choices: ['RED', 'GREEN', 'BLUE'], type: 'multichoice', name: 'colour' },
                        ],
                        isCrowdSourced,
                    });

                    return request(testServer)
                        .get(url + '/' + id + '/training')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((resp) => {
                    const body = resp.body;
                    assert.strictEqual(body.length, 7);
                    body.forEach((item: any) => {
                        assert(item.id);
                        assert(item.numberdata);
                        item.numberdata.forEach((num: number) => {
                            assert.strictEqual(typeof num, 'number');
                        });
                        assert(item.label === 'first' || item.label === 'second' || item.label === 'third');
                    });
                });
        });



        it('should create an images project from a predefined dataset', () => {
            const userid = uuid();
            const classid = 'TESTTENANT';

            const url = '/api/classes/' + classid + '/students/' + userid + '/projects';

            nextAuth0UserId = userid;
            nextAuth0UserRole = 'student';
            nextAuth0UserTenant = classid;

            const type = 'imgtfjs';

            return request(testServer)
                .post(url)
                .send({ dataset : 'test-only-img', type })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CREATED)
                .then((resp) => {
                    const body = resp.body;
                    const id = body.id;
                    delete body.id;
                    assert.deepStrictEqual(body, {
                        userid,
                        classid,
                        type,
                        name: 'Pictures project',
                        labels: ['cat', 'dog'],
                        language: '',
                        numfields: 0,
                        fields: [],
                        isCrowdSourced: false,
                    });

                    return request(testServer)
                        .get(url + '/' + id + '/training')
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((resp) => {
                    const body = resp.body;
                    assert.strictEqual(body.length, 9);
                    body.forEach((item: any) => {
                        assert(item.id);
                        assert(item.imageurl);
                        assert(item.label === 'cat' || item.label === 'dog');
                    });
                });
        });
    });



    describe('errors', () => {

        it('should handle requests to import non-existent datasets', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ dataset : 'i-dont-really-exist', type : 'text' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((err) => {
                    assert.strictEqual(err.body.error, 'The requested dataset could not be found');
                });
        });

        it('should handle requests to import invalid dataset ids', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ dataset : '../../../../', type : 'text' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((err) => {
                    assert.strictEqual(err.body.error, 'The requested dataset ID is not valid');
                });
        });

        it('should handle requests to import datasets without a valid type', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ dataset : 'i-dont-really-exist', type : '..' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);
        });

        it('should handle requests to import datasets with a non-numeric test ratio', () => {
            const userid = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + userid + '/projects';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = TESTCLASS;

            const type = 'text';

            return request(testServer)
                .post(url)
                .send({ dataset : 'test-only-txt', type, testratio : 'hello' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((resp) => {
                    const body = resp.body;
                    assert.deepStrictEqual(body, {
                        error: 'Test ratio must be an integer between 0 and 100',
                    });
                });
        });

        it('should handle requests to import datasets with an invalid test ratio', () => {
            const userid = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + userid + '/projects';

            nextAuth0UserId = userid;
            nextAuth0UserTenant = TESTCLASS;

            const type = 'text';

            return request(testServer)
                .post(url)
                .send({ dataset : 'test-only-txt', type, testratio : -10 })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((resp) => {
                    const body = resp.body;
                    assert.deepStrictEqual(body, {
                        error: 'Test ratio must be an integer between 0 and 100',
                    });
                });
        });

        it('should handle requests to import datasets without a type', () => {
            const studentId = uuid();

            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects';

            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;

            return request(testServer)
                .post(url)
                .send({ dataset : 'i-dont-really-exist' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((err) => {
                    assert.strictEqual(err.body.error, 'Missing required field');
                });
        });

    });


});
