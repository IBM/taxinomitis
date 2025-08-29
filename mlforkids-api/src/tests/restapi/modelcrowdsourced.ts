/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as request from 'supertest';
import { status as httpstatus } from 'http-status';
import * as express from 'express';

import * as auth0objects from '../../lib/auth0/auth-types';
import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';
import * as auth from '../../lib/restapi/auth';
import * as auth0users from '../../lib/auth0/users';
import testapiserver from './testserver';


let testServer: express.Express;


const TESTCLASS = 'UNIQUECLASSID';


describe('REST API - shared models', () => {

    interface UserInfo {
        role  : 'student' | 'supervisor',
        id    : string,
        class : string,
    }

    const TEACHER: UserInfo = {
        role  : 'supervisor',
        id    : uuid(),
        class : TESTCLASS,
    };
    const STUDENT: UserInfo = {
        role  : 'student',
        id    : uuid(),
        class : TESTCLASS,
    };
    const UNKNOWN_TEACHER: UserInfo = {
        role  : 'supervisor',
        id    : uuid(),
        class : uuid(),
    };
    const UNKNOWN_STUDENT: UserInfo = {
        role  : 'student',
        id    : uuid(),
        class : uuid(),
    };

    let authStub: sinon.SinonStub<any, any>;
    let studentsByUserIdStub: sinon.SinonStub<any, any>;

    let nextAuth0UserId = UNKNOWN_STUDENT.id;
    let nextAuth0UserTenant = UNKNOWN_STUDENT.class;
    let nextAuth0UserRole: 'student' | 'supervisor' = UNKNOWN_STUDENT.role;

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
        nextAuth0UserId = UNKNOWN_STUDENT.id;
        nextAuth0UserTenant = UNKNOWN_STUDENT.class;
        nextAuth0UserRole = UNKNOWN_STUDENT.role;
    });

    after(async () => {
        authStub.restore();
        studentsByUserIdStub.restore();

        await store.deleteProjectsByClassId(TESTCLASS);
        return store.disconnect();
    });

    async function prepareSharedNumberProject(owner: UserInfo): Promise<Objects.Project> {
        const projName = 'shared project';

        const project = await store.storeProject(owner.id, TESTCLASS, 'numbers', projName, 'en', [
            { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
        ], true);
        const projectid = project.id;
        await store.addLabelToProject(owner.id, TESTCLASS, projectid, 'one');
        await store.addLabelToProject(owner.id, TESTCLASS, projectid, 'two');
        const data = [
            { numberdata : [ 1, 1 ], label : 'one' },
            { numberdata : [ 2, 2 ], label : 'one' },
            { numberdata : [ 3, 3 ], label : 'one' },
            { numberdata : [ 1, 10 ], label : 'two' },
            { numberdata : [ 2, 20 ], label : 'two' },
            { numberdata : [ 3, 30 ], label : 'two' },
        ];

        await store.bulkStoreNumberTraining(projectid, data);

        return project;
    }

    async function newModel(
        project: Objects.Project,
        requester: UserInfo,
        expectedStatus: number): Promise<any>
    {
        nextAuth0UserId = requester.id;
        nextAuth0UserTenant = requester.class;
        nextAuth0UserRole = requester.role;

        return request(testServer)
            .post('/api/classes/' + project.classid + '/students/' + project.userid + '/projects/' + project.id + '/models')
            .expect('Content-Type', /json/)
            .expect(expectedStatus)
            .then((res) => {
                const body = res.body;

                if (expectedStatus === httpstatus.CREATED) {
                    assert.strictEqual(body.status, 'Training');
                    assert.strictEqual(body.key, project.id);
                    assert(body.urls.status);
                    assert(body.urls.model);
                    assert(body.urls.tree);
                    assert(body.urls.dot);
                    assert(body.urls.vocab);

                    const created = new Date(body.lastupdate);
                    assert.strictEqual(isNaN(created.getDate()), false);
                }
                else if (expectedStatus === httpstatus.FORBIDDEN) {
                    assert.deepStrictEqual(body, { error : 'Invalid access' });
                }

                return body;
            });
    }

    async function getModel(
        project: Objects.Project,
        requester: UserInfo,
        expectedStatus: number,
        expectedModelUrl: string | undefined)
    {
        nextAuth0UserId = requester.id;
        nextAuth0UserTenant = requester.class;
        nextAuth0UserRole = requester.role;

        return request(testServer)
            .get('/api/classes/' + project.classid + '/students/' + project.userid + '/projects/' + project.id + '/models')
            .expect('Content-Type', /json/)
            .expect(expectedStatus)
            .then((res) => {
                const body = res.body;

                if (expectedStatus === httpstatus.OK) {
                    if (expectedModelUrl) {
                        assert.strictEqual(body[0].status, 'Unknown');
                        assert.strictEqual(body[0].key, project.id);
                        assert.strictEqual(body[0].urls.status, expectedModelUrl);
                    }
                    else {
                        assert.deepStrictEqual(body, []);
                    }
                }
                else if (expectedStatus === httpstatus.FORBIDDEN) {
                    assert.deepStrictEqual(body, { error : 'Invalid access' });
                }
            });
    }

    async function deleteModel(
        project: Objects.Project,
        requester: UserInfo,
        expectedStatus: number)
    {
        nextAuth0UserId = requester.id;
        nextAuth0UserTenant = requester.class;
        nextAuth0UserRole = requester.role;

        return request(testServer)
            .delete('/api/classes/' + project.classid + '/students/' + project.userid + '/projects/' + project.id + '/models/' + project.id)
            .expect(expectedStatus)
            .then((res) => {
                const body = res.body;

                if (expectedStatus === httpstatus.FORBIDDEN) {
                    assert.deepStrictEqual(body, { error : 'Invalid access' });
                }
            });
    }


    describe('train model', () => {
        it('teachers can train models', () => {
            return prepareSharedNumberProject(TEACHER)
                .then((project) => {
                    return newModel(project, TEACHER, httpstatus.CREATED);
                });
        });

        it('students cannot train models', () => {
            return prepareSharedNumberProject(TEACHER)
                .then((project) => {
                    return newModel(project, STUDENT, httpstatus.FORBIDDEN);
                });
        });
    });



    describe('get model', () => {
        it('teachers can get models', () => {
            let project: Objects.Project;
            let modelurl: string;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then((modelinfo) => {
                    modelurl = modelinfo.urls.status;
                    return getModel(project, TEACHER, httpstatus.OK, modelurl);
                });
        });

        it('students can get models', () => {
            let project: Objects.Project;
            let modelurl: string;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then((modelinfo) => {
                    modelurl = modelinfo.urls.status;
                    return getModel(project, STUDENT, httpstatus.OK, modelurl);
                });
        });
    });


    describe('delete model', () => {
        it('teachers can delete models', () => {
            let project: Objects.Project;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then(() => {
                    return deleteModel(project, TEACHER, httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return getModel(project, TEACHER, httpstatus.OK, undefined);
                });
        });

        it('students cannot delete models', () => {
            let project: Objects.Project;
            let modelurl: string;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then((modelinfo) => {
                    modelurl = modelinfo.urls.status;
                    return deleteModel(project, STUDENT, httpstatus.FORBIDDEN);
                })
                .then(() => {
                    return getModel(project, STUDENT, httpstatus.OK, modelurl);
                });
        });
    });

    describe('scratch keys', () => {

        it('scratch keys can be used to train a model', () => {
            let project: Objects.Project;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return store.storeUntrainedScratchKey(project);
                })
                .then((scratchkey) => {
                    return request(testServer).post('/api/scratch/' + scratchkey + '/models');
                })
                .then(() => {
                    return getModel(project, STUDENT, httpstatus.OK, 'http://127.0.0.1:8000/saved-models/' + project.id + '/status');
                });
        });
    });


    describe('unknown users', () => {
        it('other teachers cannot access projects', () => {
            let project: Objects.Project;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then(() => {
                    return getModel(project, UNKNOWN_TEACHER, httpstatus.FORBIDDEN, undefined);
                });
        });
        it('other students cannot access projects', () => {
            let project: Objects.Project;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then(() => {
                    return getModel(project, UNKNOWN_STUDENT, httpstatus.FORBIDDEN, undefined);
                });
        });
        it('other teachers cannot delete projects', () => {
            let project: Objects.Project;
            let modelurl: string;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then((modelinfo) => {
                    modelurl = modelinfo.urls.status;
                    return deleteModel(project, UNKNOWN_TEACHER, httpstatus.FORBIDDEN);
                })
                .then(() => {
                    return getModel(project, TEACHER, httpstatus.OK, modelurl);
                });
        });
        it('other students cannot delete projects', () => {
            let project: Objects.Project;
            let modelurl: string;
            return prepareSharedNumberProject(TEACHER)
                .then((p) => {
                    project = p;
                    return newModel(project, TEACHER, httpstatus.CREATED);
                })
                .then((modelinfo) => {
                    modelurl = modelinfo.urls.status;
                    return deleteModel(project, UNKNOWN_STUDENT, httpstatus.FORBIDDEN);
                })
                .then(() => {
                    return getModel(project, TEACHER, httpstatus.OK, modelurl);
                });
        });
    });
});
