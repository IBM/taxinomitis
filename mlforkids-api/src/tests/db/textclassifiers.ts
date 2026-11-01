import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';


describe('DB store - text classifier heads', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    function createProject(): Objects.Project {
        return {
            id : uuid(),
            userid : uuid(),
            classid : uuid(),
            type : 'text',
            name : 'my text project',
            labels : [ 'happy', 'sad' ],
            language : 'en',
            numfields : 0,
            isCrowdSourced : false,
        };
    }


    describe('storeTextClassifierHead', () => {
        it('should store a head', async () => {
            const id = uuid();
            const project = createProject();
            const head = Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x54, 0x58, 0x54, 0x01, 0x00, 0xff ]);
            const updated = new Date('2026-11-01T14:03:22Z');

            const stored = await store.storeTextClassifierHead(id, project, head, updated);
            assert.deepStrictEqual(stored, {
                id,
                projectid : project.id,
                userid : project.userid,
                head : Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x54, 0x58, 0x54, 0x01, 0x00, 0xff ]),
                updated : new Date('2026-11-01T14:03:22Z'),
            });

            const retrieved = await store.getTextClassifierHead(id);
            assert.deepStrictEqual(retrieved, stored);

            await store.deleteTextClassifierHead(id);
        });

        it('should replace the head when a model is retrained', async () => {
            const id = uuid();
            const project = createProject();

            await store.storeTextClassifierHead(id, project,
                Buffer.from([ 0x01, 0x02, 0x03 ]),
                new Date('2026-11-01T14:03:22Z'));
            await store.storeTextClassifierHead(id, project,
                Buffer.from([ 0x04, 0x05, 0x06, 0x07 ]),
                new Date('2026-11-02T09:15:00Z'));

            const retrieved = await store.getTextClassifierHead(id);
            assert.deepStrictEqual(retrieved, {
                id,
                projectid : project.id,
                userid : project.userid,
                head : Buffer.from([ 0x04, 0x05, 0x06, 0x07 ]),
                updated : new Date('2026-11-02T09:15:00Z'),
            });

            await store.deleteTextClassifierHead(id);
        });
    });


    describe('getTextClassifierHead', () => {
        it('should return nothing for an unknown id', async () => {
            const retrieved = await store.getTextClassifierHead(uuid());
            assert.strictEqual(retrieved, undefined);
        });
    });


    describe('getTextClassifierHeadUpdated', () => {
        it('should return when the model was last trained', async () => {
            const id = uuid();
            const project = createProject();
            await store.storeTextClassifierHead(id, project, Buffer.from([ 0x01 ]), new Date('2026-11-01T14:03:22Z'));
            await store.storeTextClassifierHead(id, project, Buffer.from([ 0x02 ]), new Date('2026-11-03T08:00:00Z'));

            const updated = await store.getTextClassifierHeadUpdated(id);
            assert.deepStrictEqual(updated, new Date('2026-11-03T08:00:00Z'));

            await store.deleteTextClassifierHead(id);
        });

        it('should return nothing for an unknown id', async () => {
            const updated = await store.getTextClassifierHeadUpdated(uuid());
            assert.strictEqual(updated, undefined);
        });
    });


    describe('deleteTextClassifierHead', () => {
        it('should delete only the requested head', async () => {
            const project = createProject();
            const deleteId = uuid();
            const keepId = uuid();
            await store.storeTextClassifierHead(deleteId, project, Buffer.from([ 0x01 ]), new Date());
            await store.storeTextClassifierHead(keepId, project, Buffer.from([ 0x02 ]), new Date());

            await store.deleteTextClassifierHead(deleteId);

            assert.strictEqual(await store.getTextClassifierHead(deleteId), undefined);
            const kept = await store.getTextClassifierHead(keepId);
            assert.deepStrictEqual(kept?.head, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifierHead(keepId);
        });

        it('should not fail for an unknown id', async () => {
            await store.deleteTextClassifierHead(uuid());
        });
    });


    describe('deleteEntireProject', () => {
        it('should delete the heads for the project', async () => {
            const deletedProject = createProject();
            const otherProject = { ...createProject(), userid : deletedProject.userid, classid : deletedProject.classid };
            const deleteId = uuid();
            const keepId = uuid();
            await store.storeTextClassifierHead(deleteId, deletedProject, Buffer.from([ 0x01 ]), new Date());
            await store.storeTextClassifierHead(keepId, otherProject, Buffer.from([ 0x02 ]), new Date());

            await store.deleteEntireProject(deletedProject.userid, deletedProject.classid, deletedProject);

            assert.strictEqual(await store.getTextClassifierHead(deleteId), undefined);
            const kept = await store.getTextClassifierHead(keepId);
            assert.deepStrictEqual(kept?.head, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifierHead(keepId);
        });
    });


    describe('deleteEntireUser', () => {
        it('should delete the heads for the user', async () => {
            const deletedUserProject = createProject();
            const otherUserProject = { ...createProject(), classid : deletedUserProject.classid };
            const deleteId = uuid();
            const keepId = uuid();
            await store.storeTextClassifierHead(deleteId, deletedUserProject, Buffer.from([ 0x01 ]), new Date());
            await store.storeTextClassifierHead(keepId, otherUserProject, Buffer.from([ 0x02 ]), new Date());

            await store.deleteEntireUser(deletedUserProject.userid, deletedUserProject.classid);

            assert.strictEqual(await store.getTextClassifierHead(deleteId), undefined);
            const kept = await store.getTextClassifierHead(keepId);
            assert.deepStrictEqual(kept?.head, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifierHead(keepId);
        });
    });
});
