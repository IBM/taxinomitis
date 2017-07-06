// external dependencies
import * as uuid from 'uuid/v1';
import * as uuidv4 from 'uuid/v4';
// local dependencies
import * as projects from './projects';
import * as Objects from './db-types';
import * as TrainingObjects from '../training/training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



// -----------------------------------------------------------------------------
//
// PROJECTS
//
// -----------------------------------------------------------------------------

export function createProject(
    userid: string, classid: string, type: string, name: string, fields: string[],
): Objects.ProjectDbRow
{
    log.debug({ userid, type, name }, 'Creating a project object');

    if (projects.typeLabels.indexOf(type) === -1) {
        throw new Error('Invalid project type ' + type);
    }

    if (userid === undefined || userid === '' ||
        name === undefined || name === '' ||
        classid === undefined || classid === '')
    {
        throw new Error('Missing required attributes');
    }

    let fieldsStr = '';

    if (type === 'numbers') {
        if (!fields || fields.length === 0) {
            throw new Error('Missing required attributes');
        }
        if (fields.length > 10) {
            throw new Error('Too many fields specified');
        }
        for (const field of fields) {
            if (!field ||
                field.trim().length === 0 ||
                field.trim().length > 11 ||
                field.indexOf(',') !== -1)
            {
                throw new Error('Invalid field value');
            }
        }
        fieldsStr = fields.join(',');
    }
    else if (fields && fields.length > 0) {
        throw new Error('Fields not supported for non-numbers projects');
    }

    return {
        id : uuid(),
        userid,
        classid,
        typeid : projects.typesByLabel[type].id,
        name,
        labels : '',
        fields : fieldsStr,
    };
}

export function getProjectFromDbRow(row: Objects.ProjectDbRow): Objects.Project {
    return {
        id : row.id,
        userid : row.userid,
        classid : row.classid,
        type : projects.typesById[row.typeid].label,
        name : row.name,
        labels : getLabelsFromList(row.labels),
        fields : row.fields ? getLabelsFromList(row.fields) : [],
    };
}

export function getLabelsFromList(liststr: string): string[] {
    return liststr.split(',')
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0);
}

// -----------------------------------------------------------------------------
//
// TRAINING DATA
//
// -----------------------------------------------------------------------------

export function createTextTraining(projectid: string, data: string, label: string): Objects.TextTraining {
    if (projectid === undefined || projectid === '' ||
        data === undefined || data === '')
    {
        throw new Error('Missing required attributes');
    }

    if (data.length > 1024) {
        throw new Error('Text exceeds maximum allowed length (1024 characters)');
    }

    const object: any = {
        id : uuid(),
        projectid,
        textdata : data,
    };

    if (label) {
        object.label = label;
    }

    return object;
}

export function getTextTrainingFromDbRow(row: Objects.TextTrainingDbRow): Objects.TextTraining {
    const obj: any = {
        id : row.id,
        textdata : row.textdata,
    };
    if (row.label) {
        obj.label = row.label;
    }
    if (row.projectid) {
        obj.projectid = row.projectid;
    }
    return obj;
}



export function createNumberTraining(projectid: string, data: number[], label: string): Objects.NumberTraining {
    if (projectid === undefined || projectid === '' ||
        data === undefined || data.length === 0)
    {
        throw new Error('Missing required attributes');
    }

    if (data.length > 10) {
        throw new Error('Number of data items exceeded maximum');
    }

    for (const num of data) {
        if (isNaN(num)) {
            throw new Error('Data contains non-numeric items');
        }
    }

    const object: any = {
        id : uuid(),
        projectid,
        numberdata : data,
    };

    if (label) {
        object.label = label;
    }

    return object;
}

export function getNumberTrainingFromDbRow(row: Objects.NumberTrainingDbRow): Objects.NumberTraining {
    const obj: any = {
        id : row.id,
        numberdata : row.numberdata.split(',').map(parseFloat),
    };
    if (row.label) {
        obj.label = row.label;
    }
    if (row.projectid) {
        obj.projectid = row.projectid;
    }
    return obj;
}


