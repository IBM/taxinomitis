// external dependencies
import { v1 as uuid } from 'uuid';
import { v4 as uuidv4 } from 'uuid';
// local dependencies
import * as projects from './projects';
import * as sitealerts from './site-alerts';
import * as Objects from './db-types';
import * as TrainingObjects from '../training/training-types';
import * as ObjectStoreTypes from '../objectstore/types';



// -----------------------------------------------------------------------------
//
// PROJECTS
//
// -----------------------------------------------------------------------------

export function getProjectTypeId(type: string) {
    if (projects.typeLabels.includes(type)) {
        return projects.typesByLabel[type].id;
    }
    throw new Error('Invalid project type ' + type);
}

export function createProject(
    userid: string, classid: string,
    type: string,
    name: string,
    textlanguage: Objects.TextProjectLanguage,
    fields: Objects.NumbersProjectFieldSummary[],
    crowdsource: boolean,
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
        if (containsDuplicateNames(fields)) {
            throw new Error('Fields all need different names');
        }
        fieldsObjs = fields.map((field) => createNumberProjectField(userid, classid, projectid, field));
    }
    else if (fields && fields.length > 0) {
        throw new Error('Fields not supported for non-numbers projects');
    }

    let language = '';
    if (type === 'text') {
        switch (textlanguage) {
        case 'en':
        case 'ar':
        case 'zh-tw':
        case 'zh-cn':
        case 'cs':
        case 'nl':
        case 'fr':
        case 'de':
        case 'it':
        case 'ja':
        case 'ko':
        case 'pt-br':
        case 'es':
        case 'xx':
            language = textlanguage;
            break;
        default:
            throw new Error('Language not supported');
        }
    }

    return {
        id : projectid,
        userid,
        classid,
        typeid : getProjectTypeId(type),
        name,
        labels : '',
        language,
        fields : fieldsObjs,
        numfields : fieldsObjs.length,
        iscrowdsourced : crowdsource,
    };
}

function containsDuplicateNames(fields: Objects.NumbersProjectFieldSummary[]): boolean {
    const names: { [key: string]: boolean } = {};
    return fields.some((field) => {
        if (names[field.name]) {
            return true;
        }
        names[field.name] = true;
        return false;
    });
}

export function getProjectFromDbRow(row: Objects.ProjectDbRow): Objects.Project {
    const type = projects.typesById[row.typeid].label;

    let language: Objects.TextProjectLanguage | '';
    if (type === 'text') {
        if (row.language) {
            language = row.language as Objects.TextProjectLanguage;
        }
        else {
            language = 'en';
        }
    }
    else {
        language = '';
    }

    return {
        id : row.id,
        userid : row.userid,
        classid : row.classid,
        type,
        name : row.name,
        labels : getLabelsFromList(row.labels),
        language,
        numfields : row.numfields ? row.numfields : 0,
        fields : row.fields ? row.fields.map(getNumbersProjectFieldSummaryFromDbRow) : [],
        isCrowdSourced : row.iscrowdsourced,
    };
}


const MIN_FIELDS = 1;
const MAX_FIELDS = 10;
const MAX_FIELD_LENGTH = 12;

const MULTICHOICES_MIN_NUM_CHOICES = 2;
const MULTICHOICES_MAX_NUM_CHOICES = 9;
const MULTICHOICES_CHOICE_LABEL_MAXLENGTH = 13;

const IS_VALID_CHOICE = /^[^0-9\-.,][^,]*$/;

/**
 * Limit project names to 1-36 ASCII characters - everything
 * between a space (ASCII code 32) to a black square (ASCII code 254)
 */
