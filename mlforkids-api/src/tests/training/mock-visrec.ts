import * as assert from 'assert';
import * as randomstring from 'randomstring';
import { v1 as uuid } from 'uuid';
import * as tmp from 'tmp';
import { ImageDownload } from '../../lib/training/visualrecognition';

import * as DbTypes from '../../lib/db/db-types';



const USERID = uuid();
const CLASSIDS = {
    LEGACY : uuid(),
    NEW : uuid(),
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
    getClassTenant : (classid: string): Promise<DbTypes.ClassTenant> => {
        const placeholder: DbTypes.ClassTenant = {
            id : classid,
            supportedProjectTypes : [ 'text', 'images' ],
            maxUsers : 8,
            maxProjectsPerUser : 3,
            textClassifierExpiry : 2,
            tenantType: DbTypes.ClassTenantType.UnManaged,
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
};




export const download = {
    run : (locations: ImageDownload[]): Promise<string> => {
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
