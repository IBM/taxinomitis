import { describe, it, before, after, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as expirer from '../../lib/db/expirer';
import * as Objects from '../../lib/db/db-types';
import { CLASS_NAME as SESSION_USERS_CLASSID } from '../../lib/sessionusers';
import { TWO_MONTHS, TWELVE_HOURS } from '../../lib/utils/constants';


//
// Covers the sweep that removes expired 'localprojects' rows - the server-side
//  stubs that let a browser-stored project have a Scratch key and a Watson
//  Assistant model.
//
// Nothing exercised db/expirer.ts before this, even though it runs on every
//  scheduled task pass and permanently deletes rows.
//
// Time is faked so that a project can be aged past its expiry without waiting
//  two months: getExpiredLocalProjects() compares against `new Date()`
//  evaluated in node, so moving the clock forward is enough.
//

describe('DB store - expirer', () => {

    let clock: sinon.SinonFakeTimers;

    // anything these tests create, so a failure part way through does not
    //  leave rows behind for the next run
    const created: Objects.LocalProject[] = [];


    before(async () => {
        await store.init();
    });

    after(async () => {
        await store.disconnect();
    });

    afterEach(async () => {
        if (clock) {
            clock.restore();
        }

        for (const project of created) {
            try {
                await store.deleteEntireProject(project.userid, project.classid, project);
            }
            catch {
                // already deleted by the sweep under test - that is the
                //  expected outcome for most of them
            }
        }
        created.length = 0;
    });


    async function createLocalProject(classid: string): Promise<Objects.LocalProject> {
        const project = await store.storeLocalProject(uuid(), classid, 'text', uuid(), [ 'label' ]);
        created.push(project);
        return project;
    }

    function useFakeClock(): sinon.SinonFakeTimers {
        clock = sinon.useFakeTimers({
            now : Date.now(),
            // real time keeps passing, so the postgres client's own timers
            //  still fire while the clock is faked
            shouldAdvanceTime : true,
            // the pg client sets native timers before the clock is installed
            //  and clears them afterwards - without this sinon warns every time
            shouldClearNativeTimers : true,
        });
        return clock;
    }


    describe('expiry times', () => {

        it('should give projects in a regular class a two month expiry', async () => {
            const before = Date.now();
            const project = await createLocalProject(uuid());

            const lifespan = project.expiry.getTime() - before;

            // allow a little slack for the time the insert took
            assert(lifespan > TWO_MONTHS - 60000,
                   'expected roughly two months, got ' + lifespan + 'ms');
            assert(lifespan <= TWO_MONTHS + 60000,
                   'expected roughly two months, got ' + lifespan + 'ms');
        });

        it('should give projects belonging to session users a much shorter expiry', async () => {
            const before = Date.now();
            const project = await createLocalProject(SESSION_USERS_CLASSID);

            const lifespan = project.expiry.getTime() - before;

            assert(lifespan > TWELVE_HOURS - 60000,
                   'expected roughly twelve hours, got ' + lifespan + 'ms');
            assert(lifespan <= TWELVE_HOURS + 60000,
                   'expected roughly twelve hours, got ' + lifespan + 'ms');
        });
    });


    describe('getExpiredLocalProjects', () => {

        it('should not return projects that are still current', async () => {
            const project = await createLocalProject(uuid());

            const expired = await store.getExpiredLocalProjects({ start : 0, limit : 100 });

            assert.strictEqual(expired.some((candidate) => candidate.id === project.id), false);
        });

        it('should return projects whose expiry has passed', async () => {
            const project = await createLocalProject(uuid());

            useFakeClock().tick(TWO_MONTHS + 60000);

            const expired = await store.getExpiredLocalProjects({ start : 0, limit : 1000 });

            assert(expired.some((candidate) => candidate.id === project.id));
        });

        it('should never return more than the requested number of projects', async () => {
            await createLocalProject(uuid());
            await createLocalProject(uuid());
            await createLocalProject(uuid());

            useFakeClock().tick(TWO_MONTHS + 60000);

            const expired = await store.getExpiredLocalProjects({ start : 0, limit : 2 });

            assert.strictEqual(expired.length, 2);
        });
    });


    describe('deleteExpiredProjects', () => {

        it('should delete a project once it has expired', async () => {
            const project = await createLocalProject(uuid());

            assert(await store.getLocalProject(project.id));

            useFakeClock().tick(TWO_MONTHS + 60000);

            await expirer.deleteExpiredProjects();

            assert.strictEqual(await store.getLocalProject(project.id), undefined);
        });

        it('should leave projects that have not expired alone', async () => {
            const doomed = await createLocalProject(uuid());
            const kept = await createLocalProject(uuid());

            // move past the expiry of the first project only
            useFakeClock().tick(TWO_MONTHS + 60000);

            // ...and push the second one's expiry back out to the new "now"
            await store.updateLocalProject(kept);

            await expirer.deleteExpiredProjects();

            assert.strictEqual(await store.getLocalProject(doomed.id), undefined);
            assert(await store.getLocalProject(kept.id));
        });

        it('should expire a session user project long before a regular one', async () => {
            const sessionProject = await createLocalProject(SESSION_USERS_CLASSID);
            const regularProject = await createLocalProject(uuid());

            // a day is well past twelve hours, but nowhere near two months
            useFakeClock().tick(TWELVE_HOURS * 2);

            await expirer.deleteExpiredProjects();

            assert.strictEqual(await store.getLocalProject(sessionProject.id), undefined);
            assert(await store.getLocalProject(regularProject.id));
        });

        it('should keep going beyond a single batch, and terminate', async () => {
            // the sweep fetches 50 at a time and loops until none are left. If
            //  a delete ever silently failed to remove the row, that loop would
            //  spin forever - so this both checks the second batch is processed
            //  and that the function returns at all.
            const BATCH_SIZE = 50;
            const projects: Objects.LocalProject[] = [];
            for (let i = 0; i < BATCH_SIZE + 5; i++) {
                projects.push(await createLocalProject(uuid()));
            }

            useFakeClock().tick(TWO_MONTHS + 60000);

            await expirer.deleteExpiredProjects();

            for (const project of projects) {
                assert.strictEqual(await store.getLocalProject(project.id), undefined,
                                   'project ' + project.id + ' survived the sweep');
            }
        });

        it('should cope with there being nothing to delete', async () => {
            await expirer.deleteExpiredProjects();
        });
    });

});
