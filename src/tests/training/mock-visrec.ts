import * as assert from 'assert';
import * as randomstring from 'randomstring';
import * as uuid from 'uuid/v1';
import * as tmp from 'tmp';
import * as coreReq from 'request';

import * as visrec from '../../lib/training/visualrecognition';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as downloadAndZip from '../../lib/utils/downloadAndZip';
import * as dbObjects from '../../lib/db/objects';
import * as mockIam from '../iam/mock-iam';
import requestPromise = require('request-promise');



const USERID = uuid();
const CLASSIDS = {
    LEGACY : uuid(),
    NEW : uuid(),
};

export const CREDENTIALS_LEGACY: TrainingTypes.BluemixCredentials = {
    id : uuid(),
    username : randomstring.generate(20),
    password : randomstring.generate(20),
    servicetype : 'visrec',
    url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
    classid : CLASSIDS.LEGACY,
    credstype : 'visrec_standard',
};
export const CREDENTIALS_NEW: TrainingTypes.BluemixCredentials = {
    id : uuid(),
    username : mockIam.KEYS.VALID.substr(0, 22),
    password : mockIam.KEYS.VALID.substr(22),
    servicetype : 'visrec',
    url : 'https://gateway.watsonplatform.net/visual-recognition/api',
    classid : CLASSIDS.NEW,
    credstype : 'visrec_lite',
};


const STATES = {
    NEW : 'NEW',
    GOOD : 'GOOD',
    FULL : 'FULL',
    BAD : 'BAD',
    FAIL : 'FAIL',
};


export const PROJECTS: any = {
    'my simple project name' : {
        project : {
            id : uuid(),
            name : 'my simple project name',
            classid : CLASSIDS.LEGACY,
            userid : USERID,
            labels : [ 'first', 'second', 'third' ],
            type : 'images',
            language : 'en',
            numfields : 0,
            isCrowdSourced : false,
        },
        training : {
            first : 12, second : 11, third : 17,
        },
    },
    'my shiny new and huge project' : {
        project : {
            id : uuid(),
            name : 'my shiny new and huge project',
            classid : CLASSIDS.NEW,
            userid : USERID,
            labels : [ 'left', 'right' ],
            type : 'images',
            language : 'en',
            numfields : 0,
            isCrowdSourced : false,
        },
        training : {
            left : 121, right : 117,
        },
    },
    'my failing project' : {
        project : {
            id : uuid(),
            name : 'my failing project',
            classid : CLASSIDS.LEGACY,
            userid : USERID,
            labels : [ 'does', 'not', 'matter' ],
            type : 'images',
            language : 'en',
            numfields : 0,
            isCrowdSourced : false,
        },
        training : {
            does : 0, not : 1, matter : 2,
        },
    },
};

const CLASSIFIERS = [
    {
        id : 'my_simple_project_name_201482304320',
        name : 'my simple project name',
        state : STATES.NEW,
    },
    {
        id : 'my_shiny_new_and_huge project_201488194732',
        name : 'my shiny new and huge project',
        state : STATES.NEW,
    },
    {
        id : 'my_failing_project_23480237524',
        name : 'my failing project',
        state : STATES.BAD,
    },
];




const CLASSIFIERS_BY_CLASSIFIER_ID: any = {};
export const CLASSIFIERS_BY_PROJECT_NAME: any = {};
CLASSIFIERS.forEach((classifier) => {
    CLASSIFIERS_BY_CLASSIFIER_ID[classifier.id] = classifier;
    CLASSIFIERS_BY_PROJECT_NAME[classifier.name] = classifier;
});
const PROJECTS_BY_ID: { [id: string]: DbTypes.Project } = {};
Object.keys(PROJECTS).forEach((projname) => {
    const project = PROJECTS[projname].project as DbTypes.Project;
    PROJECTS_BY_ID[project.id] = project;
});



