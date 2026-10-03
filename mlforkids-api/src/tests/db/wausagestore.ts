import { describe, it, before, beforeEach, after } from 'node:test';
import * as assert from 'assert';
import { randomUUID } from 'node:crypto';
import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';


describe('DB store - text model usage', () => {

    before(() => {
        return store.init();
    });
    after(async () => {
        await store.testonly_resetWaUsageStore();
        return store.disconnect();
    });

    beforeEach(() => {
        return store.testonly_resetWaUsageStore();
    });


    function createEvent(overrides: Partial<Objects.WaUsageEvent> = {}): Objects.WaUsageEvent {
        return {
            recorded : new Date(),
            event : 'classify',
            outcome : 'ok',
            projectid : randomUUID(),
            chars : 42,
            durationms : 120,
            client : { source : 'website' },
            ...overrides,
        };
    }


    describe('getLatestWaUsageEventId', () => {

        it('should handle an empty store', async () => {
            const maxid = await store.getLatestWaUsageEventId();
            assert.strictEqual(maxid, 0);
        });

        it('should return the id of the most recent event', async () => {
            await store.storeWaUsageEvent(createEvent());
            await store.storeWaUsageEvent(createEvent());
            const maxid = await store.getLatestWaUsageEventId();

            const events = await store.getWaUsageEvents(0, maxid, 10);
            assert.strictEqual(events.length, 2);
            assert.strictEqual(events[1].id, maxid);
        });
    });


    describe('storeWaUsageEvent', () => {

        it('should store a training event', async () => {
            const modelid = randomUUID();
            const projectid = randomUUID();
            const classid = randomUUID();
            const recorded = new Date();
            await store.storeWaUsageEvent({
                recorded,
                event : 'train-new',
                outcome : 'ok',
                modelid, projectid, classid,
                tenanttype : Objects.ClassTenantType.UnManaged,
                language : 'fr',
                labels : 3,
                examples : 25,
                chars : 900,
                durationms : 2500,
                client : {
                    source : 'scratchkey',
                    useragent : 'python-requests/2.32.3',
                },
            });

            const events = await store.getWaUsageEvents(0, await store.getLatestWaUsageEventId(), 10);
            assert.strictEqual(events.length, 1);
            const { id, ...stored } = events[0];
            assert(id > 0);
            assert.deepStrictEqual(stored, {
                recorded,
                event : 'train-new',
                outcome : 'ok',
                modelid, projectid, classid,
                tenanttype : 0,
                language : 'fr',
                labels : 3,
                examples : 25,
                chars : 900,
                durationms : 2500,
                source : 'scratchkey',
                useragent : 'python-requests/2.32.3',
                xuseragent : null,
                origin : null,
            });
        });

        it('should store missing optional values as nulls', async () => {
            const modelid = randomUUID();
            await store.storeWaUsageEvent({
                recorded : new Date(),
                event : 'expire',
                outcome : 'ok',
                modelid,
                client : { source : 'server' },
            });

            const events = await store.getWaUsageEvents(0, await store.getLatestWaUsageEventId(), 10);
            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].event, 'expire');
            assert.strictEqual(events[0].modelid, modelid);
            assert.strictEqual(events[0].projectid, null);
            assert.strictEqual(events[0].classid, null);
            assert.strictEqual(events[0].tenanttype, null);
            assert.strictEqual(events[0].language, null);
            assert.strictEqual(events[0].labels, null);
            assert.strictEqual(events[0].examples, null);
            assert.strictEqual(events[0].chars, null);
            assert.strictEqual(events[0].durationms, null);
            assert.strictEqual(events[0].source, 'server');
        });

        it('should truncate long header values', async () => {
            await store.storeWaUsageEvent(createEvent({
                client : {
                    source : 'scratchkey',
                    useragent : 'u'.repeat(500),
                    xuseragent : 'x'.repeat(500),
                    origin : 'o'.repeat(500),
                },
            }));

            const events = await store.getWaUsageEvents(0, await store.getLatestWaUsageEventId(), 10);
            assert.strictEqual(events[0].useragent, 'u'.repeat(200));
            assert.strictEqual(events[0].xuseragent, 'x'.repeat(50));
            assert.strictEqual(events[0].origin, 'o'.repeat(100));
        });

        it('should store empty header values as nulls', async () => {
            await store.storeWaUsageEvent(createEvent({
                client : { source : 'scratchkey', useragent : '', xuseragent : '', origin : '' },
            }));

            const events = await store.getWaUsageEvents(0, await store.getLatestWaUsageEventId(), 10);
            assert.strictEqual(events[0].useragent, null);
            assert.strictEqual(events[0].xuseragent, null);
            assert.strictEqual(events[0].origin, null);
        });
    });


    describe('getWaUsageEvents', () => {

        it('should page through events in order', async () => {
            const projectids = [];
            for (let i = 0; i < 7; i++) {
                const projectid = randomUUID();
                projectids.push(projectid);
                await store.storeWaUsageEvent(createEvent({ projectid }));
            }
            const maxid = await store.getLatestWaUsageEventId();

            const retrieved: (string | null)[] = [];
            let afterId = 0;
            let page = await store.getWaUsageEvents(afterId, maxid, 3);
            while (page.length > 0) {
                retrieved.push(...page.map((e) => e.projectid));
                afterId = page[page.length - 1].id;
                page = await store.getWaUsageEvents(afterId, maxid, 3);
            }

            assert.deepStrictEqual(retrieved, projectids);
        });

        it('should not return events after the max id', async () => {
            await store.storeWaUsageEvent(createEvent());
            const maxid = await store.getLatestWaUsageEventId();
            await store.storeWaUsageEvent(createEvent());

            const events = await store.getWaUsageEvents(0, maxid, 10);
            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].id, maxid);
        });
    });


    describe('deleteWaUsageEvents', () => {

        it('should handle an empty store', async () => {
            const count = await store.deleteWaUsageEvents(100);
            assert.strictEqual(count, 0);
        });

        it('should only delete events up to the max id', async () => {
            await store.storeWaUsageEvent(createEvent());
            await store.storeWaUsageEvent(createEvent());
            const maxid = await store.getLatestWaUsageEventId();
            const remaining = createEvent();
            await store.storeWaUsageEvent(remaining);

            const count = await store.deleteWaUsageEvents(maxid);
            assert.strictEqual(count, 2);

            const events = await store.getWaUsageEvents(0, await store.getLatestWaUsageEventId(), 10);
            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].projectid, remaining.projectid);
        });
    });
});
