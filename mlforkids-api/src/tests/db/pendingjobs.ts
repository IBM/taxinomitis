/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';



describe('DB store - pending jobs', () => {

    before(() => {
        return store.init();
    });
    beforeEach(() => {
        return store.deleteAllPendingJobs();
    });
    after(() => {
        return store.disconnect();
    });



    describe('create jobs', () => {

        it('should store a job to delete images', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();
            const objectid = uuid();

            const job = await store.storeDeleteObjectJob(classid, userid, projectid, objectid);
            const expectedSpec = {
                classid, userid, projectid, objectid,
            };
            assert.deepStrictEqual(job.jobdata, expectedSpec);

            assert.strictEqual(job.jobtype, 1);
            assert.strictEqual(job.attempts, 0);
            assert(job.id);
        });

        it('should store a job to delete projects', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const job = await store.storeDeleteProjectObjectsJob(classid, userid, projectid);
            const expectedSpec = {
                classid, userid, projectid,
            };
            assert.deepStrictEqual(job.jobdata, expectedSpec);

            assert.strictEqual(job.jobtype, 2);
            assert.strictEqual(job.attempts, 0);
            assert(job.id);
        });

        it('should store a job to delete users', async () => {
            const classid = uuid();
            const userid = uuid();

            const job = await store.storeDeleteUserObjectsJob(classid, userid);
            const expectedSpec = {
                classid, userid,
            };
            assert.deepStrictEqual(job.jobdata, expectedSpec);

            assert.strictEqual(job.jobtype, 3);
            assert.strictEqual(job.attempts, 0);
            assert(job.id);
        });

        it('should store a job to delete classes', async () => {
            const classid = uuid();

            const job = await store.storeDeleteClassObjectsJob(classid);
            const expectedSpec = {
                classid,
            };
            assert.deepStrictEqual(job.jobdata, expectedSpec);

            assert.strictEqual(job.jobtype, 4);
            assert.strictEqual(job.attempts, 0);
            assert(job.id);
        });
    });


    describe('retrieve jobs', () => {

        it('should retrieve a job to delete images', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();
            const imageid = uuid();

            const job = await store.storeDeleteObjectJob(classid, userid, projectid, imageid);

            const fetch = await store.getNextPendingJob();
            assert.deepStrictEqual(fetch, job);
        });

        it('should retrieve a job to delete projects', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const job = await store.storeDeleteProjectObjectsJob(classid, userid, projectid);

            const fetch = await store.getNextPendingJob();
            assert.deepStrictEqual(fetch, job);
        });

        it('should retrieve a job to delete users', async () => {
            const classid = uuid();
            const userid = uuid();

            const job = await store.storeDeleteUserObjectsJob(classid, userid);

            const fetch = await store.getNextPendingJob();
            assert.deepStrictEqual(fetch, job);
        });

        it('should retrieve a job to delete classes', async () => {
            const classid = uuid();

            const job = await store.storeDeleteClassObjectsJob(classid);

            const fetch = await store.getNextPendingJob();
            assert.deepStrictEqual(fetch, job);
        });


        it('should handle multiple jobs', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();
            const imageid = uuid();

            const allJobs: any = {};
            allJobs.image = await store.storeDeleteObjectJob(classid, userid, projectid, imageid);
            allJobs.project = await store.storeDeleteProjectObjectsJob(classid, userid, projectid);
            allJobs.user = await store.storeDeleteUserObjectsJob(classid, userid);

            assert.strictEqual(Object.keys(allJobs).length, 3);

            let next = await store.getNextPendingJob();
            while (next) {
                switch (next.jobtype) {
                case 1:
                    assert.deepStrictEqual(next, allJobs.image);
                    delete allJobs.image;
                    break;
                case 2:
                    assert.deepStrictEqual(next, allJobs.project);
                    delete allJobs.project;
                    break;
                case 3:
                    assert.deepStrictEqual(next, allJobs.user);
                    delete allJobs.user;
                    break;
                }

                await store.deletePendingJob(next);

                next = await store.getNextPendingJob();
            }

            assert.strictEqual(Object.keys(allJobs).length, 0);
        });

    });


    describe('delete job', () => {

        it('should delete a new job', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();
            const imageid = uuid();

            const job = await store.storeDeleteObjectJob(classid, userid, projectid, imageid);

            const retrieveBefore = await store.getNextPendingJob();
            assert.deepStrictEqual(job, retrieveBefore);

            await store.deletePendingJob(job);

            const retrieveAfter = await store.getNextPendingJob();
            assert(retrieveAfter === undefined);
        });


        it('should delete a failed job', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();
            const imageid = uuid();

            const job = await store.storeDeleteObjectJob(classid, userid, projectid, imageid);
            await store.recordUnsuccessfulPendingJobExecution(job);

            const retrieveBefore = await store.getNextPendingJob();
            assert(retrieveBefore);
            if (retrieveBefore) {
                assert.strictEqual(job.id, retrieveBefore.id);
                assert.strictEqual(retrieveBefore.attempts, 1);
            }

            await store.deletePendingJob(job);

            const retrieveAfter = await store.getNextPendingJob();
            assert(retrieveAfter === undefined);
        });
    });


    describe('failing jobs', () => {

        it('should mark a job as failed', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const job = await store.storeDeleteProjectObjectsJob(classid, userid, projectid);
            const expectedSpec = {
                classid, userid, projectid,
            };
            assert.deepStrictEqual(job.jobdata, expectedSpec);

            assert.strictEqual(job.jobtype, 2);
            assert.strictEqual(job.attempts, 0);
            assert(job.id);

            const fetch = await store.getNextPendingJob();
            assert.deepStrictEqual(fetch, job);

            const before = new Date();

            const updated = await store.recordUnsuccessfulPendingJobExecution(job);

            const after = new Date();

            assert.strictEqual(updated.id, job.id);
            assert.strictEqual(updated.jobtype, job.jobtype);
            assert.deepStrictEqual(updated.jobdata, job.jobdata);
            assert.strictEqual(updated.attempts, job.attempts + 1);
            assert(updated.lastattempt);
            if (updated.lastattempt) {
                assert(updated.lastattempt.getTime() >= before.getTime());
                assert(updated.lastattempt.getTime() <= after.getTime());
            }
        });


        it('should handle multiple failures', async () => {
            const classid = uuid();
            const userid = uuid();

            const job = await store.storeDeleteUserObjectsJob(classid, userid);

            let current = job;
            for (let i = 0; i < 8; i++) {
                current = await store.recordUnsuccessfulPendingJobExecution(current);
            }

            const before = new Date();
            before.setMilliseconds(0);
            await store.recordUnsuccessfulPendingJobExecution(current);
            await oneSecond();
            const after = new Date();
            after.setMilliseconds(0);

            const retrieved = await store.getNextPendingJob();
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.id, job.id);
                assert.strictEqual(retrieved.jobtype, job.jobtype);
                assert.deepStrictEqual(retrieved.jobdata, job.jobdata);
                assert.strictEqual(retrieved.attempts, 9);
                assert(retrieved.lastattempt);
                if (retrieved.lastattempt) {
                    assert(retrieved.lastattempt.getTime() >= before.getTime());
                    assert(retrieved.lastattempt.getTime() <= after.getTime());
                }
            }
        });

    });

    function oneSecond(): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }

});
