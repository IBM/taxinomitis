// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
// local dependencies
import * as errors from './errors';
import * as appinventor from '../scratchx/appinventor';
import * as urls from './urls';




async function getAppInventorExtension(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    try {
        const extensionStream = await appinventor.getExtension(apikey);
        res.writeHead(httpstatus.OK, {
            'Content-Disposition' : 'attachment; filename=ml4k.aix;',
        });

        extensionStream.pipe(res);
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}


export default function registerApis(app: Express.Application) {

    app.get(urls.APPINVENTOR_EXTENSION, getAppInventorExtension);

}
