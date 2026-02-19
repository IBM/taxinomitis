// external dependencies
import * as express from 'express';
import * as path from 'path';
import * as compression from 'compression';
// local dependencies
import * as constants from '../utils/constants';
import * as env from '../utils/env';
import * as deployment from '../utils/deployment';

export const CSP_DIRECTIVES: Record<string, string[]> = {
    defaultSrc: ["'self'",
        // used for auth
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
    ],
    styleSrc: ["'self'",
        // Angular UI Router adds empty style="" attribute to ui-view elements
        // This hash allows only empty inline styles (sha256 of empty string)
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
        // used by in-browser page translations
        'https://www.gstatic.com',
    ],
    scriptSrc: ["'self'", 'blob:',
        // TODO : https://github.com/IBM/taxinomitis/issues/346 should remove this
        "'unsafe-eval'",
        "'unsafe-inline'",
        // used for auth
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
        'https://dalelane.eu.auth0.com',
        // used to load profile pics in the login dialog
        'https://secure.gravatar.com',
        // used to embed videos in the Worksheets tab
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        // used for error capturing
        'https://browser.sentry-cdn.com',
        // used for analytics
        'https://scripts.withcabin.com',
        // used for small language models
        'https://esm.run',
        'https://cdn.jsdelivr.net',
        // useful when running locally
        'https://machinelearningforkids.co.uk',
    ],
    scriptSrcElem: ["'self'", 'blob:',
        // TODO : https://github.com/IBM/taxinomitis/issues/346 should remove this
        "'unsafe-eval'",
        "'unsafe-inline'",
        // used for auth
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
        'https://dalelane.eu.auth0.com',
        // used to load profile pics in the login dialog
        'https://secure.gravatar.com',
        // used to embed videos in the Worksheets tab
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        // used for error capturing
        'https://browser.sentry-cdn.com',
        // used for analytics
        'https://scripts.withcabin.com',
        // used for small language models
        'https://esm.run',
        'https://cdn.jsdelivr.net',
        // useful when running locally
        'https://machinelearningforkids.co.uk',
    ],
    scriptSrcAttr: [
        // Required for inline event handlers (onclick, onload, data-toggle, etc.)
        "'unsafe-inline'",
    ],
    frameSrc: ["'self'",
        // used in the About and Worksheets tabs
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
    ],
    imgSrc: ["'self'",
        // used for auth
        'https://auth0.com',
        'http://cdn.auth0.com',
        'https://cdn.auth0.com',
        'https://cdn.eu.auth0.com',
        // used for various things, including training data thumbnails
        'data:', 'blob:',
        // used for training data, which students can use from any site
        '*',
    ],
    workerSrc: ["'self'",
        // used for Scratch extensions
        'blob:',
    ],
    fontSrc: ["'self'",
        // used in Scratch by Blockly
        'data:',
        // used by in-browser page translations
        'https://fonts.gstatic.com',
    ],
    connectSrc: ["'self'",
        // used for accessing cached APIs
        'https://proxy.machinelearningforkids.co.uk',
        // used for error capturing
        'https://sentry.io',
        // used for analytics
        'https://ping.withcabin.com',
        // used for small language models
        'https://huggingface.co',
        'https://cas-bridge.xethub.hf.co',
        'https://raw.githubusercontent.com',
        // useful when running locally
        'https://machinelearningforkids.co.uk',
        // used by in-browser page translations
        'https://translate.googleapis.com',
    ].concat(env.getNumbersServiceHostUrls()), // used for numbers service
};

if (process.env.AUTH0_CUSTOM_DOMAIN) {
    const auth0CustomDomain = 'https://' + process.env.AUTH0_CUSTOM_DOMAIN;
    CSP_DIRECTIVES.connectSrc.push(auth0CustomDomain);
    CSP_DIRECTIVES.frameSrc.push(auth0CustomDomain);
}

if (deployment.isProdDeployment() && process.env.SENTRY_CSP_REPORT_URI) {
    CSP_DIRECTIVES.reportUri = [ process.env.SENTRY_CSP_REPORT_URI ];
}


function removeFrameBlockingHeaders(req: express.Request, res: express.Response, next: express.NextFunction): void {
    res.removeHeader('x-frame-options');
    next();
}


export function setupUI(app: express.Application): void {
    const tfjslocation: string = path.join(__dirname, '/../../../web/static/bower_components/tensorflow-models');
    app.use('/static/bower_components/tensorflow-models', compression(), express.static(tfjslocation, { maxAge : constants.ONE_YEAR }));

    for (const staticfile of [ '/sitemap.xml', '/robots.txt', '/favicon.ico' ]) {
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

    app.get('/about', (req, res) => { res.redirect('/#!/about'); });
    app.get('/projects', (req, res) => { res.redirect('/#!/projects'); });
    app.get('/teacher', (req, res) => { res.redirect('/#!/teacher'); });
    app.get('/worksheets', (req, res) => { res.redirect('/#!/worksheets'); });
    app.get('/help', (req, res) => { res.redirect('/#!/help'); });
    app.get('/signup', (req, res) => { res.redirect('/#!/signup'); });
    app.get('/login', (req, res) => { res.redirect('/#!/login'); });
    app.get('/apikeys-guide', (req, res) => { res.redirect('/#!/apikeys-guide'); });
    app.get('/pretrained', (req, res) => { res.redirect('/#!/pretrained'); });
    app.get('/book', (req, res) => { res.redirect('/#!/book'); });

    app.get('/scratch', (req, res) => { res.redirect('/scratch/'); });
    app.get('/scratch3', (req, res) => { res.redirect('/scratch/'); });

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

