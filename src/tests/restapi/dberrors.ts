/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';

import * as mockMysqldb from '../db/mockmysqldb';


let testServer;


describe('REST API - DB error handling', () => {

    let authStub;
    let checkUserStub;
    let requireSupervisorStub;

    function authNoOp(req, res, next) { next(); }


    before(() => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        proxyquire('../../lib/restapi/projects', {
            './auth' : {
                authenticate : authStub,
                checkValidUser : checkUserStub,
                requireSupervisor : requireSupervisorStub,
            },
        });

        store.replaceDbConnPoolForTest(mockMysqldb.MOCK_POOL);

        testServer = testapiserver();
    });



    after(() => {
        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        return store.disconnect();
    });


    describe('projects', () => {

        it('GET /api/classes/CLASSID/students/STUDENTID/projects', () => {
            return request(testServer)
                .get('/api/classes/CLASSID/students/STUDENTID/projects')
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        error : 'Error accessing the database used to store data',
                        detail : {
                            code : 'ER_NO_SUCH_SELECT_ERROR',
                            errno : 6677,
                            sqlState : '#12S34',
                            message : 'Some technical sounding SQL error from selecting projects',
                        },
                    });
                });
        });


        it('POST /api/classes/CLASSID/students/EXCEPTION/projects', () => {
            const projectDetails = { name : 'PROJECT NAME', type : 'text' };
            const url = '/api/classes/CLASSID/students/EXCEPTION/projects';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        error : 'Error accessing the database used to store data',
                        detail : {
                            code: 'ER_SOME_INSERT_ERROR',
                            errno: 2929,
                            sqlState: '#12345',
                            message: 'We could not write the project to the DB',
                        },
                    });
                });
        });


        it('POST /api/classes/CLASSID/students/STUDENTID/projects', () => {
            const projectDetails = { name : 'PROJECT NAME', type : 'text' };
            const url = '/api/classes/CLASSID/students/STUDENTID/projects';

            return request(testServer)
                .post(url)
                .send(projectDetails)
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        error : 'Failed to store project',
                    });
                });
        });


        it('DELETE /api/classes/CLASSID/students/EXCEPTION/projects/PROJECTID', () => {
            const url = '/api/classes/CLASSID/students/EXCEPTION/projects/PROJECTID';

            return request(testServer)
                .delete(url)
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        error : 'Error accessing the database used to store data',
                        detail : {
                            code: 'ER_SOME_DELETE_ERROR',
                            errno: 2129,
                            sqlState: '#98765',
                            message: 'We could not delete the project from the DB',
                        },
                    });
                });
        });
    });


    describe('training data', () => {

        it('POST /api/classes/CLASSID/students/STUDENTID/projects/PROJECTID/training', () => {
            const url = '/api/classes/CLASSID/students/EXCEPTION/projects/PROJECTID/training';

            return request(testServer)
                .post(url)
                .send({
                    data : 'throw an exception',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        error : 'Error accessing the database used to store data',
                        detail : {
                            code: 'ER_SOME_INSERT_ERROR',
                            errno: 1919,
                            sqlState: '#12345',
                            message: 'We could not write the training data to the DB',
                        },
                    });
                });
        });

        it('POST /api/classes/CLASSID/students/STUDENTID/projects/PROJECTID/training 2', () => {
            const url = '/api/classes/CLASSID/students/EXCEPTION/projects/PROJECTID/training';

            return request(testServer)
                .post(url)
                .send({
                    data : 'dont throw an exception just fail',
                    label : 'fruit',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.INTERNAL_SERVER_ERROR)
                .then((res) => {
                    const body = res.body;
                    assert.deepEqual(body, {
                        error : 'Failed to store training data',
                    });
                });
        });

    });

});
