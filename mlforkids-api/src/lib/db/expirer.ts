// local dependencies
import * as store from './store';
import { LocalProject } from './db-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();

export async function deleteExpiredProjects() {
    log.info('Deleting expired projects');

    let count = 0;

    const BATCH = { start: 0, limit: 50 };

    let expiredProjects: LocalProject[] = await store.getExpiredLocalProjects(BATCH);
    log.info({ number: expiredProjects.length }, 'Batch of expired projects');
    while (expiredProjects.length > 0) {
        for (const expiredProject of expiredProjects) {
            await store.deleteEntireProject(expiredProject.userid,
                                            expiredProject.classid,
                                            expiredProject);
        }
        count += expiredProjects.length;

        expiredProjects = await store.getExpiredLocalProjects(BATCH);
    }

    log.info({ count }, 'finished deleting expired projects');
}