// -----------------------------------------------------------------------------
//
// BLUEMIX CREDENTIALS
//
// -----------------------------------------------------------------------------

export function getCredentialsFromDbRow(
    row: TrainingObjects.BluemixCredentialsDbRow,
): TrainingObjects.BluemixCredentials
{
    return {
        id : row.id,
        servicetype : row.servicetype as TrainingObjects.BluemixServiceType,
        url : row.url,
        username : row.username,
        password : row.password,
    };
}


// -----------------------------------------------------------------------------
//
// CLASSIFIERS
//
// -----------------------------------------------------------------------------

export function createConversationWorkspace(
    classifierInfo: TrainingObjects.ConversationWorkspace,
    credentialsInfo: TrainingObjects.BluemixCredentials,
    userid: string, classid: string, projectid: string,
): TrainingObjects.ClassifierDbRow
{
    return {
        id : uuid(),
        credentialsid : credentialsInfo.id,
        userid, projectid, classid,
        servicetype : 'conv',
        classifierid : classifierInfo.workspace_id,
        url : classifierInfo.url,
        name : classifierInfo.name,
        language : classifierInfo.language,
        created : classifierInfo.created,
    };
}

export function getWorkspaceFromDbRow(row: TrainingObjects.ClassifierDbRow): TrainingObjects.ConversationWorkspace {
    return {
        workspace_id : row.classifierid,
        url : row.url,
        name : row.name,
        language : row.language,
        created : row.created,
    };
}




export function createNumbersClassifier(
    userid: string, classid: string, projectid: string,
    status: TrainingObjects.NumbersStatus,
): TrainingObjects.NumbersClassifierDbRow
{
    return {
        userid, projectid, classid,
        created : new Date(),
        status : status === 'Available' ? 1 : 0,
    };
}

export function getNumbersClassifierFromDbRow(
    row: TrainingObjects.NumbersClassifierDbRow,
): TrainingObjects.NumbersClassifier
{
    return {
        created : row.created,
        status : row.status === 1 ? 'Available' : 'Failed',
        classifierid : row.projectid,
    };
}



// -----------------------------------------------------------------------------
//
// SCRATCH KEYS
//
// -----------------------------------------------------------------------------

export function createScratchKey(
    credentials: TrainingObjects.BluemixCredentials,
    name: string, type: Objects.ProjectTypeLabel,
    projectid: string,
    classifierid: string,
): Objects.ScratchKey
{
    return {
        id : uuid() + uuidv4(),
        name, type, projectid,
        credentials, classifierid,
    };
}

export function createUntrainedScratchKey(
    name: string, type: Objects.ProjectTypeLabel, projectid: string,
): Objects.ScratchKey
{
    return {
        id : uuid() + uuidv4(),
        name, type, projectid,
    };
}

export function getScratchKeyFromDbRow(row: Objects.ScratchKeyDbRow): Objects.ScratchKey {
    let servicetype: TrainingObjects.BluemixServiceType;
    if (row.projecttype === 'text') {
        servicetype = 'conv';
    }
    else if (row.projecttype === 'numbers') {
        servicetype = 'num';
    }
    if (row.classifierid) {
        return {
            id : row.id,
            projectid : row.projectid,
            name : row.projectname,
            type : row.projecttype,
            credentials : {
                id : '',
                servicetype,
                url : row.serviceurl,
                username : row.serviceusername,
                password : row.servicepassword,
            },
            classifierid : row.classifierid,
        };
    }
    else {
        return {
            id : row.id,
            projectid : row.projectid,
            name : row.projectname,
            type : row.projecttype,
        };
    }
}



// -----------------------------------------------------------------------------
//
// TENANT INFO
//
// -----------------------------------------------------------------------------

export function getClassFromDbRow(row: Objects.ClassDbRow): Objects.ClassTenant {
    return {
        id : row.id,
        supportedProjectTypes : row.projecttypes.split(',') as Objects.ProjectTypeLabel[],
        maxUsers : row.maxusers,
        maxProjectsPerUser : row.maxprojectsperuser,
    };
}
