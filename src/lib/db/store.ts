// local dependencies
import * as mysqldb from './mysqldb';
import * as dbobjects from './objects';
import * as Objects from './db-types';
import * as numbers from '../training/numbers';
import * as conversation from '../training/conversation';
import * as TrainingObjects from '../training/training-types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();

let dbConnPool;

export async function init() {
    if (!dbConnPool) {
        dbConnPool = await mysqldb.connect();
    }
}

export async function disconnect() {
    if (dbConnPool) {
        await mysqldb.disconnect();
        dbConnPool = undefined;
    }
}


async function dbExecute(query: string, params: any[]) {
    const dbConn = await dbConnPool.getConnection();
    const [response] = await dbConn.execute(query, params);
    dbConn.release();
    return response;
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

    const response = await dbExecute(queryString, [
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
    const rows = await dbExecute(queryString, values);
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
    const response = await dbExecute(queryString, values);
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
    const project = await getProject(projectid);
    const labels = project.labels;

    const index = labels.indexOf(labelToRemove);
    if (index !== -1) {
        labels.splice(index, 1);
    }

    await updateLabels(userid, classid, projectid, labels);
    if (project.type === 'text') {
        await deleteTextTrainingLabel(projectid, labelToRemove);
    }
    else if (project.type === 'numbers') {
        await deleteNumberTrainingLabel(projectid, labelToRemove);
    }

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

    const rows = await dbExecute(queryString, [ id ]);
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

    const rows = await dbExecute(queryString, [ classid, userid ]);
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function countProjectsByUserId(userid: string, classid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM `projects` ' +
                        'WHERE `classid` = ? AND `userid` = ?';

    const rows = await dbExecute(queryString, [ classid, userid ]);
    if (rows.length !== 1) {
        return 0;
    }

    return rows[0].count;
}


export async function getProjectsByClassId(classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels` ' +
                        'FROM `projects` ' +
                        'WHERE `classid` = ?';

    const rows = await dbExecute(queryString, [ classid ]);
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function deleteProject(id: string): Promise<void> {
    const queryString = 'DELETE FROM `projects` WHERE `id` = ?';
    const response = await dbExecute(queryString, [ id ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete project');
    }
}


export async function deleteProjectsByUserId(userid: string, classid: string): Promise<void> {
    const queryString = 'DELETE FROM `projects` WHERE `classid` = ? AND `userid` = ?';

    const response = await dbExecute(queryString, [ classid, userid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete projects');
    }
}


export async function deleteProjectsByClassId(classid: string): Promise<void> {
    const queryString = 'DELETE FROM `projects` WHERE `classid` = ?';

    const response = await dbExecute(queryString, [ classid ]);
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

    const response = await dbExecute(queryString, [obj.id, obj.projectid, obj.textdata, obj.label]);
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

    const dbConn = await dbConnPool.getConnection();
    const [response] = await dbConn.query(queryString, [ objects ]);
    await dbConn.release();

    if (response.affectedRows === training.length) {
        return;
    }
    log.error({ response }, 'Failed to store training data');
    throw new Error('Failed to store training data');
}


export async function renameTextTrainingLabel(
    projectid: string, labelBefore: string, labelAfter: string,
): Promise<void>
{
    const queryString = 'UPDATE `texttraining` ' +
                        'SET `label` = ? ' +
                        'WHERE `projectid` = ? AND `label` = ?';
    const dbConn = await dbConnPool.getConnection();
    await dbConn.query(queryString, [ labelAfter, projectid, labelBefore ]);
    dbConn.release();
}



export async function getTextTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryString = 'SELECT `id`, `textdata`, `label` FROM `texttraining` ' +
                        'WHERE `projectid` = ? ' +
                        'ORDER BY `label`, `textdata` ' +
                        'LIMIT ? OFFSET ?';

    const rows = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
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

    const rows = await dbExecute(queryString, [ projectid, label, options.limit, options.start ]);
    return rows.map(dbobjects.getTextTrainingFromDbRow);
}


export async function getTrainingLabels(projectid: string): Promise<string[]> {
    const queryString = 'SELECT DISTINCT `label` FROM `texttraining` WHERE `projectid` = ?';
    const rows = await dbExecute(queryString, [ projectid ]);
    return rows.map((row) => row.label);
}


export async function countTextTraining(projectid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS `trainingcount` FROM `texttraining` WHERE `projectid` = ?';
    const response = await dbExecute(queryString, [projectid]);
    return response[0].trainingcount;
}


export async function countTextTrainingByLabel(projectid: string) {
    const queryString = 'SELECT `label`, COUNT(*) AS `trainingcount` FROM `texttraining` ' +
                        'WHERE `projectid` = ? ' +
                        'GROUP BY `label`';
    const response = await dbExecute(queryString, [projectid]);
    const counts = {};
    for (const count of response) {
        counts[count.label] = count.trainingcount;
    }
    return counts;
}


export async function deleteTextTraining(projectid: string, trainingid: string): Promise<void> {
    const queryString = 'DELETE FROM `texttraining` WHERE `id` = ? AND `projectid` = ?';

    const response = await dbExecute(queryString, [ trainingid, projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}

export async function deleteTextTrainingLabel(projectid: string, label: string): Promise<void>
{
    const queryString = 'DELETE FROM `texttraining` WHERE `projectid` = ? AND `label` = ?';
    const response = await dbExecute(queryString, [ projectid, label ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete label');
    }
}


export async function deleteTextTrainingByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `texttraining` WHERE `projectid` = ?';

    const response = await dbExecute(queryString, [ projectid ]);
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

    const response = await dbExecute(queryString, [
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

    const dbConn = await dbConnPool.getConnection();
    const [response] = await dbConn.query(queryString, [ objects ]);
    dbConn.release();

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

    const rows = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    return rows.map(dbobjects.getNumberTrainingFromDbRow);
}


export async function countNumberTraining(projectid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS `trainingcount` FROM `numbertraining` WHERE `projectid` = ?';
    const response = await dbExecute(queryString, [projectid]);
    return response[0].trainingcount;
}

export async function countNumberTrainingByLabel(projectid: string) {
    const queryString = 'SELECT `label`, COUNT(*) AS `trainingcount` FROM `numbertraining` ' +
                        'WHERE `projectid` = ? ' +
                        'GROUP BY `label`';
    const response = await dbExecute(queryString, [projectid]);
    const counts = {};
    for (const count of response) {
        counts[count.label] = count.trainingcount;
    }
    return counts;
}

export async function deleteNumberTraining(projectid: string, trainingid: string): Promise<void> {
    const queryString = 'DELETE FROM `numbertraining` WHERE `id` = ? AND `projectid` = ?';

    const response = await dbExecute(queryString, [ trainingid, projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}


export async function deleteNumberTrainingLabel(projectid: string, label: string): Promise<void>
{
    const queryString = 'DELETE FROM `numbertraining` WHERE `projectid` = ? AND `label` = ?';
    const response = await dbExecute(queryString, [ projectid, label ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete label');
    }
}


export async function deleteNumberTrainingByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `numbertraining` WHERE `projectid` = ?';

    const response = await dbExecute(queryString, [ projectid ]);
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

    const dbConn = await dbConnPool.getConnection();
    const [response] = await dbConn.query(queryString, values);
    dbConn.release();

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

    const rows = await dbExecute(queryString, [ classid, service ]);
    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return dbobjects.getCredentialsFromDbRow(rows[0]);
}

export async function deleteBluemixCredentials(credentialsid: string): Promise<void> {
    const queryString = 'DELETE FROM `bluemixcredentials` WHERE `id` = ?';

    const response = await dbExecute(queryString, [ credentialsid ]);
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
    const dbConn = await dbConnPool.getConnection();

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
    dbConn.release();

    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return dbobjects.getCredentialsFromDbRow(rows[0]);
}


export async function getNumbersClassifiers(projectid: string): Promise<TrainingObjects.NumbersClassifier[]>
{
    const queryString = 'SELECT `projectid`, `userid`, `classid`, ' +
                        '`created`, `status` ' +
                        'FROM `taxinoclassifiers` ' +
                        'WHERE `projectid` = ?';

    const rows = await dbExecute(queryString, [ projectid ]);
    return rows.map(dbobjects.getNumbersClassifierFromDbRow);
}

export async function getConversationWorkspaces(
    projectid: string,
): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `language`, `created` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ?';

    const rows = await dbExecute(queryString, [ projectid ]);
    return rows.map(dbobjects.getWorkspaceFromDbRow);
}


export async function countConversationWorkspaces(classid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `classid` = ?';

    const rows = await dbExecute(queryString, [ classid ]);
    if (rows.length !== 1) {
        return 0;
    }

    return rows[0].count;
}



export async function storeConversationWorkspace(
    credentials: TrainingObjects.BluemixCredentials,
    userid: string, classid: string, projectid: string,
    workspace: TrainingObjects.ConversationWorkspace,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const obj = dbobjects.createConversationWorkspace(workspace, credentials,
        userid, classid, projectid);

    const queryString: string = 'INSERT INTO `bluemixclassifiers` ' +
                                '(`id`, `credentialsid`, ' +
                                '`projectid`, `userid`, `classid`, ' +
                                '`servicetype`, ' +
                                '`classifierid`, `url`, `name`, `language`, `created`) ' +
                                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const values = [obj.id, obj.credentialsid, obj.projectid, obj.userid, obj.classid,
        obj.servicetype, obj.classifierid, obj.url, obj.name, obj.language, obj.created];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store workspace info');
        throw new Error('Failed to store workspace');
    }

    return workspace;
}


export async function storeNumbersClassifier(
    userid: string, classid: string, projectid: string, status: TrainingObjects.NumbersStatus,
): Promise<TrainingObjects.NumbersClassifier>
{
    const obj = dbobjects.createNumbersClassifier(userid, classid, projectid, status);

    const queryString: string = 'REPLACE INTO `taxinoclassifiers` ' +
                                '(`projectid`, `userid`, `classid`, ' +
                                '`created`, `status`) ' +
                                'VALUES (?, ?, ?, ?, ?)';

    const values = [obj.projectid, obj.userid, obj.classid, obj.created, obj.status];

    const response = await dbExecute(queryString, values);
    if (response.warningStatus !== 0) {
        log.error({ response }, 'Failed to store classifier info');
        throw new Error('Failed to store classifier');
    }

    return dbobjects.getNumbersClassifierFromDbRow(obj);
}



export async function deleteConversationWorkspace(
    projectid: string, userid: string, classid: string,
    classifierid: string,
): Promise<void>
{
    const queryString = 'DELETE FROM `bluemixclassifiers` ' +
                        'WHERE ' +
                        '`projectid` = ? AND `userid` = ? AND `classid` = ? AND ' +
                        '`classifierid` = ?';

    const response = await dbExecute(queryString, [ projectid, userid, classid, classifierid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete classifiers info');
    }
}


export async function deleteConversationWorkspacesByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `bluemixclassifiers` WHERE `projectid` = ?';

    const response = await dbExecute(queryString, [ projectid ]);
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

    const response = await dbExecute(queryString, values);
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

    const response = await dbExecute(queryString, values);
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

    const response = await dbExecute(queryString, values);
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

    const rows = await dbExecute(queryString, [ key ]);
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

    const rows = await dbExecute(queryString, values);
    return rows.map(dbobjects.getScratchKeyFromDbRow);
}


export async function deleteScratchKey(id: string): Promise<void> {
    const queryString = 'DELETE FROM `scratchkeys` WHERE `id` = ?';

    const response = await dbExecute(queryString, [ id ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete scratch key info');
    }
}


export async function deleteScratchKeysByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM `scratchkeys` WHERE `projectid` = ?';

    const response = await dbExecute(queryString, [ projectid ]);
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
                               '`maxprojectsperuser` ' +
                        'FROM `tenants` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ classid ]);
    if (rows.length !== 1) {
        log.error({ rows }, 'Unexpected response from DB');

        return {
            id : classid,
            supportedProjectTypes : [ 'text', 'numbers' ],
            maxUsers : 8,
            maxProjectsPerUser : 3,
        };
    }
    return dbobjects.getClassFromDbRow(rows[0]);
}



// -----------------------------------------------------------------------------
//
// UBER DELETERS
//
// -----------------------------------------------------------------------------


export async function deleteEntireProject(userid: string, classid: string, project: Objects.Project): Promise<void> {
    if (project.type === 'text') {
        const classifiers = await getConversationWorkspaces(project.id);
        for (const classifier of classifiers) {
            await conversation.deleteClassifier(userid, classid, project.id, classifier.workspace_id);
        }
    }
    else if (project.type === 'numbers') {
        await numbers.deleteClassifier(userid, classid, project.id);
    }

    const deleteQueries = [
        'DELETE FROM `projects` WHERE `id` = ?',
        'DELETE FROM `texttraining` WHERE `projectid` = ?',
        'DELETE FROM `numbertraining` WHERE `projectid` = ?',
        'DELETE FROM `bluemixclassifiers` WHERE `projectid` = ?',
        'DELETE FROM `taxinoclassifiers` WHERE `projectid` = ?',
        'DELETE FROM `scratchkeys` WHERE `projectid` = ?',
    ];

    const dbConn = await dbConnPool.getConnection();
    for (const deleteQuery of deleteQueries) {
        await dbConn.execute(deleteQuery, [ project.id ]);
    }
    dbConn.release();
}


export async function deleteEntireUser(userid: string, classid: string): Promise<void> {
    const projects = await getProjectsByUserId(userid, classid);
    for (const project of projects) {
        await deleteEntireProject(userid, classid, project);
    }

    const deleteQueries = [
        'DELETE FROM `projects` WHERE `userid` = ?',
        'DELETE FROM `bluemixclassifiers` WHERE `userid` = ?',
        'DELETE FROM `taxinoclassifiers` WHERE `userid` = ?',
        'DELETE FROM `scratchkeys` WHERE `userid` = ?',
    ];

    const dbConn = await dbConnPool.getConnection();
    for (const deleteQuery of deleteQueries) {
        await dbConn.execute(deleteQuery, [ userid ]);
    }
    dbConn.release();
}

