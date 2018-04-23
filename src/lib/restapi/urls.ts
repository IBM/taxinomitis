// tslint:disable:max-line-length


export const TEACHERS             = '/api/teachers';
export const CLASSES              = '/api/classes';

//
// URLS about coding groups and classes
export const CLASS                = '/api/classes/:classid';
export const BLUEMIX_CREDENTIALS  = '/api/classes/:classid/credentials';
export const BLUEMIX_CREDENTIAL   = '/api/classes/:classid/credentials/:credentialsid';
export const TENANT_POLICY        = '/api/classes/:classid/policy';
export const ALL_CLASS_PROJECTS   = '/api/classes/:classid/projects';

//
// URLS about the students in a class
export const USERS                = '/api/classes/:classid/students';
export const USER                 = '/api/classes/:classid/students/:studentid';
export const USER_PASSWORD        = '/api/classes/:classid/students/:studentid/password';

//
// URLS about student projects
export const PROJECTS             = '/api/classes/:classid/students/:studentid/projects';
export const PROJECT              = '/api/classes/:classid/students/:studentid/projects/:projectid';
// Class definitions for a project
export const FIELDS               = '/api/classes/:classid/students/:studentid/projects/:projectid/fields';
export const LABELS               = '/api/classes/:classid/students/:studentid/projects/:projectid/labels';
// Training data for a project
export const TRAININGITEMS        = '/api/classes/:classid/students/:studentid/projects/:projectid/training';
export const TRAININGITEM         = '/api/classes/:classid/students/:studentid/projects/:projectid/training/:trainingid';
// ML models for a project
export const MODELS               = '/api/classes/:classid/students/:studentid/projects/:projectid/models';
export const MODEL                = '/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid';
export const MODELTEST            = '/api/classes/:classid/students/:studentid/projects/:projectid/models/:modelid/label';
// Scratch key for a project
export const SCRATCHKEYS          = '/api/classes/:classid/students/:studentid/projects/:projectid/scratchkeys';

//
// URLs about image hosting
export const IMAGES               = '/api/classes/:classid/students/:studentid/projects/:projectid/images';
export const IMAGE                = '/api/classes/:classid/students/:studentid/projects/:projectid/images/:imageid';

//
// URLs about Scratch Keys
export const SCRATCHKEY_TRAIN     = '/api/scratch/:scratchkey/train';
export const SCRATCHKEY_CLASSIFY  = '/api/scratch/:scratchkey/classify';
export const SCRATCHKEY_STATUS    = '/api/scratch/:scratchkey/status';
export const SCRATCHKEY_EXTENSION = '/api/scratch/:scratchkey/extension.js';

//
// URLs about session users
export const SESSION_USERS        = '/api/sessionusers';
export const SESSION_USER         = '/api/classes/:classid/sessionusers/:studentid';

export const SESSION_USER_APIS    = '/api/classes/session-users/*';


// tslint:enable:max-line-length
