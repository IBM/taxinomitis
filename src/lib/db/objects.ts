// external dependencies
import * as uuid from 'uuid/v1';
import * as uuidv4 from 'uuid/v4';
// local dependencies
import * as projects from './projects';
import * as Objects from './db-types';
import * as TrainingObjects from '../training/training-types';



// -----------------------------------------------------------------------------
//
// PROJECTS
//
// -----------------------------------------------------------------------------

export function createProject(
    userid: string, classid: string, type: string, name: string, fields: Objects.NumbersProjectFieldSummary[],
): Objects.ProjectDbRow
{
    if (projects.typeLabels.indexOf(type) === -1) {
        throw new Error('Invalid project type ' + type);
    }

    if (userid === undefined || userid === '' ||
        name === undefined || name === '' ||
        classid === undefined || classid === '')
    {
        throw new Error('Missing required attributes');
    }

    const projectid = uuid();

    let fieldsObjs: Objects.NumbersProjectFieldDbRow[] = [];
    if (type === 'numbers') {
        if (!fields || fields.length < MIN_FIELDS) {
            throw new Error('Fields required for numbers projects');
        }
        if (fields.length > MAX_FIELDS) {
            throw new Error('Too many fields specified');
        }
        fieldsObjs = fields.map((field) => createNumberProjectField(userid, classid, projectid, field));
    }
    else if (fields && fields.length > 0) {
        throw new Error('Fields not supported for non-numbers projects');
    }

    return {
        id : projectid,
        userid,
        classid,
        typeid : projects.typesByLabel[type].id,
        name,
        labels : '',
        fields : fieldsObjs,
        numfields : fieldsObjs.length,
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
        numfields : row.numfields ? row.numfields : 0,
        fields : row.fields ? row.fields.map(getNumbersProjectFieldSummaryFromDbRow) : [],
    };
}

const MIN_FIELDS = 1;
const MAX_FIELDS = 10;
const MAX_FIELD_LENGTH = 12;

const MULTICHOICES_MIN_NUM_CHOICES = 2;
const MULTICHOICES_MAX_NUM_CHOICES = 4;
const MULTICHOICES_CHOICE_LABEL_MAXLENGTH = 8;

const IS_VALID_CHOICE = /^[^0-9\-.,][^,]*$/;


export function createNumberProjectField(
    userid: string, classid: string, projectid: string,
    fieldinfo: Objects.NumbersProjectFieldSummary,
): Objects.NumbersProjectFieldDbRow
{
    if (userid === undefined || userid === '' ||
        classid === undefined || classid === '' ||
        projectid === undefined || projectid === '' ||
        fieldinfo === undefined ||
        fieldinfo.type === undefined ||
        fieldinfo.name === undefined || fieldinfo.name === '')
    {
        throw new Error('Missing required attributes');
    }
    if (fieldinfo.name.length > MAX_FIELD_LENGTH) {
        throw new Error('Invalid field name');
    }

    if (projects.fieldTypeLabels.indexOf(fieldinfo.type) === -1) {
        throw new Error('Invalid field type ' + fieldinfo.type);
    }


    let choicesStr = '';
    if (fieldinfo.type === 'multichoice') {
        if (!fieldinfo.choices || fieldinfo.choices.length < MULTICHOICES_MIN_NUM_CHOICES) {
            throw new Error('Not enough choices provided');
        }
        if (fieldinfo.choices.length > MULTICHOICES_MAX_NUM_CHOICES) {
            throw new Error('Too many choices specified');
        }
        for (const choice of fieldinfo.choices) {
            if (!choice ||
                choice.trim().length === 0 ||
                choice.trim().length > MULTICHOICES_CHOICE_LABEL_MAXLENGTH ||
                IS_VALID_CHOICE.test(choice) === false)
            {
                throw new Error('Invalid choice value');
            }
        }
        choicesStr = fieldinfo.choices.map((choice) => choice.trim() ).join(',');
    }

    return {
        id : uuid(),
        userid, classid, projectid,
        name : fieldinfo.name,
        fieldtype : projects.fieldTypesByLabel[fieldinfo.type].id,
        choices : choicesStr,
    };
}


export function getNumbersProjectFieldFromDbRow(row: Objects.NumbersProjectFieldDbRow): Objects.NumbersProjectField {
    return {
        id : row.id,
        userid : row.userid,
        classid : row.classid,
        projectid : row.projectid,
        name : row.name,
        type : projects.fieldTypesById[row.fieldtype].label,
        choices : row.choices ? getLabelsFromList(row.choices) : [],
    };
}
export function getNumbersProjectFieldSummaryFromDbRow(
    row: Objects.NumbersProjectFieldDbRow,
): Objects.NumbersProjectFieldSummary
{
    return {
        name : row.name,
        type : projects.fieldTypesById[row.fieldtype].label,
        choices : row.choices ? getLabelsFromList(row.choices) : [],
    };
}


export function getLabelsFromList(liststr: string): string[] {
    return liststr.split(',')
                  .map((item) => item.trim())
                  .filter((item) => item.length > 0);
}


export function getLabelListFromArray(list: string[]): string {
    const str = list.join(',');
    if (str.length >= 490) {
        throw new Error('No room for the label');
    }
    return str;
}


// -----------------------------------------------------------------------------
//
// TRAINING DATA
//
// -----------------------------------------------------------------------------