export const request = {

    create : (url: string,  options: visrec.LegacyTrainingRequest | visrec.NewTrainingRequest) => {
        assert.strictEqual(typeof url, 'string');
        assert(options.qs.version);
        assert(options.headers);
        const classifier = CLASSIFIERS_BY_PROJECT_NAME[options.formData.name];
        if (classifier.state === STATES.NEW) {
            return Promise.resolve({
                classifier_id : classifier.id,
                name : classifier.name,
                owner : 'bob',
                status : 'training',
                created : new Date().toISOString(),
            });
        }
        else if (classifier.state === STATES.FULL) {
            return Promise.reject({
                error : {
                    error :  {
                        description : 'Cannot execute learning task. : ' +
                                        'this plan instance can have only 1 custom classifier(s), ' +
                                        'and 1 already exist.',
                        code : 400,
                        error_id : 'input_error',
                    },
                },
                statusCode : 400,
                status : 400,
            });
        }
    },

    delete : (url: string, opts?: coreReq.CoreOptions) => {
        // TODO this is ridiculous... do I really have to fight with TypeScript like this?
        const unk: unknown = opts as unknown;
        const options: visrec.NewVisRecRequest = unk as visrec.NewVisRecRequest;

        assert(options && options.qs.version);
        assert(options && options.headers);
        const prom: unknown = Promise.resolve();
        return prom as requestPromise.RequestPromise;
    },
};






export const store = {
    getImageClassifiers: (projectid: string) => {
        assert(projectid);
        assert.strictEqual(typeof projectid, 'string');
        return Promise.resolve([]);
    },
    getImageTrainingByLabel: (projectid: string, label: string, options: DbTypes.PagingOptions)
        : Promise<DbTypes.ImageTraining[]> =>
    {
        const project = PROJECTS_BY_ID[projectid];
        const trainingCounts = PROJECTS[project.name].training;
        const count = trainingCounts[label];

        const start = options.start;
        const limit = options.limit;
        const end = Math.min(start + limit, count);

        const training: DbTypes.ImageTraining[] = [];
        for (let idx = start; idx < end; idx++) {
            const placeholder: DbTypes.ImageTraining = {
                imageurl : 'http://' + randomstring.generate(10) + '.com/' + label + '-' + idx + '.jpg',
            } as DbTypes.ImageTraining;
            training.push(placeholder);
        }

        return Promise.resolve(training);
    },
    countTrainingByLabel : (project: DbTypes.Project) => {
        return Promise.resolve(PROJECTS[project.name].training);
    },
    getBluemixCredentials : (classid: string, service: TrainingTypes.BluemixServiceType)
        : Promise<TrainingTypes.BluemixCredentials[]> =>
    {
        assert.strictEqual(service, 'visrec');
        if (classid === CLASSIDS.LEGACY) {
            return Promise.resolve([ CREDENTIALS_LEGACY ]);
        }
        else if (classid === CLASSIDS.NEW) {
            return Promise.resolve([ CREDENTIALS_NEW ]);
        }
        else {
            return Promise.resolve([]);
        }
    },
    getBluemixCredentialsById : (credentialsid: string): Promise<TrainingTypes.BluemixCredentials> => {
        switch (credentialsid) {
        case CREDENTIALS_LEGACY.id:
            return Promise.resolve(CREDENTIALS_LEGACY);
        case CREDENTIALS_NEW.id:
            return Promise.resolve(CREDENTIALS_NEW);
        default:
            throw new Error('Unexpected response when retrieving the service credentials');
        }
    },
    getClassTenant : (classid: string): Promise<DbTypes.ClassTenant> => {
        const placeholder: DbTypes.ClassTenant = {
            id : classid,
            supportedProjectTypes : [ 'text', 'images' ],
            maxUsers : 8,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 2,
            imageClassifierExpiry : 3,
            isManaged: false,
        };
        return Promise.resolve(placeholder);
    },
    storeOrUpdateScratchKey : (): Promise<string> => {
        return Promise.resolve('');
    },
    resetExpiredScratchKey : (id: string, projecttype: DbTypes.ProjectTypeLabel) => {
        assert.strictEqual(typeof id, 'string');
        assert.strictEqual(projecttype, 'images');
        return Promise.resolve();
    },
    storeImageClassifier : (
        credentials: TrainingTypes.BluemixCredentials,
        project: DbTypes.Project,
        classifier: TrainingTypes.VisualClassifier,
    ) => {
        return Promise.resolve(
            dbObjects.createVisualClassifier(classifier, credentials, project),
        );
    },
    deleteImageClassifier : (id: string) => {
        assert.strictEqual(typeof id, 'string');
        return Promise.resolve();
    },
};




export const download = {
    run : (locations: downloadAndZip.ImageDownload[]): Promise<string> => {
        return new Promise((resolve) => {
            for (const location of locations) {
                if (location.type === 'download') {
                    assert.strictEqual(typeof location.url, 'string');
                    assert(location.url.startsWith('http'));
                }
            }

            tmp.file((err, path) => {
                resolve(path);
            });
        });
    },
};
