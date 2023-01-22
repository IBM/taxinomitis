/* eslint no-console: 0 */
/* tslint:disable: no-console max-line-length */
import * as store from '../lib/db/store';
import * as iam from '../lib/iam';
import * as wa from '../lib/training/conversation';
import loggerSetup from '../lib/utils/logger';

const log = loggerSetup();

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 1) {
    console.error('usage: node test-wa-model.js projectid');
    process.exit(-1); // eslint-disable-line
}

const projectid  = opsArgs[0];

log.info('project id : ', projectid);

log.info('creating token cache...');
iam.init();

log.info('connecting to DB...');
store.init()
    .then(() => {
        log.info('looking up project details...');
        return store.getProject(projectid);
    })
    .then((project) => {
        if (!project) {
            throw new Error('Unable to retrieve project info');
        }
        return wa.trainClassifier(project);
    })
    .then((workspace) => {
        log.info({ workspace }, 'training in progress');
    })
    .catch((err) => {
        log.error({ err }, 'something went wrong');
    })
    .then(() => {
        store.disconnect();
    });
