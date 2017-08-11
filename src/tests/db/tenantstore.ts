/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as uuid from 'uuid/v1';

import * as store from '../../lib/db/store';
import * as Types from '../../lib/db/db-types';



describe('DB store - tenants', () => {

    before(() => {
        return store.init();
    });


    it('should retrieve the test tenant policy', async () => {
        const expected: Types.ClassTenant = {
            id : 'TESTTENANT',
            supportedProjectTypes : ['text', 'images', 'numbers'],
            isManaged : true,
            maxUsers : 8,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 2,
            imageClassifierExpiry : 1,
        };
        const policy = await store.getClassTenant('TESTTENANT');

        assert.deepEqual(policy, expected);
    });
});
