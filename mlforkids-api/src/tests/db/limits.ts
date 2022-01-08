/*eslint-env mocha */
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
            numberTrainingItemsPerClassProject : 0,
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

        try {
            await store.storeTextTraining(projectid, uuid(), 'label');
            assert.fail('should not have reached here');
        }
        catch (err) {
            assert.strictEqual(err.message,
                         'Project already has maximum allowed amount of training data');
        }

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

        try {
            await store.storeNumberTraining(projectid, false, [3], 'label');
            assert.fail('should not have reached here');
        }
        catch (err) {
            assert.strictEqual(err.message,
                         'Project already has maximum allowed amount of training data');
        }

        return store.deleteTrainingByProjectId('numbers', projectid);
    });
});
