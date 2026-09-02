import { describe, it, before, after } from 'node:test';
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
            supportedProjectTypes : ['text', 'images', 'numbers', 'sounds', 'imgtfjs'],
            tenantType : Types.ClassTenantType.Managed,
            maxUsers : 8,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 2,
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
        const newclass: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 2);
        let fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(newclass, fetched);
        assert.strictEqual(fetched.textClassifierExpiry, 2);

        await store.deleteClassTenant(id);

        fetched = await store.getClassTenant(id);
        assert.strictEqual(fetched.textClassifierExpiry, 24);
    });


    it('should modify non-existent tenant policies', async () => {
        const id = uuid();
        const newclass: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 100);
        assert.deepStrictEqual(newclass, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 31,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 100,
        });

        const fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(newclass, fetched);

        await store.deleteClassTenant(id);
    });

    it('should modify existing tenant policies', async () => {
        const id = uuid();
        const newclass: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 6);
        assert.deepStrictEqual(newclass, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 31,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 6,
        });

        let fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 31,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 6,
        });

        const updated: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 12);
        assert.deepStrictEqual(updated, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 31,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 12,
        });

        fetched = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 31,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 12,
        });

        await store.deleteClassTenant(id);

        fetched = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 31,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 24,
        });
    });

    it('should store a managed class tenant', async () => {
        const id = 'thisisthemanagedclasstenantid';
        const tenant = await store.storeManagedClassTenant(id, 123, 6, Types.ClassTenantType.Managed);
        assert.deepStrictEqual(tenant, {
            id,
            maxProjectsPerUser : 6,
            textClassifierExpiry : 24,
            maxUsers : 124,
            tenantType : Types.ClassTenantType.Managed,
            supportedProjectTypes : [ 'text', 'numbers', 'sounds', 'imgtfjs' ],
        });
        return store.deleteClassTenant(id);
    });

    it('should modify max users for a non-existent tenant', async () => {
        const id = uuid();
        const newclass: Types.ClassTenant = await store.modifyClassTenantMaxUsers(id, 50);
        assert.deepStrictEqual(newclass, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 50,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 24,
        });

        const fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(newclass, fetched);

        await store.deleteClassTenant(id);
    });

    it('should modify max users for an existing unmanaged tenant, without changing its tenant type', async () => {
        const id = uuid();
        const created: Types.ClassTenant = await store.modifyClassTenantExpiries(id, 6);
        assert.strictEqual(created.maxUsers, 31);
        assert.strictEqual(created.tenantType, Types.ClassTenantType.UnManaged);

        const updated: Types.ClassTenant = await store.modifyClassTenantMaxUsers(id, 75);
        assert.deepStrictEqual(updated, {
            id,
            supportedProjectTypes : ['text', 'imgtfjs', 'numbers', 'sounds'],
            tenantType : Types.ClassTenantType.UnManaged,
            maxUsers : 75,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 6,
        });

        const fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, updated);

        await store.deleteClassTenant(id);
    });

    it('should modify max users for an existing managed tenant, without changing its tenant type', async () => {
        const id = 'thisisthemanagedtenantformaxusers';
        const created: Types.ClassTenant = await store.storeManagedClassTenant(id, 30, 3, Types.ClassTenantType.ManagedPool);
        assert.strictEqual(created.maxUsers, 31);
        assert.strictEqual(created.tenantType, Types.ClassTenantType.ManagedPool);

        const updated: Types.ClassTenant = await store.modifyClassTenantMaxUsers(id, 75);
        assert.deepStrictEqual(updated, {
            id,
            supportedProjectTypes : [ 'text', 'numbers', 'sounds', 'imgtfjs' ],
            tenantType : Types.ClassTenantType.ManagedPool,
            maxUsers : 75,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 24,
        });

        const fetched: Types.ClassTenant = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, updated);

        await store.deleteClassTenant(id);
    });

    it('should reject invalid max users values', async () => {
        const id = uuid();

        await assert.rejects(
            store.modifyClassTenantMaxUsers(id, 0),
            { message : 'Missing required max users value' },
        );
        await assert.rejects(
            store.modifyClassTenantMaxUsers(id, -5),
            { message : 'Max users values should be a positive number' },
        );
        await assert.rejects(
            store.modifyClassTenantMaxUsers(id, 1.5),
            { message : 'Max users values should be an integer' },
        );
        await assert.rejects(
            store.modifyClassTenantMaxUsers(id, 400),
            { message : 'Max users values should not be greater than 399' },
        );
    });

    it('should update an existing class tenant', async () => {
        const id = 'thisisthetenantidbeingupdated';

        const original = await store.storeManagedClassTenant(id, 10, 3, Types.ClassTenantType.UnManaged);
        assert.deepStrictEqual(original, {
            id,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 24,
            maxUsers : 11,
            tenantType : Types.ClassTenantType.UnManaged,
            supportedProjectTypes : [ 'text', 'numbers', 'sounds', 'imgtfjs' ],
        });

        const updated = await store.updateManagedClassTenant(id, 123, 6, Types.ClassTenantType.ManagedPool);
        assert.deepStrictEqual(updated, {
            id,
            maxProjectsPerUser : 6,
            textClassifierExpiry : 24,
            maxUsers : 124,
            tenantType : Types.ClassTenantType.ManagedPool,
            supportedProjectTypes : [ 'text', 'numbers', 'sounds', 'imgtfjs' ],
        });

        const fetched = await store.getClassTenant(id);
        assert.deepStrictEqual(fetched, updated);

        return store.deleteClassTenant(id);
    });

    it('should fail to update a class tenant that does not exist', async () => {
        const id = 'thisisatenantidwithnorowinthedb';
        await assert.rejects(
            store.updateManagedClassTenant(id, 10, 3, Types.ClassTenantType.ManagedPool),
            { message : 'Failed to update managed tenant' },
        );
    });

});
