// external dependencies
import * as express from 'express';
import * as httpstatus from 'http-status';
import * as path from 'path';
// local dependencies
import * as constants from '../utils/constants';


export function setupForBluemix(app: express.Application): void {
    if (process.env.BLUEMIX_REGION) {
        // when running on Bluemix, need to look at use of HTTPS
        //  between browser and Bluemix (not between Bluemix proxy
        //  and the express app)
        app.enable('trust proxy');

        app.use((req, res, next) => {
            if (req.secure) {
                next();
            }
            else {
                res.redirect(httpstatus.MOVED_PERMANENTLY,
                            'https://' + req.headers.host + req.url);
            }
        });

        // when running on Bluemix, need to force non-www URLs as
        //  the auth-callbacks won't support use of www
        app.get('/*', (req, res, next) => {
            if (req.hostname.startsWith('www.')){
                res.redirect(httpstatus.MOVED_PERMANENTLY,
                            'https://' + req.headers.host.substr(4) + req.url);
            }
            else {
                next();
            }
        });
    }
}



export function setupUI(app: express.Application): void {
    const uilocation: string = path.join(__dirname, '/../../../web/static');
    app.use('/static', express.static(uilocation, { maxAge : constants.ONE_YEAR }));

    const scratchxlocation: string = path.join(__dirname, '/../../../web/scratchx');
    app.use('/scratchx', express.static(scratchxlocation, { maxAge : constants.ONE_WEEK }));

    const indexHtml: string = path.join(__dirname, '/../../../web/dynamic');
    app.use('/', express.static(indexHtml, { maxAge : 0 }));
}
