// tslint:disable:max-line-length

export const ROOT                  = '/';

export const ALL_APIS              = '/api/*';

export const TEACHERS              = '/api/teachers';
export const CLASSES               = '/api/classes';

//
// URLS about coding groups and classes
export const CLASS                 = '/api/classes/:classid';
export const BLUEMIX_CREDENTIALS   = '/api/classes/:classid/credentials';
export const BLUEMIX_CREDENTIAL    = '/api/classes/:classid/credentials/:credentialsid';
export const BLUEMIX_SUPPORT       = '/api/classes/:classid/modelsupport/:type';
export const TENANT_POLICY         = '/api/classes/:classid/policy';
export const ALL_CLASS_PROJECTS    = '/api/classes/:classid/projects';
export const BLUEMIX_CLASSIFIERS   = '/api/classes/:classid/classifiers';
export const BLUEMIX_CLASSIFIER    = '/api/classes/:classid/classifiers/:classifierid';

//
// URLS about the students in a class
export const USERS                 = '/api/classes/:classid/students';
export const USER                  = '/api/classes/:classid/students/:studentid';
export const USER_PASSWORD         = '/api/classes/:classid/students/:studentid/password';
export const PASSWORD              = '/api/classes/:classid/passwords';

//
// URLS about student projects
export const PROJECTS              = '/api/classes/:classid/students/:studentid/projects';
export const PROJECT               = '/api/classes/:classid/students/:studentid/projects/:projectid';
// Class definitions for a project
export const FIELDS                = '/api/classes/:classid/students/:studentid/projects/:projectid/fields';
export const LABELS                = '/api/classes/:classid/students/:studentid/projects/:projectid/labels';
// Training data for a project
export const TRAININGITEMS         = '/api/classes/:classid/students/:studentid/projects/:projectid/training';
export const TRAININGITEM          = '/api/classes/:classid/students/:studentid/projects/:projectid/training/:trainingid';
// ML models for a project
export const MODELS                = '/api/classes/:classid/students/:studentid/projects/:projectid/models';
export const MODEL                 = '/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid';
export const MODELTEST             = '/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid/label';
// Crowd-sourced flag for a project
export const PROJECT_CROWDSOURCED  = '/api/classes/:classid/students/:studentid/projects/:projectid/iscrowdsourced';
// Scratch key for a project
export const SCRATCHKEYS           = '/api/classes/:classid/students/:studentid/projects/:projectid/scratchkeys';

//
// URLs about training data hosting
export const IMAGES                = '/api/classes/:classid/students/:studentid/projects/:projectid/images';
export const IMAGE                 = '/api/classes/:classid/students/:studentid/projects/:projectid/images/:imageid';
export const SOUNDS                = '/api/classes/:classid/students/:studentid/projects/:projectid/sounds';
export const SOUND                 = '/api/classes/:classid/students/:studentid/projects/:projectid/sounds/:soundid';

//
// URLs about Scratch Keys
export const SCRATCHKEY_TRAIN      = '/api/scratch/:scratchkey/train';
export const SCRATCHKEY_IMAGE      = '/api/scratch/:scratchkey/images/api/classes/:classid/students/:studentid/projects/:projectid/images/:imageid';
export const SCRATCHKEY_CLASSIFY   = '/api/scratch/:scratchkey/classify';
export const SCRATCHKEY_STATUS     = '/api/scratch/:scratchkey/status';
export const SCRATCHKEY_MODEL      = '/api/scratch/:scratchkey/models';
export const SCRATCHKEY_EXTENSION  = '/api/scratch/:scratchkey/extension.js';
export const SCRATCH3_EXTENSION    = '/api/scratch/:scratchkey/extension3.js';
export const SCRATCHTFJS_EXTENSION = '/api/scratch/:scratchkey/extensiontfjs.js';
export const SCRATCHTFJS_EXTENSIONS = '/api/scratchtfjs/extensions';

//
// URLs about App Inventor
export const APPINVENTOR_EXTENSION = '/api/appinventor/:scratchkey/extension';

//
// URLs about session users
export const SESSION_USERS         = '/api/sessionusers';
export const SESSION_USER          = '/api/classes/:classid/sessionusers/:studentid';

export const SESSION_USER_APIS     = '/api/classes/session-users/*';

//
// URLs about site alerts
export const SITEALERTS            = '/api/sitealerts';
export const SITEALERTS_PUBLIC     = '/api/sitealerts/public';
export const SITEALERTS_STUDENT    = '/api/sitealerts/alerts/:classid/students/:studentid';
export const SITEALERTS_TEACHER    = '/api/sitealerts/alerts/:classid/supervisors/:studentid';
export const SITEALERTS_REFRESH    = '/api/sitealerts/actions/refresh';

//
// URLs for third-party services
export const SPOTIFY_TOKEN         = '/api/services/spotify/token';

// tslint:enable:max-line-length
