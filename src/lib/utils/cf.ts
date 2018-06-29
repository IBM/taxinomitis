import * as env from './env';

/**
 * If there are multiple instances of this application running in Bluemix,
 *  we want to make sure that only one instance tries to do scheduled
 *  tasks, so we need to know which instance this is.
 *
 * Multiple instances are run in multiple Bluemix regions, so the primary
 *  instance (responsible for running scheduled tasks) is identified by an
 *  environment variable in the manifest yaml.
 *
 * @returns {Boolean} true if this is the first or only instance of this app
 */
export function isPrimaryInstance(): boolean
{
    if (process.env.CF_INSTANCE_INDEX) {
        return process.env.CF_INSTANCE_INDEX === '0' &&
               process.env[env.PRIMARY_INSTANCE] === 'true';
    }
    else {
        // not running in Bluemix, so we assume this
        //   must be the one and only instance
        return true;
    }
}
