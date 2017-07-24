/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';
import * as limits from '../../lib/db/limits';


describe('DB store - limits', () => {

    let limitsStub: sinon.SinonStub;

    before(() => {
        limitsStub = sinon.stub(limits, 'getStoreLimits');
        limitsStub.returns({
            textTrainingItemsPerProject : 2,
            numberTrainingItemsPerProject : 2,
        });

        proxyquire('../../lib/db/store', {
            './limits' : limitsStub,
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
        assert.equal(training.projectid, projectid);
        assert.equal(training.label, 'label');

        training = await store.storeTextTraining(projectid, uuid(), 'label');
        assert(training);
        assert.equal(training.projectid, projectid);
        assert.equal(training.label, 'label');

        try {
            await store.storeTextTraining(projectid, uuid(), 'label');
            assert.fail(0, 1, 'should not have reached here', '');
        }
        catch (err) {
            assert.equal(err.message,
                         'Project already has maximum allowed amount of training data');
        }

        return store.deleteTrainingByProjectId('text', projectid);
    });


    it('should enforce number training limits', async () => {
        const projectid = uuid();

        let training = await store.storeNumberTraining(projectid, [1], 'label');
        assert(training);
        assert.equal(training.projectid, projectid);
        assert.equal(training.label, 'label');

        training = await store.storeNumberTraining(projectid, [2], 'label');
        assert(training);
        assert.equal(training.projectid, projectid);
        assert.equal(training.label, 'label');

        try {
            await store.storeNumberTraining(projectid, [3], 'label');
            assert.fail(0, 1, 'should not have reached here', '');
        }
        catch (err) {
            assert.equal(err.message,
                         'Project already has maximum allowed amount of training data');
        }

        return store.deleteTrainingByProjectId('numbers', projectid);
    });
});
