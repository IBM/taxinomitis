/*eslint-env mocha */
import * as assert from 'assert';

import * as cf from '../../lib/utils/cf';



describe('Utils - cf', () => {

    let oldEnv: string | undefined;

    before(() => {
        oldEnv = process.env.CF_INSTANCE_INDEX;
    });
    after(() => {
        process.env.CF_INSTANCE_INDEX = oldEnv;
    });

    it('should work outside Bluemix', () => {
        delete process.env.CF_INSTANCE_INDEX;
        assert.equal(cf.isPrimaryInstance(), true);
    });

    it('should recognise when primary instance', () => {
        process.env.CF_INSTANCE_INDEX = '0';
        assert.equal(cf.isPrimaryInstance(), true);
    });

    it('should recognise when secondary instance', () => {
        process.env.CF_INSTANCE_INDEX = '1';
        assert.equal(cf.isPrimaryInstance(), false);
    });

});


