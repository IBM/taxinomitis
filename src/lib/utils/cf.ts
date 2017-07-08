
/**
 * If there are multiple instances of this application running in Bluemix,
 *  we want to make sure that only one instance tries to do scheduled
 *  tasks, so we need to know which instance this is.
 *
 * @returns {Boolean} true if this is the first or only instance of this app
 */
export function isPrimaryInstance(): boolean
{
    if (process.env.CF_INSTANCE_INDEX) {
        return process.env.CF_INSTANCE_INDEX === '0';
    }
    else {
        // not running in Bluemix, so we assume this
        //   must be the one and only instance
        return true;
    }
}