// these are the rules enforced by Conversation, but we might as well apply them globally
const INVALID_LABEL_NAME_CHARS = /[^\w.]/g;
const INVALID_TEXT_CHARS = /[\t\n]/g;
const MAX_CONTENTS_LENGTH = 1024;

export function createLabel(proposedlabel: string): string {
    return proposedlabel.replace(INVALID_LABEL_NAME_CHARS, '_').substr(0, Objects.MAX_LABEL_LENGTH);
}


export function createTextTraining(projectid: string, data: string, label: string): Objects.TextTraining {
    if (projectid === undefined || projectid === '' ||
        data === undefined || data === '')
    {
        throw new Error('Missing required attributes');
    }

    if (data.length > MAX_CONTENTS_LENGTH) {
        throw new Error('Text exceeds maximum allowed length (1024 characters)');
    }

    const object: any = {
        id : uuid(),
        projectid,
        textdata : data.replace(INVALID_TEXT_CHARS, ' '),
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



export function createImageTraining(projectid: string, imageurl: string, label: string): Objects.ImageTraining {
    if (projectid === undefined || projectid === '' ||
        imageurl === undefined || imageurl === '')
    {
        throw new Error('Missing required attributes');
    }

    if (imageurl.length > MAX_CONTENTS_LENGTH) {
        throw new Error('Image URL exceeds maximum allowed length (1024 characters)');
    }

    const object: any = {
        id : uuid(),
        projectid,
        imageurl,
    };

    if (label) {
        object.label = label;
    }

    return object;
}

export function getImageTrainingFromDbRow(row: Objects.ImageTrainingDbRow): Objects.ImageTraining {
    const obj: any = {
        id : row.id,
        imageurl : row.imageurl,
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
        classid : row.classid,
    };
}

export function createBluemixCredentials(
    servicetype: string, classid: string,
    apikey: string,
    username: string, password: string,
): TrainingObjects.BluemixCredentials
{
    if (servicetype === undefined)
    {
        throw new Error('Missing required attributes');
    }

    if (servicetype === 'visrec') {
        if (apikey) {
            if (apikey.length === 40) {
                return {
                    id : uuid(),
                    username : apikey.substr(0, 20),
                    password : apikey.substr(20),
                    classid,
                    servicetype : 'visrec',
                    url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
                };
            }
            else {
                throw new Error('Invalid API key');
            }
        }
        else {
            throw new Error('Missing required attributes');
        }
    }
    else if (servicetype === 'conv') {
        if (username && password) {
            if (username.length === 36 && password.length === 12) {
                return {
                    id : uuid(),
                    username, password, classid,
                    servicetype : 'conv',
                    url : 'https://gateway.watsonplatform.net/conversation/api',
                };
            }
            else {
                throw new Error('Invalid credentials');
            }
        }
        else {
            throw new Error('Missing required attributes');
        }
    }
    else {
        throw new Error('Invalid service type');
    }
}



// -----------------------------------------------------------------------------
//
// CLASSIFIERS
//
// -----------------------------------------------------------------------------

export function createConversationWorkspace(
    classifierInfo: TrainingObjects.ConversationWorkspace,
    credentialsInfo: TrainingObjects.BluemixCredentials,
    project: Objects.Project,
): TrainingObjects.ClassifierDbRow
{
    return {
        id : classifierInfo.id,
        credentialsid : credentialsInfo.id,
        userid : project.userid,
        projectid : project.id,
        classid : project.classid,
        servicetype : 'conv',
        classifierid : classifierInfo.workspace_id,
        url : classifierInfo.url,
        name : classifierInfo.name,
        language : classifierInfo.language,
        created : classifierInfo.created,
        expiry : classifierInfo.expiry,
    };
}

export function getWorkspaceFromDbRow(row: TrainingObjects.ClassifierDbRow): TrainingObjects.ConversationWorkspace {
    return {
        id : row.id,
        workspace_id : row.classifierid,
        credentialsid : row.credentialsid,
        url : row.url,
        name : row.name,
        language : row.language,
        created : row.created,
        expiry : row.expiry,
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


export function createVisualClassifier(
    classifierInfo: TrainingObjects.VisualClassifier,
    credentialsInfo: TrainingObjects.BluemixCredentials,
    project: Objects.Project,
): TrainingObjects.ClassifierDbRow
{
    return {
        id : classifierInfo.id,
        credentialsid : credentialsInfo.id,
        userid : project.userid,
        projectid : project.id,
        classid : project.classid,
        servicetype : 'visrec',
        classifierid : classifierInfo.classifierid,
        url : classifierInfo.url,
        name : classifierInfo.name,
        created : classifierInfo.created,
        expiry : classifierInfo.expiry,
        language : null,
    };
}


export function getVisualClassifierFromDbRow(row: TrainingObjects.ClassifierDbRow): TrainingObjects.VisualClassifier {
    return {
        id : row.id,
        classifierid : row.classifierid,
        credentialsid : row.credentialsid,
        url : row.url,
        name : row.name,
        created : row.created,
        expiry : row.expiry,
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
    switch (row.projecttype) {
    case 'text':
        servicetype = 'conv';
        break;
    case 'images':
        servicetype = 'visrec';
        break;
    case 'numbers':
        servicetype = 'num';
        break;
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
                classid : row.classid,
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
        isManaged : row.ismanaged === 1,
        maxUsers : row.maxusers,
        maxProjectsPerUser : row.maxprojectsperuser,
        textClassifierExpiry : row.textclassifiersexpiry,
        imageClassifierExpiry : row.imageclassifiersexpiry,
    };
}
