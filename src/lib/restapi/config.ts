// external dependencies
import * as express from 'express';
import * as httpstatus from 'http-status';
import * as path from 'path';
import * as compression from 'compression';
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
                const host: string = req.headers.host as string;

                res.redirect(httpstatus.MOVED_PERMANENTLY,
                            'https://' + host.substr(4) + req.url);
            }
            else {
                next();
            }
        });
    }
}

export const CSP_DIRECTIVES = {
    defaultSrc: ["'self'",
        // used for auth
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
        // used for analytics
        'https://www.google-analytics.com',
    ],
    styleSrc: ["'self'",
        // TODO : https://github.com/IBM/taxinomitis/issues/346 should remove this
        "'unsafe-inline'",
        // used to embed tweets in the News tab
        'https://ton.twimg.com',
        'https://platform.twitter.com',
    ],
    scriptSrc: ["'self'",
        // TODO : https://github.com/IBM/taxinomitis/issues/346 should investigate these
        "'unsafe-eval'",
        "'unsafe-inline'",
        // used for auth
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
        // used to embed links in the News tab
        'http://embed-assets.wakelet.com',
        // used to embed tweets in the News tab
        'http://platform.twitter.com',
        'https://cdn.syndication.twimg.com',
        // used to embed videos in the News tab
        'https://www.youtube.com',
        // used to embed video in the Worksheets tab
        'https://player.vimeo.com',
        // used for analytics
        'https://www.google-analytics.com',
        'https://www.googletagmanager.com',
        // used for error capturing
        'https://browser.sentry-cdn.com',
        // useful when running locally
        'https://machinelearningforkids.co.uk',
    ],
    frameSrc: ["'self'",
        // used in the News tab
        'http://embed.wakelet.com',
        'https://syndication.twitter.com',
        'https://platform.twitter.com',
        'https://www.youtube.com',
        // used in the Worksheets tab
        'https://player.vimeo.com'
    ],
    imgSrc: ["'self'",
        // used for auth
        'https://auth0.com',
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
        // used for tweets in the News tab
        'https://pbs.twimg.com',
        'https://ton.twimg.com',
        'https://platform.twitter.com',
        'https://syndication.twitter.com',
        // used for analytics
        'https://www.google-analytics.com',
        // used for various things, including training data thumbnails
        'data:', 'blob:',
        // used for training data, which can be used from any site
        'https://*', 'http://*',
    ],
    workerSrc: ["'self'",
        // used for Scratch extensions
        'blob:',
    ],
    fontSrc: ["'self'",
        // used in Scratch by Blockly
        'data:',
    ],
};


// to allow easier local development, we want the hosted instance to allow
//  private/localhost to be able to fetch tfjs models for use in Scratch
const ALLOWED_CORS_ORIGINS = [
    'http://ml-for-kids-local.net:3000',
    'http://ml-for-kids-local.net:9000',
];
function addCorsHeaders(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (ALLOWED_CORS_ORIGINS.includes(req.headers.origin || '')) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
    next();
}
function removeFrameBlockingHeaders(req: express.Request, res: express.Response, next: express.NextFunction): void {
    res.removeHeader('x-frame-options');
    next();
}



export function setupUI(app: express.Application): void {
    const tfjslocation: string = path.join(__dirname, '/../../../web/static/bower_components/tensorflow-models');
    app.use('/static/bower_components/tensorflow-models', compression(), addCorsHeaders, express.static(tfjslocation, { maxAge : constants.ONE_YEAR }));

    const twittercardlocation: string = path.join(__dirname, '/../../../web/dynamic/twitter-card.html');
    app.use('/twitter-card.html', compression(), removeFrameBlockingHeaders, express.static(twittercardlocation, { maxAge : constants.ONE_YEAR }));

    const uilocation: string = path.join(__dirname, '/../../../web/static');
    app.use('/static', compression(), express.static(uilocation, { maxAge : constants.ONE_YEAR }));

    const scratchxlocation: string = path.join(__dirname, '/../../../web/scratchx');
    app.use('/scratchx', compression(), express.static(scratchxlocation, { maxAge : constants.ONE_WEEK }));

    const scratch3location: string = path.join(__dirname, '/../../../web/scratch3');
    app.use('/scratch3', compression(), express.static(scratch3location, { maxAge : constants.ONE_WEEK }));

    const datasetslocation: string = path.join(__dirname, '/../../../web/datasets');
    app.use('/datasets', compression(), express.static(datasetslocation, { maxAge : constants.ONE_WEEK }));


    app.get('/about', (req, res) => { res.redirect('/#!/about'); });
    app.get('/projects', (req, res) => { res.redirect('/#!/projects'); });
    app.get('/news', (req, res) => { res.redirect('/#!/news'); });
    app.get('/teacher', (req, res) => { res.redirect('/#!/teacher'); });
    app.get('/worksheets', (req, res) => { res.redirect('/#!/worksheets'); });
    app.get('/help', (req, res) => { res.redirect('/#!/help'); });
    app.get('/signup', (req, res) => { res.redirect('/#!/signup'); });
    app.get('/login', (req, res) => { res.redirect('/#!/login'); });
    app.get('/apikeys-guide', (req, res) => { res.redirect('/#!/apikeys-guide'); });
    app.get('/pretrained', (req, res) => { res.redirect('/#!/pretrained'); });

    const indexHtml: string = path.join(__dirname, '/../../../web/dynamic');
    app.use('/', express.static(indexHtml, { maxAge : 0 }));
}
