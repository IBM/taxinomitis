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


describe('REST API - share projects', () => {

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
        return store.disconnect();
    });


    describe('shareProject()', () => {

        it('should handle requests for non-existent projects', () => {
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';
            return request(testServer)
                .patch('/api/classes/' + TESTCLASS + '/students/' + studentid + '/projects/' + projectid + '/iscrowdsourced')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });

        it('should only allow project owner to make changes', () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            return store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false)
                .then((project) => {
                    const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

                    nextAuth0UserId = uuid();

                    return request(testServer)
                        .patch(url)
                        .send([{ op : 'replace', path : '/isCrowdSourced', value : true }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Invalid access');
                });
        });

        it('should only allow teachers to make changes', () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            return store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false)
                .then((project) => {
                    const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

                    return request(testServer)
                        .patch(url)
                        .send([{ op : 'replace', path : '/isCrowdSourced', value : true }])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Only supervisors are allowed to invoke this');
                });
        });

        function checkInvalidPatch(url: string, payload: object, expected: string) {
            return request(testServer)
                    .patch(url)
                    .send(payload)
                    .expect('Content-Type', /json/)
                    .expect(httpstatus.BAD_REQUEST)
                    .then((res) => {
                        const body = res.body;
                        assert.deepStrictEqual(body, { error : expected });
                    });
        }

        it('should check patch request', () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            const INVALID_REQUESTS = [
                [ { } ],
                [ { op : 'add', path : '/isCrowdSourced', value : true } ],
                [ { op : 'replace', path : '/isCrowdSourced', value : true }, { op : 'replace', path : '/isCrowdSourced', value : true } ],
                [ { op : 'replace', path : 'isCrowdSourced', value : true } ],
                [ { op : 'replace', path : '/isCrowdSourced', value : 'true' } ],
                { op : 'replace', path : '/isCrowdSourced', value : true }
            ];

            let url: string;

            return store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false)
                .then((project) => {
                    url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

                    return checkInvalidPatch(url, INVALID_REQUESTS[0], 'PATCH requests must include an op');
                })
                .then(() => {
                    return checkInvalidPatch(url, INVALID_REQUESTS[1], 'Invalid PATCH op');
                })
                .then(() => {
                    return checkInvalidPatch(url, INVALID_REQUESTS[2], 'Only individual PATCH requests are supported');
                })
                .then(() => {
                    return checkInvalidPatch(url, INVALID_REQUESTS[3], 'Only modifications to project isCrowdSourced are supported');
                })
                .then(() => {
                    return checkInvalidPatch(url, INVALID_REQUESTS[4], 'Invalid PATCH op');
                })
                .then(() => {
                    return checkInvalidPatch(url, INVALID_REQUESTS[5], 'PATCH body should be an array');
                });
        });

        it('should check current share status', () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            return store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false)
                .then((project) => {
                    const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

                    return request(testServer)
                        .patch(url)
                        .send([ { op : 'replace', path : '/isCrowdSourced', value : false } ])
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.CONFLICT);
                })
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'isCrowdSourced already set' });
                    return store.deleteProjectsByClassId(TESTCLASS);
                });
        });

        it('should modify share status', () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            let projecturl: string;

            return store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false)
                .then((project) => {
                    projecturl = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id;

                    return request(testServer)
                        .patch(projecturl + '/iscrowdsourced')
                        .send([ { op : 'replace', path : '/isCrowdSourced', value : true } ])
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer).get(projecturl);
                })
                .then((res) => {
                    assert.strictEqual(res.body.isCrowdSourced, true);

                    return request(testServer)
                        .patch(projecturl + '/iscrowdsourced')
                        .send([ { op : 'replace', path : '/isCrowdSourced', value : false } ])
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer).get(projecturl);
                })
                .then((res) => {
                    assert.strictEqual(res.body.isCrowdSourced, false);
                });
        });

    });

});
