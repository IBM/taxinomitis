/*eslint-env mocha */
import { v1 as uuid } from 'uuid';
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as express from 'express';

import * as store from '../../lib/db/store';
import * as limits from '../../lib/db/limits';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';



let testServer: express.Express;


describe('REST API - sound training', () => {

    const CLASSID = uuid();
    const USERID = uuid();


    let authStub: sinon.SinonStub<any, any>;

    const AUTH_USERS = {
        STUDENT : {
            'sub' : USERID,
            'https://machinelearningforkids.co.uk/api/role' : 'student',
            'https://machinelearningforkids.co.uk/api/tenant' : CLASSID,
        },
        OTHERSTUDENT : {
            'sub' : uuid(),
            'https://machinelearningforkids.co.uk/api/role' : 'student',
            'https://machinelearningforkids.co.uk/api/tenant' : CLASSID,
        },
        TEACHER : {
            'sub' : uuid(),
            'https://machinelearningforkids.co.uk/api/role' : 'supervisor',
            'https://machinelearningforkids.co.uk/api/tenant' : CLASSID,
        },
        OTHERCLASS : {
            'sub' : uuid(),
            'https://machinelearningforkids.co.uk/api/role' : 'supervisor',
            'https://machinelearningforkids.co.uk/api/tenant' : 'DIFFERENT',
        },
    };

    let nextUser = AUTH_USERS.STUDENT;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        // @ts-ignore
        req.user = { ...nextUser };
        next();
    }


    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);

        await store.init();

        testServer = testapiserver();
    });

    beforeEach(() => {
        return store.deleteClassResources(CLASSID);
    });

    after(() => {
        authStub.restore();

        return store.deleteClassResources(CLASSID)
            .then(() => {
                return store.disconnect();
            });
    });


    function createTraining(num = 19952) {
        const numbers: number[] = [];
        for (let i = 0; i < num; i++) {
            numbers.push(Math.random());
        }
        return numbers;
    }

    describe('getLabels()', () => {

        it('should verify project exists', () => {
            const projectid = uuid();

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });


        it('should fetch empty training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo project', 'en', [], false);
            const projectid = project.id;

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {});

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });

        it('should verify user id', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            nextUser = AUTH_USERS.OTHERSTUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + nextUser.sub + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });

        it('should get sound training labels', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;
            await store.addLabelToProject(USERID, CLASSID, projectid, 'first');
            await store.addLabelToProject(USERID, CLASSID, projectid, 'second');
            await store.addLabelToProject(USERID, CLASSID, projectid, 'third');
            await store.addLabelToProject(USERID, CLASSID, projectid, 'fourth');

            await store.storeSoundTraining(projectid, 'url', 'first', uuid());
            await store.storeSoundTraining(projectid, 'url', 'first', uuid());
            await store.storeSoundTraining(projectid, 'url', 'first', uuid());
            await store.storeSoundTraining(projectid, 'url', 'second', uuid());
            await store.storeSoundTraining(projectid, 'url', 'second', uuid());
            await store.storeSoundTraining(projectid, 'url', 'third', uuid());

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/labels')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, {
                        first : 3, second : 2, third : 1, fourth : 0,
                    });

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });
    });


    describe('storeTraining()', () => {

        it('should verify project exists', () => {
            const projectid = uuid();

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .post('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/sounds')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });

        it('should verify user id', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            nextUser = AUTH_USERS.OTHERSTUDENT;

            return request(testServer)
                .post('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/sounds')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteEntireUser(USERID, CLASSID);
                });
        });

        it('should require audio data in training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'FIRST');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'SECOND');

            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/sounds';

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .post(trainingurl)
                .send({
                    label : 'FIRST',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'Missing data' });

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });


        it('should reject empty audio data in training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'FIRST');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'SECOND');
            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/sounds';

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .post(trainingurl)
                .send({
                    label : 'FIRST',
                    data : [],
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'Empty audio is not allowed' });

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });


        it('should require audio data in training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'FIRST');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'SECOND');
            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/sounds';

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .post(trainingurl)
                .send({
                    label : 'FIRST',
                    data : [ 'abc' ],
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, { error : 'Invalid audio input' });

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });

        it('should limit maximum length of audio training data', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'FIRST');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'SECOND');
            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/sounds';

            nextUser = AUTH_USERS.STUDENT;

            const numbers: number[] = [];
            for (let i = 0; i < 20010; i++) {
                numbers.push(0);
            }

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : numbers,
                    label : 'FIRST',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    const body = res.body;

                    assert.deepStrictEqual(body, { error : 'Audio exceeds maximum allowed length' });

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });



        it('should reject missing audio training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'fruit');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'SECOND');
            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/sounds';

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : [1, 2, ' '],
                    label : 'fruit',
                })
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, {
                        error : 'Invalid audio input',
                    });
                });
        });


        it('should enforce limits', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            await store.addLabelToProject(USERID, CLASSID, project.id, 'label');
            await store.addLabelToProject(USERID, CLASSID, project.id, 'SECOND');
            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/sounds';

            nextUser = AUTH_USERS.STUDENT;

            await store.storeSoundTraining(projectid, 'url', 'label', uuid());
            await store.storeSoundTraining(projectid, 'url', 'label', uuid());

            const limitsStub = sinon.stub(limits, 'getStoreLimits');
            limitsStub.returns({
                textTrainingItemsPerProject : 2,
                numberTrainingItemsPerProject : 2,
                numberTrainingItemsPerClassProject : 2,
                imageTrainingItemsPerProject : 100,
                soundTrainingItemsPerProject : 2,
            });

            return request(testServer)
                .post(trainingurl)
                .send({
                    data : createTraining(),
                    label : 'label',
                })
                .expect('Content-Type', /json/)
                .expect(httpstatus.CONFLICT)
                .then((res) => {
                    const body = res.body;

                    assert.deepStrictEqual(body, {
                        error: 'Project already has maximum allowed amount of training data',
                    });

                    limitsStub.restore();

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });
    });




    describe('getTraining()', () => {

        it('should verify project exists', () => {
            const projectid = uuid();

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.NOT_FOUND)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.error, 'Not found');
                });
        });


        it('should fetch empty training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.deepStrictEqual(body, []);

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });


        it('should verify user id', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            nextUser = AUTH_USERS.OTHERSTUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.FORBIDDEN)
                .then(() => {
                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });


        it('should get training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            for (let labelIdx = 0; labelIdx < 2; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 3; text++) {
                    await store.storeSoundTraining(projectid, 'url', label, uuid());
                }
            }

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/training')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body: { id: string, label: string, audiourl: number[] }[] = res.body;
                    assert.strictEqual(body.length, 6);

                    body.forEach((item) => {
                        assert(item.id);
                        assert(item.label);
                        assert(item.audiourl);
                    });

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });


        it('should get a page of training', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            for (let labelIdx = 0; labelIdx < 4; labelIdx++) {
                const label = uuid();

                for (let text = 0; text < 5; text++) {
                    await store.storeSoundTraining(projectid, 'url', label, uuid());
                }
            }

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .get('/api/classes/' + CLASSID + '/students/' + USERID + '/projects/' + projectid + '/training')
                .set('Range', 'items=0-9')
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body: { id: string, label: string, audiourl: number[] }[] = res.body;
                    assert.strictEqual(body.length, 10);

                    body.forEach((item) => {
                        assert(item.id);
                        assert(item.label);
                        assert(item.audiourl);
                    });

                    assert.strictEqual(res.header['content-range'], 'items 0-9/20');

                    return store.deleteEntireProject(USERID, CLASSID, project);
                });
        });
    });


    describe('deleteTraining()', () => {

        it('should verify permissions', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            const trainingurl = '/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/training';

            nextUser = AUTH_USERS.STUDENT;

            const first = await store.storeSoundTraining(projectid, 'url', 'label', uuid());
            const second = await store.storeSoundTraining(projectid, 'url', 'label', uuid());


            return request(testServer)
                .get(trainingurl)
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK)
                .then((res) => {
                    const body = res.body;
                    assert.strictEqual(body.length, 2);
                    assert.strictEqual(res.header['content-range'], 'items 0-1/2');

                    nextUser = AUTH_USERS.OTHERSTUDENT;

                    return request(testServer)
                        .delete('/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/training/' + first.id)
                        .expect(httpstatus.FORBIDDEN);
                })
                .then(() => {
                    nextUser = AUTH_USERS.STUDENT;

                    return request(testServer)
                        .delete('/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + 'differentprojectid' +
                                '/training/' + second.id)
                        .expect(httpstatus.NOT_FOUND);
                })
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK)
                        .then((res) => {
                            const body = res.body;
                            assert.strictEqual(body.length, 2);
                            assert.strictEqual(res.header['content-range'], 'items 0-1/2');
                        });
                })
                .then(() => {
                    return request(testServer)
                        .delete('/api/classes/' + CLASSID +
                                '/students/' + USERID +
                                '/projects/' + projectid +
                                '/training/' + second.id)
                        .expect(httpstatus.NO_CONTENT);
                })
                .then(() => {
                    return request(testServer)
                        .get(trainingurl)
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK)
                        .then((res) => {
                            const body = res.body;
                            assert.strictEqual(body.length, 1);
                            assert.deepStrictEqual(body[0].audiourl, first.audiourl);
                            assert.strictEqual(res.header['content-range'], 'items 0-0/1');
                        });
                })
                .then(() => {
                    return store.deleteEntireUser(USERID, CLASSID);
                });
        });
    });





    describe('deleteProject()', () => {

        it('should delete everything', async () => {
            const project = await store.storeProject(USERID, CLASSID, 'sounds', 'demo', 'en', [], false);
            const projectid = project.id;

            await store.addLabelToProject(USERID, CLASSID, projectid, 'animal');
            await store.addLabelToProject(USERID, CLASSID, projectid, 'vegetable');
            await store.addLabelToProject(USERID, CLASSID, projectid, 'mineral');

            await store.storeSoundTraining(projectid, 'url', 'vegetable', uuid());
            await store.storeSoundTraining(projectid, 'url', 'animal', uuid());
            await store.storeSoundTraining(projectid, 'url', 'animal', uuid());

            const projecturl = '/api/classes/' + CLASSID +
                               '/students/' + USERID +
                               '/projects/' + projectid;

            nextUser = AUTH_USERS.STUDENT;

            return request(testServer)
                .delete(projecturl)
                .expect(httpstatus.NO_CONTENT)
                .then(async () => {
                    const count = await store.countTraining('sounds', projectid);
                    assert.strictEqual(count, 0);

                    try {
                        await store.getProject(projectid);
                        assert.fail('should not be here');
                    }
                    catch (err) {
                        assert(err);
                    }
                });
        });

    });

});
