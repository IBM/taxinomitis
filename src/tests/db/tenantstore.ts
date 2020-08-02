/*eslint-env mocha */
import * as assert from 'assert';
import { v4 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as Types from '../../lib/db/db-types';



describe('DB store - tenants', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    it('should retrieve the test tenant policy', async () => {
        const expected: Types.ClassTenant = {
            id : 'TESTTENANT',
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.Managed,
            maxUsers : 8,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 2,
            imageClassifierExpiry : 1,
        };
        const policy = await store.getClassTenant('TESTTENANT');

        assert.deepStrictEqual(policy, expected);
    });

    it('should ignore attempts to delete non-existing tenants', async () => {
        const id = uuid();
        await store.deleteClassTenant(id);
        assert('okay');
    });

    it('should delete a tenant', async () => {
        const id = uuid();
        const newclass: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 2, 4);
        let fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(newclass, fetched);
        assert.strictEqual(fetched.textClassifierExpiry, 2);
        assert.strictEqual(fetched.imageClassifierExpiry, 4);

        await store.deleteClassTenant(id);

        fetched = await store.getClassTenant(id);
        assert.strictEqual(fetched.textClassifierExpiry, 24);
        assert.strictEqual(fetched.imageClassifierExpiry, 24);
    });


    it('should modify non-existent tenant policies', async () => {
        const id = uuid();
        const newclass: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 100, 40);
        assert.deepStrictEqual(newclass, {
            id,
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 30,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 100,
            imageClassifierExpiry : 40,
        });

        const fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(newclass, fetched);

        await store.deleteClassTenant(id);
    });

    it('should modify existing tenant policies', async () => {
        const id = uuid();
        const newclass: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 6, 7);
        assert.deepStrictEqual(newclass, {
            id,
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 30,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 6,
            imageClassifierExpiry : 7,
        });

        let fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, {
            id,
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 30,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 6,
            imageClassifierExpiry : 7,
        });

        const updated: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 12, 14);
        assert.deepStrictEqual(updated, {
            id,
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 30,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 12,
            imageClassifierExpiry : 14,
        });

        fetched = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, {
            id,
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 30,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 12,
            imageClassifierExpiry : 14,
        });

        await store.deleteClassTenant(id);

        fetched = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, {
            id,
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 30,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 24,
            imageClassifierExpiry : 24,
        });
    });

    it('should verify if tenants have requested notifications', async () => {
        const optout = await store.hasTenantOptedOutOfNotifications('do-not-notify-me');
        const optin = await store.hasTenantOptedOutOfNotifications(uuid());

        assert.strictEqual(optout, true, 'failed to recognize opt-out');
        assert.strictEqual(optin, false, 'incorrectly identified new id');
    });

    it('should store a managed class tenant', async () => {
        const id = 'thisisthemanagedclasstenantid';
        const tenant = await store.storeManagedClassTenant(id, 123, 6, Types.ClassTenantType.Managed);
        assert.deepStrictEqual(tenant, {
            id,
            maxProjectsPerUser : 6,
            textClassifierExpiry : 24,
            imageClassifierExpiry : 24,
            maxUsers : 124,
            tenantType : Types.ClassTenantType.Managed,
            supportedProjectTypes : [ 'text', 'images', 'numbers', 'sounds' ],
        });
        return store.deleteClassTenant(id);
    });

    it('should recognize disruptive tenants', () => {
        return store.isTenantDisruptive('ignore-errors-for-me')
            .then((resp) => {
                assert.strictEqual(resp, true);
            });
    });

    it('should recognize regular tenants', () => {
        return store.isTenantDisruptive(uuid())
            .then((resp) => {
                assert.strictEqual(resp, false);
            });
    });

});