export const VALID_PROJECT_NAME = /^[ -■]{1,36}$/;


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

    data = data.trim();

    if (data.length === 0) {
        throw new Error('Empty text is not allowed');
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



function isEmptyString(obj: any): boolean {
    return typeof obj === 'string' && obj.trim().length === 0;
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
        if (isNaN(num) || isEmptyString(num)) {
            throw new Error('Data contains non-numeric items');
        }
        if (num < -3.4028235e+38) {
            throw new Error('Number is too small');
        }
        if (num > 3.4028235e+38) {
            throw new Error('Number is too big');
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



export function createImageTraining(
    projectid: string,
    imageurl: string,
    label: string,
    stored: boolean,
    imageid?: string,
): Objects.ImageTrainingDbRow
{
    if (projectid === undefined || projectid === '' ||
        imageurl === undefined || imageurl === '')
    {
        throw new Error('Missing required attributes');
    }

    if (imageurl.length > MAX_CONTENTS_LENGTH) {
        throw new Error('Image URL exceeds maximum allowed length (' +
                        MAX_CONTENTS_LENGTH +
                        ' characters)');
    }

    const object: any = {
        id : imageid ? imageid : uuid(),
        projectid,
        imageurl,
    };

    if (label) {
        object.label = label;
    }

    object.isstored = stored ? 1 : 0;

    return object;
}


const IMAGEURL_USERID_REGEX = /\/api\/classes\/[0-9a-f-]{36}\/students\/(auth0\|[0-9a-f]*)\/projects\/[0-9a-f-]{36}\/images\/[0-9a-f-]{36}/;

// For references to images in the imagestore, it's not safe to assume
//  that the userid associated with a project is the user who stored
//  an image so we extract that from the URL
function getUserIdFromImageUrl(imageurl: string): string | undefined {
    const check = IMAGEURL_USERID_REGEX.exec(imageurl);
    if (check) {
        return check[1];
    }
}

export function getImageTrainingFromDbRow(row: Objects.ImageTrainingDbRow): Objects.ImageTraining {
    const obj: any = {
        id : row.id,
        imageurl : row.imageurl,
        isstored : row.isstored ? true : false,
    };
    if (obj.isstored) {
        obj.userid = getUserIdFromImageUrl(obj.imageurl);
    }
    if (row.label) {
        obj.label = row.label;
    }
    if (row.projectid) {
        obj.projectid = row.projectid;
    }
    return obj;
}


function isNotValidString(str: string): boolean {
    return str === undefined ||
           str === '' ||
           typeof str !== 'string' ||
           str.trim().length === 0;
}

export function createSoundTraining(projectid: string, audiourl: string,
                                    label: string, audiodataid: string): Objects.SoundTraining
{
    if (isNotValidString(projectid) || isNotValidString(audiourl) ||
        isNotValidString(label) || isNotValidString(audiodataid))
    {
        throw new Error('Missing required attributes');
    }

    return {
        id : audiodataid,
        projectid,
        audiourl,
        label,
    };
}

export function getSoundTrainingFromDbRow(row: Objects.SoundTrainingDbRow): Objects.SoundTraining {
    const obj: any = {
        id : row.id,
        label : row.label,
        audiourl : row.audiourl,
    };
    if (row.projectid) {
        obj.projectid = row.projectid;
    }
    return obj;
}

export function createSoundTrainingDbRow(obj: Objects.SoundTraining): Objects.SoundTrainingDbRow {
    return {
        id : obj.id,
        label : obj.label,
        audiourl : obj.audiourl,
        projectid : obj.projectid,
    };
}



// -----------------------------------------------------------------------------
//
// BLUEMIX CREDENTIALS
//
// -----------------------------------------------------------------------------

const CLASS_MANAGEDPOOL_PLACEHOLDER = 'managedpooluse';

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
        credstype : row.credstypeid ? projects.credsTypesById[row.credstypeid].label : 'unknown',
    };
}

export function getCredentialsAsDbRow(obj: TrainingObjects.BluemixCredentials,
): TrainingObjects.BluemixCredentialsDbRow
{
    const creds: TrainingObjects.BluemixCredentialsDbRow = {
        id : obj.id,
        servicetype : obj.servicetype,
        url : obj.url,
        username : obj.username,
        password : obj.password,
        classid : obj.classid,
        credstypeid : obj.credstype ?
                        projects.credsTypesByLabel[obj.credstype].id :
                        projects.credsTypesByLabel.unknown.id,
    };
    if (obj.notes) {
        creds.notes = obj.notes;
    }
    return creds;
}

export function getCredentialsPoolFromDbRow(
    row: TrainingObjects.BluemixCredentialsPoolDbRow,
): TrainingObjects.BluemixCredentialsPool
{
    return {
        id : row.id,
        servicetype : row.servicetype as TrainingObjects.BluemixServiceType,
        url : row.url,
        username : row.username,
        password : row.password,
        classid : CLASS_MANAGEDPOOL_PLACEHOLDER,
        credstype : row.credstypeid ? projects.credsTypesById[row.credstypeid].label : 'unknown',
        lastfail : row.lastfail
    };
}

export function getCredentialsPoolAsDbRow(obj: TrainingObjects.BluemixCredentialsPool,
): TrainingObjects.BluemixCredentialsPoolDbRow
{
    return {
        id : obj.id,
        servicetype : obj.servicetype,
        url : obj.url,
        username : obj.username,
        password : obj.password,
        classid : obj.classid,
        credstypeid : obj.credstype ?
                        projects.credsTypesByLabel[obj.credstype].id :
                        projects.credsTypesByLabel.unknown.id,
        notes : obj.notes,
        lastfail : obj.lastfail,
    };
}

function getCredentialsType(
    servicetype: TrainingObjects.BluemixServiceType,
    credstype?: string,
): TrainingObjects.BluemixCredentialsTypeLabel {

    if (!credstype) {
        throw new Error('Missing required attributes');
    }

    if (credstype === 'unknown') {
        return 'unknown';
    }

    switch (servicetype) {
    case 'conv':
        if (credstype === 'conv_lite' || credstype === 'conv_standard' ||
            credstype === 'conv_plus' || credstype === 'conv_plustrial') {
            return credstype;
        }
        throw new Error('Invalid credentials type');
    default:
        throw new Error('Invalid service type');
    }
}

export function createBluemixCredentials(
    servicetype: string, classid: string,
    apikey?: string,
    username?: string, password?: string,
    credstype?: string,
): TrainingObjects.BluemixCredentials
{
    if (servicetype === undefined)
    {
        throw new Error('Missing required attributes');
    }

    if (servicetype === 'conv') {
        if (username && password) {
            if (username.length === 36 && password.length === 12) {
                return {
                    id : uuid(),
                    username, password, classid,
                    servicetype : 'conv',
                    url : 'https://gateway.watsonplatform.net/conversation/api',
                    credstype : getCredentialsType('conv', credstype),
                };
            }
            else {
                throw new Error('Invalid credentials');
            }
        }
        else if (apikey) {
            if (apikey.length === 44) {
                return {
                    id : uuid(),
                    username : apikey.substr(0, 22),
                    password : apikey.substr(22),
                    classid,
                    servicetype : 'conv',
                    url : 'https://gateway-wdc.watsonplatform.net/assistant/api',
                    credstype : getCredentialsType('conv', credstype),
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
    else {
        throw new Error('Invalid service type');
    }
}

export function createBluemixCredentialsPool(
    servicetype: string,
    apikey?: string,
    username?: string, password?: string,
    credstype?: string,
): TrainingObjects.BluemixCredentialsPool
{
    const creds = createBluemixCredentials(servicetype, CLASS_MANAGEDPOOL_PLACEHOLDER,
        apikey, username, password, credstype);

    return { ...creds, lastfail : new Date() };
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
    let language: Objects.TextProjectLanguage;
    if (row.language) {
        language = row.language as Objects.TextProjectLanguage;
    }
    else {
        language = 'en';
    }

    return {
        id : row.id,
        workspace_id : row.classifierid,
        credentialsid : row.credentialsid,
        url : row.url,
        name : row.name,
        language,
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
    timestamp: Date,
): Objects.ScratchKey
{
    return {
        id : uuid() + uuidv4(),
        name, type, projectid,
        credentials, classifierid,
        updated : timestamp,
    };
}

export function createUntrainedScratchKey(
    name: string, type: Objects.ProjectTypeLabel, projectid: string,
): Objects.ScratchKey
{
    return {
        id : uuid() + uuidv4(),
        name, type, projectid,
        updated : new Date(),
    };
}

export function getScratchKeyFromDbRow(row: Objects.ScratchKeyDbRow): Objects.ScratchKey {
    let servicetype: TrainingObjects.BluemixServiceType;
    switch (row.projecttype) {
    case 'text':
        servicetype = 'conv';
        break;
    case 'imgtfjs':
    case 'images':
        servicetype = 'imgtfjs';
        break;
    case 'numbers':
        servicetype = 'num';
        break;
    case 'sounds':
        servicetype = 'sounds';
        break;
    default:
        throw new Error('Unrecognised service type');
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
                credstype : 'unknown',
            },
            classifierid : row.classifierid,
            updated : row.updated,
        };
    }
    else {
        return {
            id : row.id,
            projectid : row.projectid,
            name : row.projectname,
            type : row.projecttype,
            updated : row.updated,
        };
    }
}


// -----------------------------------------------------------------------------
//
// KNOWN SYSTEM ERRORS
//
// -----------------------------------------------------------------------------

export function getKnownErrorFromDbRow(row: TrainingObjects.KnownError): TrainingObjects.KnownError {
    return {
        id : row.id,
        type : row.type,
        servicetype : row.servicetype,
        objid : row.objid,
    };
}

export function createKnownError(
    type: TrainingObjects.KnownErrorCondition,
    servicetype: TrainingObjects.BluemixServiceType,
    objid: string): TrainingObjects.KnownError
{
    if (servicetype !== 'conv') {
        throw new Error('Unexpected service type');
    }
    if (type !== TrainingObjects.KnownErrorCondition.BadBluemixCredentials &&
        type !== TrainingObjects.KnownErrorCondition.UnmanagedBluemixClassifier)
    {
        throw new Error('Unexpected error type');
    }
    if (!objid || objid.trim().length === 0 || objid.length > 50) {
        throw new Error('Bad object id');
    }

    return {
        id : uuid(),
        type, servicetype, objid,
    };
}



// -----------------------------------------------------------------------------
//
// PENDING JOBS
//
// -----------------------------------------------------------------------------

export function createDeleteObjectStoreJob(spec: ObjectStoreTypes.ObjectSpec): Objects.PendingJob
{
    if (!spec.classid) {
        throw new Error('Missing required class id');
    }
    if (!spec.userid) {
        throw new Error('Missing required user id');
    }
    if (!spec.projectid) {
        throw new Error('Missing required project id');
    }
    if (!spec.objectid) {
        throw new Error('Missing required object id');
    }

    return {
        id : uuid(),
        jobtype : Objects.PendingJobType.DeleteOneObjectFromObjectStorage,
        jobdata : spec,
        attempts : 0,
    };
}

export function createDeleteProjectObjectsJob(spec: ObjectStoreTypes.ProjectSpec): Objects.PendingJob
{
    if (!spec.classid) {
        throw new Error('Missing required class id');
    }
    if (!spec.userid) {
        throw new Error('Missing required user id');
    }
    if (!spec.projectid) {
        throw new Error('Missing required project id');
    }

    return {
        id : uuid(),
        jobtype : Objects.PendingJobType.DeleteProjectObjectsFromObjectStorage,
        jobdata : spec,
        attempts : 0,
    };
}

export function createDeleteUserObjectsJob(spec: ObjectStoreTypes.UserSpec): Objects.PendingJob
{
    if (!spec.classid) {
        throw new Error('Missing required class id');
    }
    if (!spec.userid) {
        throw new Error('Missing required user id');
    }

    return {
        id : uuid(),
        jobtype : Objects.PendingJobType.DeleteUserObjectsFromObjectStorage,
        jobdata : spec,
        attempts : 0,
    };
}

export function createDeleteClassObjectsJob(spec: ObjectStoreTypes.ClassSpec): Objects.PendingJob
{
    if (!spec.classid) {
        throw new Error('Missing required class id');
    }

    return {
        id : uuid(),
        jobtype : Objects.PendingJobType.DeleteClassObjectsFromObjectStorage,
        jobdata : spec,
        attempts : 0,
    };
}


export function getPendingJobFromDbRow(row: Objects.PendingJobDbRow): Objects.PendingJob
{
    if (row.lastattempt) {
        return {
            id : row.id,
            jobtype : row.jobtype,
            jobdata : JSON.parse(row.jobdata),
            attempts : row.attempts,
            lastattempt : row.lastattempt,
        };
    }
    else {
        return {
            id : row.id,
            jobtype : row.jobtype,
            jobdata : JSON.parse(row.jobdata),
            attempts : row.attempts,
        };
    }
}




// -----------------------------------------------------------------------------
//
// TENANT INFO
//
// -----------------------------------------------------------------------------

const VALID_CLASSID = /^[a-z]{4,36}$/;

export function createClassTenant(
    classid: string, projectTypes?: Objects.ProjectTypeLabel[],
): Objects.ClassDbRow
{
    if (!classid) {
        throw new Error('Missing required class id');
    }
    if (VALID_CLASSID.test(classid) === false) {
        throw new Error('Not a valid class id');
    }

    return getClassDbRow(getDefaultClassTenant(classid, projectTypes));
}


export function getClassFromDbRow(row: Objects.ClassDbRow): Objects.ClassTenant {
    return {
        id : row.id,
        supportedProjectTypes : row.projecttypes.split(',') as Objects.ProjectTypeLabel[],
        tenantType : row.ismanaged,
        maxUsers : row.maxusers,
        maxProjectsPerUser : row.maxprojectsperuser,
        textClassifierExpiry : row.textclassifiersexpiry,
    };
}

export function getClassDbRow(tenant: Objects.ClassTenant): Objects.ClassDbRow {
    return {
        id : tenant.id,
        projecttypes : tenant.supportedProjectTypes.join(','),
        maxusers : tenant.maxUsers,
        maxprojectsperuser : tenant.maxProjectsPerUser,
        textclassifiersexpiry : tenant.textClassifierExpiry,
        ismanaged : tenant.tenantType,
    };
}

export function getDefaultClassTenant(classid: string, projectTypes?: Objects.ProjectTypeLabel[]): Objects.ClassTenant {
    return {
        id : classid,
        supportedProjectTypes : projectTypes ? projectTypes : [ 'text', 'imgtfjs', 'numbers', 'sounds' ],
        tenantType : Objects.ClassTenantType.UnManaged,
        maxUsers : 30,
        maxProjectsPerUser : 3,
        textClassifierExpiry : 24,
    };
}



export function setClassTenantExpiries(
    tenant: Objects.ClassTenant,
    textexpiry: number,
): Objects.ClassTenant
{
    if (!tenant) {
        throw new Error('Missing tenant info to update');
    }
    if (!textexpiry) {
        throw new Error('Missing required expiry value');
    }
    if (!Number.isInteger(textexpiry)) {
        throw new Error('Expiry values should be an integer number of hours');
    }
    if (textexpiry < 1) {
        throw new Error('Expiry values should be a positive number of hours');
    }
    if (textexpiry > 255) {
        throw new Error('Expiry values should not be greater than 255 hours');
    }

    tenant.textClassifierExpiry = textexpiry;
    return tenant;
}




// -----------------------------------------------------------------------------
//
// TEMPORARY SESSION USERS
//
// -----------------------------------------------------------------------------


function getSessionExpiryTime(lifespan: number): Date {
    const expiry = new Date(new Date().getTime() + lifespan);
    expiry.setMilliseconds(0);
    return expiry;
}


/**
 * @param lifespan - how long the user should exist for, in milliseconds
 */
export function createTemporaryUser(lifespan: number): Objects.TemporaryUserDbRow {
    return {
        id : uuidv4(),
        token : uuidv4(),
        sessionexpiry : getSessionExpiryTime(lifespan),
    };
}

export function getTemporaryUserFromDbRow(row: Objects.TemporaryUserDbRow): Objects.TemporaryUser {
    return {
        id : row.id,
        token : row.token,
        sessionExpiry : row.sessionexpiry,
    };
}



// -----------------------------------------------------------------------------
//
// SITE ALERT MESSAGES
//
// -----------------------------------------------------------------------------

const MAX_SITE_ALERT_STRING_LENGTH = 280;

export function createSiteAlert(
    message: string, url: string,
    audience: string, severity: string,
    expiry: number,
): Objects.SiteAlertDbRow
{
    if (sitealerts.audienceLabels.indexOf(audience) === -1) {
        throw new Error('Invalid audience type ' + audience);
    }
    if (sitealerts.severityLabels.indexOf(severity) === -1) {
        throw new Error('Invalid severity type ' + severity);
    }

    if (message === undefined || typeof message !== 'string' || message === '' ||
        typeof url !== 'string')
    {
        throw new Error('Missing required attributes');
    }
    if (!expiry || isNaN(expiry) || expiry <= 0)
    {
        throw new Error('Invalid expiry');
    }
    if (message.length > MAX_SITE_ALERT_STRING_LENGTH) {
        throw new Error('Invalid message');
    }
    if (url.length > MAX_SITE_ALERT_STRING_LENGTH) {
        throw new Error('Invalid URL');
    }

    const now = new Date();

    return {
        timestamp : now,
        audienceid : sitealerts.audiencesByLabel[audience].id,
        severityid : sitealerts.severitiesByLabel[severity].id,
        message, url,
        expiry : new Date(now.getTime() + expiry),
    };
}

export function getSiteAlertFromDbRow(row: Objects.SiteAlertDbRow): Objects.SiteAlert {
    const severity = sitealerts.severitiesById[row.severityid].label;
    const audience = sitealerts.audiencesById[row.audienceid].label;
    return {
        timestamp : row.timestamp,
        severity, audience,
        message : row.message,
        url : row.url,
        expiry : row.expiry,
    };
}



// -----------------------------------------------------------------------------
// GENERIC DATA TYPE FUNCTIONS
// -----------------------------------------------------------------------------

export function getAsBoolean(row: any, field: string): boolean {
    return row[field];
}
