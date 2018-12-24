// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as auth from './auth';
import * as store from '../db/store';
import * as classifiers from '../training/classifiers';
import * as Types from '../training/training-types';
import * as urls from './urls';
import * as errors from './errors';
import * as headers from './headers';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




// to avoid returning potentially sensitive Bluemix credentials
//  in API responses, the ClassifierSummary objects need to be
//  filtered to just the safe data
function filterClassifierInfo(complete: Types.ClassifierSummary) {
    return {
        id : complete.id,
        name : complete.name,
        type : complete.type,
        credentials : {
            id : complete.credentials.id,
            // this is where most of the removed fields are
        },
    };
}



/**
 * Fetch a list of classifiers that exist in Bluemix, without a corresponding
 * entry in the app database.
 *
 * These are classifiers that were created outside of the tool, or that were
 * supposed to be deleted but accidentally left in Bluemix.
 */
async function getUnmanagedClassifiers(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;

    const type: string = req.query.type;
    if (!type || type !== 'unmanaged') {
        return errors.missingData(res);
    }

    // fetch the two lists of problem classifiers in parallel
    const responsePromises = [
        classifiers.getUnknownTextClassifiers(classid),
        classifiers.getUnknownImageClassifiers(classid),
    ];

    Promise.all(responsePromises)
        .then((response) => {
            // it's expensive to generate these lists, so tell
            //  the browsers to cache it for an hour before
            //  requesting it again
            res.set(headers.CACHE_1HOUR)
               .json({
                   conv : response[0].map(filterClassifierInfo),
                   visrec : response[1].map(filterClassifierInfo),
               });
        })
        .catch((err) => {
            log.error({ err }, 'Server error while fetching unmanaged classifiers');
            errors.unknownError(res, err);
        });
}




async function deleteBluemixClassifier(req: Express.Request, res: Express.Response) {

    //
    // get the request attributes
    //

    const classid: string = req.params.classid;
    const classifierid: string = req.params.classifierid;

    const credentialsid: string = req.query.credentialsid;
    if (!credentialsid || credentialsid.trim().length === 0) {
        return errors.missingData(res);
    }

    const type: string = req.query.type;
    if (!type || (type !== 'conv' && type !== 'visrec')) {
        return errors.missingData(res);
    }

    //
    // get the Bluemix credentials needed to delete the classifier
    //

    let creds;
    try {
        creds = await store.getBluemixCredentialsById(credentialsid);
    }
    catch (err) {
        log.error({ err, classid, classifierid, credentialsid },
                  'Failed to retrieve credentials needed to delete classifier');
        return errors.notFound(res);
    }

    // check that the credentials are appropriate before using
    if (creds.servicetype !== type) {
        return errors.notFound(res);
    }
    if (creds.classid !== classid) {
        return errors.forbidden(res);
    }

    //
    // delete the Bluemix classifier
    //

    await classifiers.deleteClassifier(type, creds, classifierid);

    return res.sendStatus(httpstatus.NO_CONTENT);
}





export default function registerApis(app: Express.Application) {

    app.get(urls.BLUEMIX_CLASSIFIERS,
            auth.authenticate,
            auth.checkValidUser,
            // students should only look at their own classifiers through the
            //  project model API, they should never query Bluemix resources
            //  directly
            auth.requireSupervisor,
            // unmanaged tenants need this information (about classifiers they've
            //  created outside of machinelearningforkids) so they are aware of the
            //  implications for their class
            // managed tenants should never have classifiers created outside of the
            //  tool, as they don't have access to the Bluemix credentials / API keys
            //  to be able to do that. And if any are accidentally left behind,
            //  they're automatically deleted by scheduled jobs. So they shouldn't
            //  need to call this.
            auth.ensureUnmanaged,
            getUnmanagedClassifiers);

    app.delete(urls.BLUEMIX_CLASSIFIER,
               auth.authenticate,
               auth.checkValidUser,
               // students should be deleting their models through the project models
               //  API, they should never need to explicitly remove resources from Bluemix
               auth.requireSupervisor,
               // unmanaged tenants need this information (about classifiers they've
               //  created outside of machinelearningforkids) so they are aware of the
               //  implications for their class
               // managed tenants should never have classifiers created outside of the
               //  tool, as they don't have access to the Bluemix credentials / API keys
               //  to be able to do that.
               auth.ensureUnmanaged,
               deleteBluemixClassifier);
}
