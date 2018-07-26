/*eslint-env mocha */
import * as assert from 'assert';

import * as cf from '../../lib/utils/cf';



describe('Utils - cf', () => {

    let oldEnvCf: string | undefined;
    let oldEnvIn: string | undefined;

    before(() => {
        oldEnvCf = process.env.CF_INSTANCE_INDEX;
        oldEnvIn = process.env.PRIMARY_INSTANCE;
    });
    after(() => {
        process.env.CF_INSTANCE_INDEX = oldEnvCf;
        process.env.PRIMARY_INSTANCE = oldEnvIn;
    });

    it('should work outside Bluemix', () => {
        delete process.env.CF_INSTANCE_INDEX;
        assert.strictEqual(cf.isPrimaryInstance(), true);
    });

    it('should recognise when primary instance in US-South', () => {
        process.env.CF_INSTANCE_INDEX = '0';
        process.env.PRIMARY_INSTANCE = 'true';
        assert.strictEqual(cf.isPrimaryInstance(), true);
    });

    it('should recognise when secondary instance in US-South', () => {
        process.env.CF_INSTANCE_INDEX = '1';
        process.env.PRIMARY_INSTANCE = 'true';
        assert.strictEqual(cf.isPrimaryInstance(), false);
    });

    it('should recognise when primary instance in EU-GB', () => {
        process.env.CF_INSTANCE_INDEX = '0';
        process.env.PRIMARY_INSTANCE = 'false';
        assert.strictEqual(cf.isPrimaryInstance(), false);
    });

    it('should recognise when secondary instance in EU-GB', () => {
        process.env.CF_INSTANCE_INDEX = '1';
        process.env.PRIMARY_INSTANCE = 'false';
        assert.strictEqual(cf.isPrimaryInstance(), false);
    });

});


