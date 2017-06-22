// local dependencies
import * as mysqldb from './mysqldb';
import * as dbobjects from './objects';
import * as Objects from './db-types';
import * as nlc from '../training/nlc';
import * as TrainingObjects from '../training/training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();

let dbConn;

export async function init() {
    if (!dbConn) {
        dbConn = await mysqldb.connect();
    }
}

export async function disconnect() {
    if (dbConn) {
        await mysqldb.disconnect();
        dbConn = undefined;
    }
}




// -----------------------------------------------------------------------------
//
// PROJECTS
//
// -----------------------------------------------------------------------------

export async function storeProject(
    userid: string, classid: string, type: Objects.ProjectTypeLabel, name: string, fields: string[],
): Promise<Objects.Project>
{
    let obj: Objects.ProjectDbRow;
    try {
        obj = dbobjects.createProject(userid, classid, type, name, fields);
    }
    catch (err) {
        err.statusCode = 400;
        throw err;
    }

    const queryString: string = 'INSERT INTO `projects` ' +
                                '(`id`, `userid`, `classid`, `typeid`, `name`, `labels`, `fields`) ' +
                                'VALUES (?, ?, ?, ?, ?, ?, ?)';

    const [response] = await dbConn.execute(queryString, [
        obj.id, obj.userid, obj.classid,
        obj.typeid,
        obj.name,
        '', obj.fields,
    ]);
    if (response.affectedRows === 1) {
        return dbobjects.getProjectFromDbRow(obj);
    }
    log.error({ response }, 'Failed to store project');
    throw new Error('Failed to store project');
}


async function getCurrentLabels(userid: string, classid: string, projectid: string): Promise<string[]> {
    const queryString = 'SELECT `id`, `labels` ' +
                        'FROM `projects` ' +
                        'WHERE `id` = ? AND `userid` = ? AND `classid` = ?';
    const values = [
        projectid,
        userid,
        classid,
    ];
    const [rows] = await dbConn.execute(queryString, values);
    if (rows.length !== 1) {
        log.error({ projectid }, 'Project not found');
        throw new Error('Project not found');
    }

    return dbobjects.getLabelsFromList(rows[0].labels);
}
async function updateLabels(userid: string, classid: string, projectid: string, labels: string[]): Promise<any> {
    const queryString = 'UPDATE `projects` ' +
                        'SET `labels` = ? ' +
                        'WHERE `id` = ? AND `userid` = ? AND `classid` = ?';
    const values = [
        labels.join(','),
        projectid,
        userid,
        classid,
    ];
    const [response] = await dbConn.execute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ projectid }, 'Failed to update project');
        throw new Error('Project not updated');
    }
}


export async function addLabelToProject(
    userid: string, classid: string, projectid: string,
    newlabel: string,
): Promise<string[]>
{
    const labels: string[] = await getCurrentLabels(userid, classid, projectid);

    if (labels.includes(newlabel) === false) {
        labels.push(newlabel);
    }

    await updateLabels(userid, classid, projectid, labels);

    return labels;
}


export async function removeLabelFromProject(
    userid: string, classid: string, projectid: string,
    labelToRemove: string,
): Promise<string[]>
{
    const labels: string[] = await getCurrentLabels(userid, classid, projectid);

    const index = labels.indexOf(labelToRemove);
    if (index !== -1) {
        labels.splice(index, 1);
    }

    await updateLabels(userid, classid, projectid, labels);

    return labels;
}


export async function replaceLabelsForProject(
    userid: string, classid: string, projectid: string,
    labels: string[],
): Promise<string[]>
{
    await updateLabels(userid, classid, projectid, labels);
    return labels;
}


