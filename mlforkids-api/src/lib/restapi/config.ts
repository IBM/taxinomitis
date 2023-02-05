// external dependencies
import * as express from 'express';
import * as httpstatus from 'http-status';
import * as path from 'path';
import * as compression from 'compression';
// local dependencies
import * as constants from '../utils/constants';


export const CSP_DIRECTIVES = {
    defaultSrc: ["'self'",
        // used for auth
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
    ],
    styleSrc: ["'self'",
        // TODO : https://github.com/IBM/taxinomitis/issues/346 should remove this
        "'unsafe-inline'",
        // used to embed tweets in the News tab
        'https://ton.twimg.com',
        'https://platform.twitter.com',
    ],
    scriptSrc: ["'self'",
        // TODO : https://github.com/IBM/taxinomitis/issues/346 should remove this
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
        'https://player.vimeo.com',
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
    connectSrc: ["'self'",
        // used for analytics
        'https://www.google-analytics.com',
        // used for error capturing
        '*.sentry.io',
    ],
};

if (process.env.AUTH0_CUSTOM_DOMAIN) {
    const auth0CustomDomain = 'https://' + process.env.AUTH0_CUSTOM_DOMAIN;
    CSP_DIRECTIVES.connectSrc.push(auth0CustomDomain);
    CSP_DIRECTIVES.frameSrc.push(auth0CustomDomain);
}



const ALLOWED_CORS_ORIGINS = [
    // requests from Scratch
    'https://scratch.machinelearningforkids.co.uk',
    // to allow easier local development, we want the hosted instance to allow
    //  private/localhost to be able to fetch tfjs models for use in Scratch
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


function redirectToNewScratchSubdomain(req: express.Request, res: express.Response): void {
    const newUrl = 'https://scratch.machinelearningforkids.co.uk' +
        (req.query.url ? '?url=' + req.query.url : '');
    res.redirect(httpstatus.MOVED_PERMANENTLY, newUrl);
}


export function setupUI(app: express.Application): void {
    const tfjslocation: string = path.join(__dirname, '/../../../web/static/bower_components/tensorflow-models');
    app.use('/static/bower_components/tensorflow-models', compression(), addCorsHeaders, express.static(tfjslocation, { maxAge : constants.ONE_YEAR }));

    for (const staticfile of [ '/crossdomain.xml', '/sitemap.xml', '/robots.txt', '/favicon.ico' ]) {
        const staticfilelocation: string = path.join(__dirname, '/../../../web/dynamic' + staticfile);
        app.use(staticfile, compression(), express.static(staticfilelocation, { maxAge : constants.ONE_YEAR }));
    }

    const appleicon = path.join(__dirname, '/../../../web/static/images/apple-touch-icon.png');
    app.use('/apple-touch-icon*png', compression(), express.static(appleicon, { maxAge : constants.ONE_YEAR }));

    const twittercardlocation: string = path.join(__dirname, '/../../../web/dynamic/twitter-card.html');
    app.use('/twitter-card.html', compression(), removeFrameBlockingHeaders, express.static(twittercardlocation, { maxAge : constants.ONE_YEAR }));

    app.get('/static/images/scratch3-sample-%7B%7B%20project.type%20%7D%7D.png', (req, res) => { res.redirect('/static/images/scratch3-sample-text.png'); });
    app.get('/static/images/scratch3-recognise-label-%7B%7B%20project.type%20%7D%7D.png', (req, res) => { res.redirect('/static/images/scratch3-recognise-label-text.png'); });
    app.get('/static/images/scratch3-recognise-confidence-%7B%7B%20project.type%20%7D%7D.png', (req, res) => { res.redirect('/static/images/scratch3-recognise-confidence-text.png'); });
    app.get('/static/images/scratch3-sample-sounds.png', (req, res) => { res.redirect('/static/images/scratch3-sample-text.png'); });
    app.get('/static/images/scratch3-recognise-label-sounds.png', (req, res) => { res.redirect('/static/images/scratch3-recognise-label-text.png'); });
    app.get('/static/images/scratch3-recognise-confidence-sounds.png', (req, res) => { res.redirect('/static/images/scratch3-recognise-confidence-text.png'); });

    const uilocation: string = path.join(__dirname, '/../../../web/static');
    app.use('/static', compression(), express.static(uilocation, { maxAge : constants.ONE_YEAR }));

    // Scratch has moved - leave a redirect for students who have the old location bookmarked!
    // const scratch3location: string = path.join(__dirname, '/../../../web/scratch3');
    // app.use('/scratch3', compression(), express.static(scratch3location, { maxAge : constants.ONE_WEEK }));
    app.get('/scratch3', redirectToNewScratchSubdomain);
    app.get('/scratch3/*', redirectToNewScratchSubdomain);
    // never actually a URL, but a likely typo
    app.get('/scratch', redirectToNewScratchSubdomain);

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
    app.get('/book', (req, res) => { res.redirect('/#!/book'); });

    const stories = [
        'ml-hasnt-replaced-coding',
        'ml-workflow',
        'correlation-of-quantity-with-accuracy',
        'crowdsourcing-and-gamification',
        'variety-of-training-data',
        'separation-of-training-and-test-data',
        'not-just-intents',
        'adding-errors-to-training',
        'confidence-scores',
        'black-box-challenge',
        'learning-the-wrong-thing',
        'testing-with-data-not-represented-in-training',
        'bias',
        'assembling-ml-solutions',
        'models-learn-to-do-specific-jobs',
        'invisible-ai'
    ];
    const storiesfolder = path.join(uilocation, 'stories');
    for (const story of stories) {
        app.use('/stories/' + story, express.static(storiesfolder, { index: story + '.html', maxAge : constants.ONE_YEAR }));
    }
    app.use('/stories', express.static(storiesfolder, { index: 'intro.html', maxAge : constants.ONE_YEAR }));

    const indexHtml: string = path.join(__dirname, '/../../../web/dynamic');
    app.use('/', compression(), express.static(indexHtml, { maxAge : constants.ONE_HOUR }));
}
