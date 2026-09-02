import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as sinon from 'sinon';

import * as store from '../../lib/db/store';
import * as limits from '../../lib/db/limits';


describe('DB store - limits', () => {

    let limitsStub: sinon.SinonStub<[], {
        textTrainingItemsPerProject: number,
        numberTrainingItemsPerProject: number,
        numberTrainingItemsPerClassProject: number,
        imageTrainingItemsPerProject: number,
        soundTrainingItemsPerProject: number,
    }>;

    before(() => {
        limitsStub = sinon.stub(limits, 'getStoreLimits');
        limitsStub.returns({
            textTrainingItemsPerProject : 2,
            numberTrainingItemsPerProject : 2,
            // deliberately larger than numberTrainingItemsPerProject, so the
            //  crowd-sourced test below proves the class branch is taken
            numberTrainingItemsPerClassProject : 4,
            imageTrainingItemsPerProject : 0,
            soundTrainingItemsPerProject : 0,
        });

        return store.init();
    });
    after(() => {
        limitsStub.restore();
        return store.disconnect();
    });


    it('should enforce text training limits', async () => {
        const projectid = uuid();

        let training = await store.storeTextTraining(projectid, uuid(), 'label');
        assert(training);
        assert.strictEqual(training.projectid, projectid);
        assert.strictEqual(training.label, 'label');

        training = await store.storeTextTraining(projectid, uuid(), 'label');
        assert(training);
        assert.strictEqual(training.projectid, projectid);
        assert.strictEqual(training.label, 'label');

        await assert.rejects(
            () => store.storeTextTraining(projectid, uuid(), 'label'),
            { message: 'Project already has maximum allowed amount of training data' }
        );

        return store.deleteTrainingByProjectId('text', projectid);
    });


    it('should enforce number training limits', async () => {
        const projectid = uuid();

        let training = await store.storeNumberTraining(projectid, false, [1], 'label');
        assert(training);
        assert.strictEqual(training.projectid, projectid);
        assert.strictEqual(training.label, 'label');

        training = await store.storeNumberTraining(projectid, false, [2], 'label');
        assert(training);
        assert.strictEqual(training.projectid, projectid);
        assert.strictEqual(training.label, 'label');

        await assert.rejects(
            () => store.storeNumberTraining(projectid, false, [3], 'label'),
            { message: 'Project already has maximum allowed amount of training data' }
        );

        return store.deleteTrainingByProjectId('numbers', projectid);
    });


    it('should give crowd-sourced number projects a bigger allowance', async () => {
        // a whole class contributes to a crowd-sourced project, so it gets
        //  numberTrainingItemsPerClassProject instead of the per-user limit
        const projectid = uuid();

        // the per-user limit is 2 - go past it
        for (let i = 0; i < 4; i++) {
            const training = await store.storeNumberTraining(projectid, true, [ i ], 'label');
            assert(training);
            assert.strictEqual(training.projectid, projectid);
        }

        await assert.rejects(
            () => store.storeNumberTraining(projectid, true, [ 99 ], 'label'),
            { message: 'Project already has maximum allowed amount of training data' }
        );

        return store.deleteTrainingByProjectId('numbers', projectid);
    });


    it('should apply the smaller limit to the same project when it is not crowd-sourced', async () => {
        // same call, only the isClassProject flag differs
        const projectid = uuid();

        await store.storeNumberTraining(projectid, false, [ 1 ], 'label');
        await store.storeNumberTraining(projectid, false, [ 2 ], 'label');

        await assert.rejects(
            () => store.storeNumberTraining(projectid, false, [ 3 ], 'label'),
            { message: 'Project already has maximum allowed amount of training data' }
        );

        // ...but the same project can still accept more as a class project
        const training = await store.storeNumberTraining(projectid, true, [ 3 ], 'label');
        assert(training);

        return store.deleteTrainingByProjectId('numbers', projectid);
    });
});