export async function getProject(id: string): Promise<Objects.Project> {
    const queryString = 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels`, `fields` ' +
                        'FROM `projects` ' +
                        'WHERE `id` = ?';

    const [rows] = await dbConn.execute(queryString, [ id ]);
    if (rows.length !== 1) {
        log.error({ id }, 'Project not found');
        return;
    }
    return dbobjects.getProjectFromDbRow(rows[0]);
}


export async function getProjectsByUserId(userid: string, classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels` ' +
                        'FROM `projects` ' +
                        'WHERE `classid` = ? AND `userid` = ?';

    const [rows] = await dbConn.execute(queryString, [ classid, userid ]);
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function countProjectsByUserId(userid: string, classid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM `projects` ' +
                        'WHERE `classid` = ? AND `userid` = ?';

    const [rows] = await dbConn.execute(queryString, [ classid, userid ]);
    if (rows.length !== 1) {
        return 0;
    }

    return rows[0].count;
}


export async function getProjectsByClassId(classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels` ' +
                        'FROM `projects` ' +
                        'WHERE `classid` = ?';

    const [rows] = await dbConn.execute(queryString, [ classid ]);
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function deleteProject(id: string): Promise<void> {
    const queryString = 'DELETE FROM `projects` WHERE `id` = ?';
    const [response] = await dbConn.execute(queryString, [ id ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete project');
    }
}


export async function deleteProjectsByUserId(userid: string, classid: string): Promise<void> {
    const queryString = 'DELETE FROM `projects` WHERE `classid` = ? AND `userid` = ?';

    const [response] = await dbConn.execute(queryString, [ classid, userid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete projects');
    }
}


export async function deleteProjectsByClassId(classid: string): Promise<void> {
    const queryString = 'DELETE FROM `projects` WHERE `classid` = ?';

    const [response] = await dbConn.execute(queryString, [ classid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete projects');
    }
}


// -----------------------------------------------------------------------------
//
// TRAINING DATA
//
// -----------------------------------------------------------------------------

export async function storeTextTraining(
    projectid: string, data: string, label: string,
): Promise<Objects.TextTraining>
{
    const obj = dbobjects.createTextTraining(projectid, data, label);

    const queryString = 'INSERT INTO `texttraining` (`id`, `projectid`, `textdata`, `label`) VALUES (?, ?, ?, ?)';

    const [response] = await dbConn.execute(queryString, [obj.id, obj.projectid, obj.textdata, obj.label]);
    if (response.affectedRows === 1) {
        return dbobjects.getTextTrainingFromDbRow(obj);
    }
    log.error({ response }, 'Failed to store training data');
    throw new Error('Failed to store training data');
}


export async function bulkStoreTextTraining(
    projectid: string, training: Array<{textdata: string, label: string}>,
): Promise<void>
{
    const objects = training.map((item) => {
        const obj = dbobjects.createTextTraining(projectid, item.textdata, item.label);
        return [obj.id, obj.projectid, obj.textdata, obj.label];
    });

    const queryString = 'INSERT INTO `texttraining` (`id`, `projectid`, `textdata`, `label`) VALUES ?';
    const [response] = await dbConn.query(queryString, [ objects ]);
    if (response.affectedRows === training.length) {
        return;
    }
    log.error({ response }, 'Failed to store training data');
    throw new Error('Failed to store training data');
}


export function renameTextTrainingLabel(
    projectid: string, labelBefore: string, labelAfter: string,
): Promise<void>
{
    const queryString = 'UPDATE `texttraining` ' +
                        'SET `label` = ? ' +
                        'WHERE `projectid` = ? AND `label` = ?';
    return dbConn.query(queryString, [ labelAfter, projectid, labelBefore ]);
}


export async function getTextTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryString = 'SELECT `id`, `textdata`, `label` FROM `texttraining` ' +
                        'WHERE `projectid` = ? ' +
                        'ORDER BY `label`, `textdata` ' +
                        'LIMIT ? OFFSET ?';

    const [rows] = await dbConn.execute(queryString, [ projectid, options.limit, options.start ]);
    return rows.map(dbobjects.getTextTrainingFromDbRow);
}


export async function getTextTrainingByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryString = 'SELECT `id`, `textdata`, `label` FROM `texttraining` ' +
                        'WHERE `projectid` = ? AND `label` = ? ' +
                        'ORDER BY `textdata` ' +
                        'LIMIT ? OFFSET ?';

    const [rows] = await dbConn.execute(queryString, [ projectid, label, options.limit, options.start ]);
    return rows.map(dbobjects.getTextTrainingFromDbRow);
}


export async function getTrainingLabels(projectid: string): Promise<string[]> {
    const queryString = 'SELECT DISTINCT `label` FROM `texttraining` WHERE `projectid` = ?';
    const [rows] = await dbConn.execute(queryString, [ projectid ]);
    return rows.map((row) => row.label);
}


export async function countTextTraining(projectid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS `trainingcount` FROM `texttraining` WHERE `projectid` = ?';
    const [response] = await dbConn.execute(queryString, [projectid]);
    return response[0].trainingcount;
}


export async function countTextTrainingByLabel(projectid: string) {
    const queryString = 'SELECT `label`, COUNT(*) AS `trainingcount` FROM `texttraining` ' +
                        'WHERE `projectid` = ? ' +
                        'GROUP BY `label`';
    const [response] = await dbConn.execute(queryString, [projectid]);
    const counts = {};
    for (const count of response) {
        counts[count.label] = count.trainingcount;
    }
    return counts;
}


export async function deleteTextTraining(projectid: string, trainingid: string): Promise<void> {
    const queryString = 'DELETE FROM `texttraining` WHERE `id` = ? AND `projectid` = ?';

    const [response] = await dbConn.execute(queryString, [ trainingid, projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}


export async function deleteTextTrainingByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `texttraining` WHERE `projectid` = ?';

    const [response] = await dbConn.execute(queryString, [ projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}



export async function storeNumberTraining(
    projectid: string, data: number[], label: string,
): Promise<Objects.NumberTraining>
{
    const obj = dbobjects.createNumberTraining(projectid, data, label);

    const queryString = 'INSERT INTO `numbertraining` ' +
                        '(`id`, `projectid`, `numberdata`, `label`) ' +
                        'VALUES (?, ?, ?, ?)';

    const [response] = await dbConn.execute(queryString, [
        obj.id,
        obj.projectid,
        data.join(','),
        obj.label,
    ]);
    if (response.affectedRows === 1) {
        return obj;
    }
    log.error({ response }, 'Failed to store training data');
    throw new Error('Failed to store training data');
}

export async function bulkStoreNumberTraining(
    projectid: string, training: Array<{numberdata: number[], label: string}>,
): Promise<void>
{
    const objects = training.map((item) => {
        const obj = dbobjects.createNumberTraining(projectid, item.numberdata, item.label);
        return [obj.id, obj.projectid, obj.numberdata.join(','), obj.label];
    });

    const queryString = 'INSERT INTO `numbertraining` (`id`, `projectid`, `numberdata`, `label`) VALUES ?';
    const [response] = await dbConn.query(queryString, [ objects ]);
    if (response.affectedRows === training.length) {
        return;
    }
    log.error({ response }, 'Failed to store training data');
    throw new Error('Failed to store training data');
}



export async function getNumberTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.NumberTraining[]>
{
    const queryString = 'SELECT `id`, `numberdata`, `label` FROM `numbertraining` ' +
                        'WHERE `projectid` = ? ' +
                        'ORDER BY `label` ' +
                        'LIMIT ? OFFSET ?';

    const [rows] = await dbConn.execute(queryString, [ projectid, options.limit, options.start ]);
    return rows.map(dbobjects.getNumberTrainingFromDbRow);
}


export async function countNumberTraining(projectid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS `trainingcount` FROM `numbertraining` WHERE `projectid` = ?';
    const [response] = await dbConn.execute(queryString, [projectid]);
    return response[0].trainingcount;
}

export async function deleteNumberTraining(projectid: string, trainingid: string): Promise<void> {
    const queryString = 'DELETE FROM `numbertraining` WHERE `id` = ? AND `projectid` = ?';

    const [response] = await dbConn.execute(queryString, [ trainingid, projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}


export async function deleteNumberTrainingByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `numbertraining` WHERE `projectid` = ?';

    const [response] = await dbConn.execute(queryString, [ projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}


// -----------------------------------------------------------------------------
//
// BLUEMIX CREDENTIALS
//
// -----------------------------------------------------------------------------

export async function storeBluemixCredentials(
    classid: string, credentials: TrainingObjects.BluemixCredentials,
): Promise<TrainingObjects.BluemixCredentials>
{
    const queryString = 'INSERT INTO `bluemixcredentials` ' +
                        '(`id`, `classid`, `servicetype`, `url`, `username`, `password`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?)';

    const values = [ credentials.id, classid,
        credentials.servicetype, credentials.url, credentials.username, credentials.password ];

    const [response] = await dbConn.query(queryString, values);
    if (response.affectedRows === 1) {
        return credentials;
    }
    log.error({ response }, 'Failed to store credentials');
    throw new Error('Failed to store credentials');
}


export async function getBluemixCredentials(
    classid: string, service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials>
{
    const queryString = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password` ' +
                        'FROM `bluemixcredentials` ' +
                        'WHERE `classid` = ? AND `servicetype` = ?';

    const [rows] = await dbConn.execute(queryString, [ classid, service ]);
    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return dbobjects.getCredentialsFromDbRow(rows[0]);
}

export async function deleteBluemixCredentials(credentialsid: string): Promise<void> {
    const queryString = 'DELETE FROM `bluemixcredentials` WHERE `id` = ?';

    const [response] = await dbConn.execute(queryString, [ credentialsid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete credentials info');
    }
}


/**
 * Get the credentials to use for a specific classifier.
 *
 * As there may be more than one set of Bluemix credentials for a particular
 * service and tenant/class, this function is used to ensure we get the ones
 * that can be used for a particular classifier.
 */
export async function getServiceCredentials(
    projectid: string, classid: string, userid: string,
    servicetype: TrainingObjects.BluemixServiceType, classifierid: string,
): Promise<TrainingObjects.BluemixCredentials>
{
    const queryString = 'SELECT `credentialsid` FROM `bluemixclassifiers` ' +
                        'WHERE ' +
                        '`servicetype` = ? AND `classifierid` = ? AND ' +
                        '`projectid` = ? AND `classid` = ? AND `userid` = ?';
    const values = [servicetype, classifierid, projectid, classid, userid];
    const [response] = await dbConn.execute(queryString, values);

    if (response.length !== 1) {
        log.error({ response }, 'Failed to retrieve classifier credentials');
    }

    const credentialsId = response[0].credentialsid;

    const credsQuery = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password` ' +
                       'FROM `bluemixcredentials` ' +
                       'WHERE `id` = ?';

    const [rows] = await dbConn.execute(credsQuery, [ credentialsId ]);
    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return dbobjects.getCredentialsFromDbRow(rows[0]);
}


export async function getNLCClassifiers(
    projectid: string,
): Promise<TrainingObjects.NLCClassifier[]>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `language`, `created` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ?';

    const [rows] = await dbConn.execute(queryString, [ projectid ]);
    return rows.map(dbobjects.getClassifierFromDbRow);
}


export async function countNLCClassifiers(classid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `classid` = ?';

    const [rows] = await dbConn.execute(queryString, [ classid ]);
    if (rows.length !== 1) {
        return 0;
    }

    return rows[0].count;
}


export async function storeNLCClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    userid: string, classid: string, projectid: string,
    classifier: TrainingObjects.NLCClassifier,
): Promise<TrainingObjects.NLCClassifier>
{
    const obj = dbobjects.createNLCClassifier(classifier, credentials,
        userid, classid, projectid);

    const queryString: string = 'INSERT INTO `bluemixclassifiers` ' +
                                '(`id`, `credentialsid`, ' +
                                '`projectid`, `userid`, `classid`, ' +
                                '`servicetype`, ' +
                                '`classifierid`, `url`, `name`, `language`, `created`) ' +
                                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const values = [obj.id, obj.credentialsid, obj.projectid, obj.userid, obj.classid,
        obj.servicetype, obj.classifierid, obj.url, obj.name, obj.language, obj.created];

    const [response] = await dbConn.execute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store classifier info');
        throw new Error('Failed to store classifier');
    }

    return classifier;
}


export async function deleteNLCClassifier(
    projectid: string, userid: string, classid: string,
    classifierid: string,
): Promise<void>
{
    const queryString = 'DELETE FROM `bluemixclassifiers` ' +
                        'WHERE ' +
                        '`projectid` = ? AND `userid` = ? AND `classid` = ? AND ' +
                        '`classifierid` = ?';

    const [response] = await dbConn.execute(queryString, [ projectid, userid, classid, classifierid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete classifiers info');
    }
}


export async function deleteNLCClassifiersByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `bluemixclassifiers` WHERE `projectid` = ?';

    const [response] = await dbConn.execute(queryString, [ projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete classifiers info');
    }
}



// -----------------------------------------------------------------------------
//
// SCRATCH KEYS
//
// -----------------------------------------------------------------------------

export async function storeUntrainedScratchKey(
    projectid: string, projectname: string,
    projecttype: Objects.ProjectTypeLabel,
    userid: string, classid: string,
): Promise<string>
{
    const obj = dbobjects.createUntrainedScratchKey(projectname, projecttype, projectid);

    const queryString = 'INSERT INTO `scratchkeys` ' +
                        '(`id`, ' +
                        '`projectid`, `projectname`, `projecttype`, ' +
                        '`userid`, `classid`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?)';

    const values = [
        obj.id,
        projectid, obj.name, obj.type,
        userid, classid,
    ];

    const [response] = await dbConn.execute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store Scratch key');
        throw new Error('Failed to store Scratch key');
    }

    return obj.id;
}


/**
 * @returns the ScratchKey ID - whether created or updated
 */
export async function storeOrUpdateScratchKey(
    projectid: string, projecttype: Objects.ProjectTypeLabel,
    userid: string, classid: string,
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string,
): Promise<string>
{
    const existing: Objects.ScratchKey[] = await findScratchKeys(userid, projectid, classid);
    if (existing.length > 0) {
        return updateScratchKey(
            existing[0].id,
            userid, projectid, classid,
            credentials,
            classifierid,
        );
    }
    else {
        const projectInfo = await getProject(projectid);

        return storeScratchKey(
            projectid, projectInfo.name, projecttype,
            userid, classid,
            credentials, classifierid,
        );
    }
}


/**
 * @returns the created scratchkey ID
 */
export async function storeScratchKey(
    projectid: string, projectname: string,
    projecttype: Objects.ProjectTypeLabel,
    userid: string, classid: string,
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string,
): Promise<string>
{
    const obj = dbobjects.createScratchKey(credentials, projectname, projecttype, projectid, classifierid);

    const queryString = 'INSERT INTO `scratchkeys` ' +
                        '(`id`, `projectname`, `projecttype`, ' +
                        '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                        '`classifierid`, ' +
                        '`projectid`, `userid`, `classid`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [
        obj.id, projectname, projecttype,
        obj.credentials.url, obj.credentials.username, obj.credentials.password,
        obj.classifierid,
        obj.projectid, userid, classid,
    ];

    const [response] = await dbConn.execute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store Scratch key');
        throw new Error('Failed to store Scratch key');
    }

    return obj.id;
}


/**
 * @returns scratchKeyId
 */
async function updateScratchKey(
    scratchKeyId: string,
    userid: string, projectid: string, classid: string,
    credentials: TrainingObjects.BluemixCredentials, classifierid: string,
): Promise<string>
{
    const queryString = 'UPDATE `scratchkeys` ' +
                        'SET `classifierid` = ? , ' +
                            '`serviceurl` = ? , `serviceusername` = ? , `servicepassword` = ? ' +
                        'WHERE `id` = ? AND ' +
                            '`userid` = ? AND `projectid` = ? AND `classid` = ?';
    const values = [
        classifierid,
        credentials.url, credentials.username, credentials.password,
        scratchKeyId,
        userid, projectid, classid,
    ];

    const [response] = await dbConn.execute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ queryString, values, response }, 'Failed to update scratchkey');
        throw new Error('Scratch key not updated');
    }

    return scratchKeyId;
}



export async function getScratchKey(key: string): Promise<Objects.ScratchKey> {
    const queryString = 'SELECT ' +
                            '`id`, ' +
                            '`projectid`, `projectname`, `projecttype`, ' +
                            '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                            '`classifierid` ' +
                        'FROM `scratchkeys` ' +
                        'WHERE `id` = ?';

    const [rows] = await dbConn.execute(queryString, [ key ]);
    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return dbobjects.getScratchKeyFromDbRow(rows[0]);
}



export async function findScratchKeys(
    userid: string, projectid: string, classid: string,
): Promise<Objects.ScratchKey[]>
{
    const queryString = 'SELECT ' +
                            '`id`, `projectid`, `projectname`, `projecttype`, ' +
                            '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                            '`classifierid` ' +
                        'FROM `scratchkeys` ' +
                        'WHERE `projectid` = ? AND `userid` = ? AND `classid` = ?';

    const values = [ projectid, userid, classid ];

    const [rows] = await dbConn.execute(queryString, values);
    return rows.map(dbobjects.getScratchKeyFromDbRow);
}


export async function deleteScratchKey(id: string): Promise<void> {
    const queryString = 'DELETE FROM `scratchkeys` WHERE `id` = ?';

    const [response] = await dbConn.execute(queryString, [ id ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete scratch key info');
    }
}


export async function deleteScratchKeysByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `scratchkeys` WHERE `projectid` = ?';

    const [response] = await dbConn.execute(queryString, [ projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete scratch key info');
    }
}



// -----------------------------------------------------------------------------
//
// TENANT INFO
//
// -----------------------------------------------------------------------------

export async function getClassTenant(classid: string): Promise<Objects.ClassTenant> {
    const queryString = 'SELECT `id`, `projecttypes`, `maxusers`, ' +
                               '`maxprojectsperuser`, `maxnlcclassifiers`, `nlcexpirydays` ' +
                        'FROM `tenants` ' +
                        'WHERE `id` = ?';

    const [rows] = await dbConn.execute(queryString, [ classid ]);
    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');

        return {
            id : classid,
            supportedProjectTypes : [ 'text', 'numbers' ],
            maxUsers : 8,
            maxProjectsPerUser : 3,
            maxNLCClassifiers : 10,
            nlcExpiryDays : 14,
        };
    }
    return dbobjects.getClassFromDbRow(rows[0]);
}



// -----------------------------------------------------------------------------
//
// UBER DELETERS
//
// -----------------------------------------------------------------------------


export async function deleteEntireProject(userid: string, classid: string, projectid: string): Promise<void> {
    const classifiers = await getNLCClassifiers(projectid);
    for (const classifier of classifiers) {
        await nlc.deleteClassifier(userid, classid, projectid, classifier.classifierid);
    }

    const deleteQueries = [
        'DELETE FROM `projects` WHERE `id` = ?',
        'DELETE FROM `texttraining` WHERE `projectid` = ?',
        'DELETE FROM `numbertraining` WHERE `projectid` = ?',
        'DELETE FROM `bluemixclassifiers` WHERE `projectid` = ?',
        'DELETE FROM `scratchkeys` WHERE `projectid` = ?',
    ];
    for (const deleteQuery of deleteQueries) {
        await dbConn.execute(deleteQuery, [ projectid ]);
    }
}

export async function deleteEntireUser(userid: string, classid: string): Promise<void> {
    const projects = await getProjectsByUserId(userid, classid);
    for (const project of projects) {
        await deleteEntireProject(userid, classid, project.id);
    }

    const deleteQueries = [
        'DELETE FROM `projects` WHERE `userid` = ?',
        'DELETE FROM `bluemixclassifiers` WHERE `userid` = ?',
        'DELETE FROM `scratchkeys` WHERE `userid` = ?',
    ];
    for (const deleteQuery of deleteQueries) {
        await dbConn.execute(deleteQuery, [ userid ]);
    }
}

