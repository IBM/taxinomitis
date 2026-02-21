import { describe, it, before, beforeEach, after } from 'node:test';
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as express from 'express';

import * as auth0objects from '../../lib/auth0/auth-types';
import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as auth0users from '../../lib/auth0/users';
import testapiserver from './testserver';


let testServer: express.Express;


const TESTCLASS = 'UNIQUECLASSIDSHARE';


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
        const mockedReq: any = req;
        mockedReq.user = {
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

        it('should handle requests for non-existent projects', async () => {
            const studentid = uuid();
            const projectid = uuid();
            nextAuth0UserId = studentid;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            const res = await request(testServer)
                .patch('/api/classes/' + TESTCLASS + '/students/' + studentid + '/projects/' + projectid + '/iscrowdsourced')
                .send([{ op : 'replace', path : '/isCrowdSourced', value : true }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND);

            const body = res.body;
            assert.strictEqual(body.error, 'Not found');
        });

        it('should only allow project owner to make changes', async () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            const project = await store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false);
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

            nextAuth0UserId = uuid();

            const res = await request(testServer)
                .patch(url)
                .send([{ op : 'replace', path : '/isCrowdSourced', value : true }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            const body = res.body;
            assert.strictEqual(body.error, 'Invalid access');
        });

        it('should only allow teachers to make changes', async () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'student';

            const project = await store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false);
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

            const res = await request(testServer)
                .patch(url)
                .send([{ op : 'replace', path : '/isCrowdSourced', value : true }])
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN);

            const body = res.body;
            assert.strictEqual(body.error, 'Only supervisors are allowed to invoke this');
        });

        async function checkInvalidPatch(url: string, payload: object, expected: string) {
            const res = await request(testServer)
                .patch(url)
                .send(payload)
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            const body = res.body;
            assert.deepStrictEqual(body, { error : expected });
        }

        it('should check patch request', async () => {
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

            const project = await store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false);
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

            await checkInvalidPatch(url, INVALID_REQUESTS[0], 'PATCH requests must include an op');
            await checkInvalidPatch(url, INVALID_REQUESTS[1], 'Invalid PATCH op');
            await checkInvalidPatch(url, INVALID_REQUESTS[2], 'Only individual PATCH requests are supported');
            await checkInvalidPatch(url, INVALID_REQUESTS[3], 'Only modifications to project isCrowdSourced are supported');
            await checkInvalidPatch(url, INVALID_REQUESTS[4], 'Invalid PATCH op');
            await checkInvalidPatch(url, INVALID_REQUESTS[5], 'PATCH body should be an array');
        });

        it('should check current share status', async () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            const project = await store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false);
            const url = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id + '/iscrowdsourced';

            const res = await request(testServer)
                .patch(url)
                .send([ { op : 'replace', path : '/isCrowdSourced', value : false } ])
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT);

            const body = res.body;
            assert.deepStrictEqual(body, { error : 'isCrowdSourced already set' });
            await store.deleteProjectsByClassId(TESTCLASS);
        });

        it('should modify share status', async () => {
            const studentId = uuid();
            nextAuth0UserId = studentId;
            nextAuth0UserTenant = TESTCLASS;
            nextAuth0UserRole = 'supervisor';

            const project = await store.storeProject(studentId, TESTCLASS, 'text', 'test project', 'en', [], false);
            const projecturl = '/api/classes/' + TESTCLASS + '/students/' + studentId + '/projects/' + project.id;

            await request(testServer)
                .patch(projecturl + '/iscrowdsourced')
                .send([ { op : 'replace', path : '/isCrowdSourced', value : true } ])
                .expect(httpstatus.NO_CONTENT);

            let res = await request(testServer).get(projecturl);
            assert.strictEqual(res.body.isCrowdSourced, true);

            await request(testServer)
                .patch(projecturl + '/iscrowdsourced')
                .send([ { op : 'replace', path : '/isCrowdSourced', value : false } ])
                .expect(httpstatus.NO_CONTENT);

            res = await request(testServer).get(projecturl);
            assert.strictEqual(res.body.isCrowdSourced, false);
        });

    });

});
