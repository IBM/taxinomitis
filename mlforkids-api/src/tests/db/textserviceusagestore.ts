import { describe, it, before, beforeEach, after } from 'node:test';
import * as assert from 'assert';
import { randomUUID } from 'node:crypto';
import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';


describe('DB store - text service usage', () => {

    before(() => {
        return store.init();
    });
    after(async () => {
        await store.testonly_resetTextServiceUsageStore();
        return store.disconnect();
    });

    beforeEach(() => {
        return store.testonly_resetTextServiceUsageStore();
    });


    function createEvent(overrides: Partial<Objects.TextServiceUsageEvent> = {}): Objects.TextServiceUsageEvent {
        return {
            recorded : new Date(),
            event : 'classify',
            outcome : 'ok',
            projectid : randomUUID(),
            durationms : 120,
            client : { source : 'website' },
            ...overrides,
        };
    }

    async function getAllEvents(): Promise<Objects.TextServiceUsageEventDbRow[]> {
        return store.getTextServiceUsageEvents(0, await store.getLatestTextServiceUsageEventId(), 100);
    }


    describe('getLatestTextServiceUsageEventId', () => {

        it('should handle an empty store', async () => {
            const maxid = await store.getLatestTextServiceUsageEventId();
            assert.strictEqual(maxid, 0);
        });

        it('should return the id of the most recent event', async () => {
            await store.storeTextServiceUsageEvent(createEvent());
            await store.storeTextServiceUsageEvent(createEvent());
            const maxid = await store.getLatestTextServiceUsageEventId();

            const events = await store.getTextServiceUsageEvents(0, maxid, 10);
            assert.strictEqual(events.length, 2);
            assert.strictEqual(events[1].id, maxid);
        });
    });


    describe('storeTextServiceUsageEvent', () => {

        it('should store every column', async () => {
            const modelid = randomUUID();
            const projectid = randomUUID();
            const recorded = new Date();
            await store.storeTextServiceUsageEvent({
                recorded,
                event : 'train-end',
                outcome : 'available',
                region : 'eu-de',
                projectid, modelid,
                tenanttype : Objects.ClassTenantType.UnManaged,
                language : 'ar',
                size : { labels : 3, examples : 25, chars : 901, weightedchars : 1351.5 },
                durationms : 2500,
                totalms : 47000,
                attempt : 2,
                retryafterms : 10000,
                client : { source : 'scratchkey', country : 'GB' },
            });

            const events = await getAllEvents();
            assert.strictEqual(events.length, 1);
            const { id, ...stored } = events[0];
            assert(id > 0);
            assert.deepStrictEqual(stored, {
                recorded,
                event : 'train-end',
                outcome : 'available',
                region : 'eu-de',
                country : 'GB',
                projectid, modelid,
                tenanttype : 0,
                language : 'ar',
                examples : 25,
                chars : 901,
                weightedchars : 1351.5,
                labels : 3,
                durationms : 2500,
                totalms : 47000,
                attempt : 2,
                retryafter : 10000,
                source : 'scratchkey',
            });
        });

        it('should store missing optional values as nulls', async () => {
            const modelid = randomUUID();
            await store.storeTextServiceUsageEvent({
                recorded : new Date(),
                event : 'train-end',
                outcome : 'abandoned',
                modelid,
            });

            const events = await getAllEvents();
            assert.strictEqual(events.length, 1);
            const { id, recorded, ...stored } = events[0];
            assert(id > 0);
            assert(recorded instanceof Date);
            assert.deepStrictEqual(stored, {
                event : 'train-end',
                outcome : 'abandoned',
                region : null,
                country : null,
                projectid : null,
                modelid,
                tenanttype : null,
                language : null,
                examples : null,
                chars : null,
                weightedchars : null,
                labels : null,
                durationms : null,
                totalms : null,
                attempt : null,
                retryafter : null,
                source : null,
            });
        });
    });


    describe('getTextServiceUsageEvents', () => {

        it('should page through events in order', async () => {
            const projectids = [];
            for (let i = 0; i < 7; i++) {
                const projectid = randomUUID();
                projectids.push(projectid);
                await store.storeTextServiceUsageEvent(createEvent({ projectid }));
            }
            const maxid = await store.getLatestTextServiceUsageEventId();

            const retrieved: (string | null)[] = [];
            let afterId = 0;
            let page = await store.getTextServiceUsageEvents(afterId, maxid, 3);
            while (page.length > 0) {
                retrieved.push(...page.map((e) => e.projectid));
                afterId = page[page.length - 1].id;
                page = await store.getTextServiceUsageEvents(afterId, maxid, 3);
            }

            assert.deepStrictEqual(retrieved, projectids);
        });

        it('should not return events after the max id', async () => {
            await store.storeTextServiceUsageEvent(createEvent());
            const maxid = await store.getLatestTextServiceUsageEventId();
            await store.storeTextServiceUsageEvent(createEvent());

            const events = await store.getTextServiceUsageEvents(0, maxid, 10);
            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].id, maxid);
        });
    });


    describe('deleteTextServiceUsageEvents', () => {

        it('should handle an empty store', async () => {
            const count = await store.deleteTextServiceUsageEvents(100);
            assert.strictEqual(count, 0);
        });

        it('should only delete events up to the max id', async () => {
            await store.storeTextServiceUsageEvent(createEvent());
            await store.storeTextServiceUsageEvent(createEvent());
            const maxid = await store.getLatestTextServiceUsageEventId();
            const remaining = createEvent();
            await store.storeTextServiceUsageEvent(remaining);

            const count = await store.deleteTextServiceUsageEvents(maxid);
            assert.strictEqual(count, 2);

            const events = await getAllEvents();
            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].projectid, remaining.projectid);
        });
    });
});
