// local dependencies
import * as mysqldb from './mysqldb';
import * as dbobjects from './objects';
import * as Objects from './db-types';
import * as numbers from '../training/numbers';
import * as conversation from '../training/conversation';
import * as visualrec from '../training/visualrecognition';
import * as TrainingObjects from '../training/training-types';
import * as limits from './limits';
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

export function replaceDbConnPoolForTest(testDbConnPool) {
    dbConnPool = testDbConnPool;
}

async function restartConnection() {
    log.info('Restarting DB connection pool');
    try {
        await disconnect();
        await init();
    }
    catch (err) {
        log.error({ err }, 'Probably-irrecoverable-failure while trying to restart the DB connection');
    }
}


async function handleDbException(err) {
    log.error({ err }, 'DB error');
    if (err.code === 'ER_OPTION_PREVENTS_STATEMENT' &&  err.errno === 1290)
    {
        // for this error, it is worth trying to reconnect to the DB
        await restartConnection();
    }
}


async function dbExecute(query: string, params: any[]) {
    // const [response] = await dbConnPool.execute(query, params);
    // return response;
    const dbConn = await dbConnPool.getConnection();
    try {
        const [response] = await dbConn.execute(query, params);
        return response;
    }
    catch (err) {
        await handleDbException(err);
        throw err;
    }
    finally {
        dbConn.release();
    }
}



// -----------------------------------------------------------------------------
//
// PROJECTS
//
// -----------------------------------------------------------------------------

export async function storeProject(
    userid: string, classid: string, type: Objects.ProjectTypeLabel, name: string,
    fields: Objects.NumbersProjectFieldSummary[],
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

    const insertProjectQry: string = 'INSERT INTO `projects` ' +
        '(`id`, `userid`, `classid`, `typeid`, `name`, `labels`, `numfields`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)';
    const insertProjectValues = [
        obj.id, obj.userid, obj.classid,
        obj.typeid, obj.name, obj.labels, obj.fields.length,
    ];

    const insertFieldsQry: string = 'INSERT INTO `numbersprojectsfields` ' +
        '(`id`, `userid`, `classid`, `projectid`, `name`, `fieldtype`, `choices`) ' +
        'VALUES ?';
    const insertFieldsValues = obj.fields.map((field: Objects.NumbersProjectFieldDbRow) => {
        return [
            field.id, field.userid, field.classid, field.projectid, field.name, field.fieldtype, field.choices,
        ];
    });


    let outcome = InsertTrainingOutcome.StoredOk;

    const dbConn = await dbConnPool.getConnection();
    try {
        // store the project info
        const [insertResponse] = await dbConn.execute(insertProjectQry, insertProjectValues);
        if (insertResponse.affectedRows !== 1) {
            log.error({ insertResponse }, 'Failed to store project info');
            outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
        }

        // store the fields for the project if we have any
        if (outcome === InsertTrainingOutcome.StoredOk && insertFieldsValues.length > 0) {
            const [insertFieldsResponse] = await dbConn.query(insertFieldsQry, [ insertFieldsValues ]);
            if (insertFieldsResponse.affectedRows !== insertFieldsValues.length) {
                log.error({ insertFieldsResponse }, 'Failed to store project fields');
                outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
            }
        }
    }
    catch (err) {
        handleDbException(err);
        throw err;
    }
    finally {
        dbConn.release();
    }


    if (outcome === InsertTrainingOutcome.StoredOk) {
        return dbobjects.getProjectFromDbRow(obj);
    }

    throw new Error('Failed to store project');
}



export async function getNumberProjectFields(
    userid: string, classid: string, projectid: string,
): Promise<Objects.NumbersProjectField[]>
{
    const queryString = 'SELECT `id`, `userid`, `classid`, `projectid`, `name`, `fieldtype`, `choices` ' +
                        'FROM `numbersprojectsfields` ' +
                        'WHERE `userid` = ? AND `classid` = ? AND `projectid` = ? ' +
                        'ORDER BY `id`';

    const rows = await dbExecute(queryString, [ userid, classid, projectid ]);

    return rows.map(dbobjects.getNumbersProjectFieldFromDbRow);
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
        dbobjects.getLabelListFromArray(labels),
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
    label: string,
): Promise<string[]>
{
    const labels: string[] = await getCurrentLabels(userid, classid, projectid);

    const newlabel = dbobjects.createLabel(label);

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
    await deleteTrainingLabel(project.type, projectid, labelToRemove);

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
    const queryString = 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels`, `numfields` ' +
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

function getDbTable(type: Objects.ProjectTypeLabel): string {
    switch (type) {
    case 'text':
        return 'texttraining';
    case 'numbers':
        return 'numbertraining';
    case 'images':
        return 'imagetraining';
    }
}


export async function countTraining(type: Objects.ProjectTypeLabel, projectid: string): Promise<number> {
    const dbTable = getDbTable(type);
    const queryString = 'SELECT COUNT(*) AS `trainingcount` FROM `' + dbTable + '` WHERE `projectid` = ?';
    const response = await dbExecute(queryString, [projectid]);
    return response[0].trainingcount;
}


export async function countTrainingByLabel(type: Objects.ProjectTypeLabel, projectid: string) {
    const dbTable = getDbTable(type);

    const queryString = 'SELECT `label`, COUNT(*) AS `trainingcount` FROM `' + dbTable + '` ' +
                        'WHERE `projectid` = ? ' +
                        'GROUP BY `label`';
    const response = await dbExecute(queryString, [projectid]);
    const counts = {};
    for (const count of response) {
        counts[count.label] = count.trainingcount;
    }
    return counts;
}


export async function renameTrainingLabel(
    type: Objects.ProjectTypeLabel,
    projectid: string, labelBefore: string, labelAfter: string,
): Promise<void>
{
    const dbTable = getDbTable(type);
    const queryString = 'UPDATE `' + dbTable + '` ' +
                        'SET `label` = ? ' +
                        'WHERE `projectid` = ? AND `label` = ?';
    const dbConn = await dbConnPool.getConnection();
    await dbConn.query(queryString, [ labelAfter, projectid, labelBefore ]);
    dbConn.release();
}


export async function deleteTraining(
    type: Objects.ProjectTypeLabel,
    projectid: string, trainingid: string,
): Promise<void>
{
    const dbTable = getDbTable(type);
    const queryString = 'DELETE FROM `' + dbTable + '` WHERE `id` = ? AND `projectid` = ?';

    const response = await dbExecute(queryString, [ trainingid, projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}


async function deleteTrainingLabel(
    type: Objects.ProjectTypeLabel,
    projectid: string, label: string,
): Promise<void>
{
    const dbTable = getDbTable(type);
    const queryString = 'DELETE FROM `' + dbTable + '` WHERE `projectid` = ? AND `label` = ?';

    const response = await dbExecute(queryString, [ projectid, label ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete label');
    }
}


export async function deleteTrainingByProjectId(type: Objects.ProjectTypeLabel, projectid: string): Promise<void> {
    const dbTable = getDbTable(type);
    const queryString = 'DELETE FROM `' + dbTable + '` WHERE `projectid` = ?';

    const response = await dbExecute(queryString, [ projectid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete training');
    }
}








export async function storeTextTraining(
    projectid: string, data: string, label: string,
): Promise<Objects.TextTraining>
{
    let outcome: InsertTrainingOutcome;

    // prepare the data that we want to store
    const obj = dbobjects.createTextTraining(projectid, data, label);

    //
    // prepare the queries so we have everything ready before we
    //  get a DB connection from the pool
    //

    const countQry = 'SELECT COUNT(*) AS `trainingcount` FROM `texttraining` WHERE `projectid` = ?';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO `texttraining` (`id`, `projectid`, `textdata`, `label`) VALUES (?, ?, ?, ?)';
    const insertValues = [ obj.id, obj.projectid, obj.textdata, obj.label ];


    //
    // connect to the DB
    //

    const dbConn = await dbConnPool.getConnection();

    try {
        // count how much training data they already have
        const [countResponse] = await dbConn.execute(countQry, countValues);
        const count = countResponse[0].trainingcount;

        if (count >= limits.getStoreLimits().textTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't hit their limit - okay to do the INSERT now
            const [insertResponse] = await dbConn.execute(insertQry, insertValues);
            if (insertResponse.affectedRows === 1) {
                outcome = InsertTrainingOutcome.StoredOk;
            }
            else {
                // insert failed for no clear reason
                outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
            }
        }
    }
    catch (err) {
        handleDbException(err);
        throw err;
    }
    finally {
        dbConn.release();
    }


    //
    // prepare the response for the client
    //

    switch (outcome) {
    case InsertTrainingOutcome.StoredOk:
        return dbobjects.getTextTrainingFromDbRow(obj);
    case InsertTrainingOutcome.NotStored_MetLimit:
        throw new Error('Project already has maximum allowed amount of training data');
    case InsertTrainingOutcome.NotStored_UnknownFailure:
        throw new Error('Failed to store training data');
    }
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
    throw new Error('Failed to store training data');
}



export async function getTextTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryString = 'SELECT `id`, `textdata`, `label` FROM `texttraining` ' +
                        'WHERE `projectid` = ? ' +
                        'ORDER BY `label`, `id` ' +
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

export async function getUniqueTrainingTextsByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<string[]>
{
    // Conversation chokes on duplicate texts, so we're using SELECT DISTINCT to avoid that
    const queryString = 'SELECT DISTINCT `textdata` FROM `texttraining` ' +
                        'WHERE `projectid` = ? AND `label` = ? ' +
                        'LIMIT ? OFFSET ?';

    const rows = await dbExecute(queryString, [ projectid, label, options.limit, options.start ]);
    return rows.map((row) => row.textdata);
}


export async function storeImageTraining(
    projectid: string, imageurl: string, label: string,
): Promise<Objects.ImageTraining>
{
    let outcome: InsertTrainingOutcome;

    // prepare the data that we want to store
    const obj = dbobjects.createImageTraining(projectid, imageurl, label);


    //
    // prepare the queries so we have everything ready before we
    //  get a DB connection from the pool
    //

    const countQry = 'SELECT COUNT(*) AS `trainingcount` FROM `imagetraining` WHERE `projectid` = ?';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO `imagetraining` (`id`, `projectid`, `imageurl`, `label`) VALUES (?, ?, ?, ?)';
    const insertValues = [ obj.id, obj.projectid, obj.imageurl, obj.label ];


    //
    // connect to the DB
    //

    const dbConn = await dbConnPool.getConnection();

    try {
        // count how much training data they already have
        const [countResponse] = await dbConn.execute(countQry, countValues);
        const count = countResponse[0].trainingcount;

        if (count >= limits.getStoreLimits().imageTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't hit their limit - okay to do the INSERT now
            const [insertResponse] = await dbConn.execute(insertQry, insertValues);
            if (insertResponse.affectedRows === 1) {
                outcome = InsertTrainingOutcome.StoredOk;
            }
            else {
                // insert failed for no clear reason
                outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
            }
        }
    }
    catch (err) {
        handleDbException(err);
        throw err;
    }
    finally {
        dbConn.release();
    }


    //
    // prepare the response for the client
    //

    switch (outcome) {
    case InsertTrainingOutcome.StoredOk:
        return dbobjects.getImageTrainingFromDbRow(obj);
    case InsertTrainingOutcome.NotStored_MetLimit:
        throw new Error('Project already has maximum allowed amount of training data');
    case InsertTrainingOutcome.NotStored_UnknownFailure:
        throw new Error('Failed to store training data');
    }
}


export async function getImageTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT `id`, `imageurl`, `label` FROM `imagetraining` ' +
                        'WHERE `projectid` = ? ' +
                        'ORDER BY `label`, `imageurl` ' +
                        'LIMIT ? OFFSET ?';

    const rows = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}


export async function getImageTrainingByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT `id`, `imageurl`, `label` FROM `imagetraining` ' +
                        'WHERE `projectid` = ? AND `label` = ? ' +
                        'LIMIT ? OFFSET ?';

    const rows = await dbExecute(queryString, [ projectid, label, options.limit, options.start ]);
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}




enum InsertTrainingOutcome {
    StoredOk,
    NotStored_MetLimit,
    NotStored_UnknownFailure,
}


export async function storeNumberTraining(
    projectid: string, data: number[], label: string,
): Promise<Objects.NumberTraining>
{
    let outcome: InsertTrainingOutcome;

    // prepare the data that we want to store
    const obj = dbobjects.createNumberTraining(projectid, data, label);


    //
    // prepare the queries so we have everything ready before we
    //  get a DB connection from the pool
    //

    const countQry = 'SELECT COUNT(*) AS `trainingcount` FROM `numbertraining` WHERE `projectid` = ?';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO `numbertraining` ' +
                      '(`id`, `projectid`, `numberdata`, `label`) VALUES (?, ?, ?, ?)';
    const insertValues = [ obj.id, obj.projectid, data.join(','), obj.label ];


    //
    // connect to the DB
    //

    const dbConn = await dbConnPool.getConnection();

    try {
        // count how much training data they already have
        const [countResponse] = await dbConn.execute(countQry, countValues);
        const count = countResponse[0].trainingcount;

        if (count >= limits.getStoreLimits().numberTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't hit their limit - okay to do the INSERT now
            const [insertResponse] = await dbConn.execute(insertQry, insertValues);
            if (insertResponse.affectedRows === 1) {
                outcome = InsertTrainingOutcome.StoredOk;
            }
            else {
                // insert failed for no clear reason
                outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
            }
        }
    }
    catch (err) {
        handleDbException(err);
        throw err;
    }
    finally {
        dbConn.release();
    }


    //
    // prepare the response for the client
    //

    switch (outcome) {
    case InsertTrainingOutcome.StoredOk:
        return obj;
    case InsertTrainingOutcome.NotStored_MetLimit:
        throw new Error('Project already has maximum allowed amount of training data');
    case InsertTrainingOutcome.NotStored_UnknownFailure:
        throw new Error('Failed to store training data');
    }
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

    const response = await dbExecute(queryString, values);
    if (response.affectedRows === 1) {
        return credentials;
    }
    throw new Error('Failed to store credentials');
}


export async function getAllBluemixCredentials(
    service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password` ' +
                        'FROM `bluemixcredentials` ' +
                        'WHERE `servicetype` = ?';

    const rows = await dbExecute(queryString, [ service ]);
    if (rows.length === 0) {
        log.error({ rows, func : 'getBluemixCredentials' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return rows.map(dbobjects.getCredentialsFromDbRow);
}



export async function getBluemixCredentials(
    classid: string, service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password` ' +
                        'FROM `bluemixcredentials` ' +
                        'WHERE `classid` = ? AND `servicetype` = ?';

    const rows = await dbExecute(queryString, [ classid, service ]);
    if (rows.length === 0) {
        log.error({ rows, func : 'getBluemixCredentials' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return rows.map(dbobjects.getCredentialsFromDbRow);
}


export async function getBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    const credsQuery = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password` ' +
                       'FROM `bluemixcredentials` ' +
                       'WHERE `id` = ?';
    const rows = await dbExecute(credsQuery, [ credentialsid ]);

    if (rows.length !== 1) {
        log.error({ rows, func : 'getBluemixCredentialsById' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving the service credentials');
    }
    return dbobjects.getCredentialsFromDbRow(rows[0]);
}



export async function countBluemixCredentialsByType(classid: string): Promise<{ conv: number, visrec: number }>
{
    const credsQuery = 'SELECT `servicetype`, count(*) as count ' +
                       'FROM `bluemixcredentials` ' +
                       'WHERE `classid` = ? ' +
                       'GROUP BY `servicetype`';
    const rows = await dbExecute(credsQuery, [ classid ]);

    const counts = { conv : 0, visrec : 0 };
    for (const row of rows) {
        counts[row.servicetype] = row.count;
    }

    return counts;
}



export async function deleteBluemixCredentials(credentialsid: string): Promise<void> {
    const queryString = 'DELETE FROM `bluemixcredentials` WHERE `id` = ?';

    const response = await dbExecute(queryString, [ credentialsid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete credentials info');
    }
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
                        ' `classifierid`, `url`, `name`, `language`, `created`, `expiry` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ?';

    const rows = await dbExecute(queryString, [ projectid ]);
    return rows.map(dbobjects.getWorkspaceFromDbRow);
}

export async function getConversationWorkspace(
    projectid: string, classifierid: string,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `language`, `created`, `expiry` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ? AND `classifierid` = ?';

    const rows = await dbExecute(queryString, [ projectid, classifierid ]);
    if (rows.length !== 1) {
        log.error({ rows, func : 'getConversationWorkspace' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service details');
    }
    return dbobjects.getWorkspaceFromDbRow(rows[0]);
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
    project: Objects.Project,
    workspace: TrainingObjects.ConversationWorkspace,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const obj = dbobjects.createConversationWorkspace(workspace, credentials, project);

    const queryString: string = 'INSERT INTO `bluemixclassifiers` ' +
                                '(`id`, `credentialsid`, ' +
                                '`projectid`, `userid`, `classid`, ' +
                                '`servicetype`, ' +
                                '`classifierid`, `url`, `name`, `language`, ' +
                                '`created`, `expiry`) ' +
                                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const values = [obj.id, obj.credentialsid,
        obj.projectid, obj.userid, obj.classid,
        obj.servicetype,
        obj.classifierid, obj.url, obj.name, obj.language,
        obj.created, obj.expiry];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store workspace info');
        throw new Error('Failed to store workspace');
    }

    return workspace;
}


export async function updateConversationWorkspaceExpiry(
    workspace: TrainingObjects.ConversationWorkspace,
): Promise<void>
{
    const queryString: string = 'UPDATE `bluemixclassifiers` ' +
                                'SET `expiry` = ? ' +
                                'WHERE `id` = ? ' +
                                'ORDER BY `expiry`';
    const values = [ workspace.expiry, workspace.id ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ queryString, values, response }, 'Failed to update expiry date');
        throw new Error('Conversation Workspace expiry not updated');
    }
}

export async function getExpiredConversationWorkspaces(): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `language`, `created`, `expiry` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `expiry` < ? AND `servicetype` = ?';

    const rows = await dbExecute(queryString, [ new Date(), 'conv' ]);
    return rows.map(dbobjects.getWorkspaceFromDbRow);
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



export async function deleteConversationWorkspace(id: string): Promise<void>
{
    const queryString = 'DELETE FROM `bluemixclassifiers` WHERE `id` = ? AND `servicetype` = ?';

    const response = await dbExecute(queryString, [ id, 'conv' ]);
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



export async function storeImageClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    project: Objects.Project,
    classifier: TrainingObjects.VisualClassifier,
): Promise<TrainingObjects.VisualClassifier>
{
    const obj = dbobjects.createVisualClassifier(classifier, credentials, project);

    const queryString: string = 'INSERT INTO `bluemixclassifiers` ' +
                                '(`id`, `credentialsid`, ' +
                                '`projectid`, `userid`, `classid`, ' +
                                '`servicetype`, ' +
                                '`classifierid`, `url`, `name`, `language`, ' +
                                '`created`, `expiry`) ' +
                                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const values = [obj.id, obj.credentialsid,
        obj.projectid, obj.userid, obj.classid,
        obj.servicetype,
        obj.classifierid, obj.url, obj.name, obj.language,
        obj.created, obj.expiry];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store classifier info');
        throw new Error('Failed to store classifier');
    }

    return classifier;
}


export async function getImageClassifiers(
    projectid: string,
): Promise<TrainingObjects.VisualClassifier[]>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `created`, `expiry` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ?';

    const rows = await dbExecute(queryString, [ projectid ]);
    return rows.map(dbobjects.getVisualClassifierFromDbRow);
}

export async function getImageClassifier(
    projectid: string, classifierid: string,
): Promise<TrainingObjects.VisualClassifier>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `created`, `expiry` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ? AND `classifierid` = ?';

    const rows = await dbExecute(queryString, [ projectid, classifierid ]);
    if (rows.length !== 1) {
        log.error({ rows, func : 'getImageClassifier' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service details');
    }
    return dbobjects.getVisualClassifierFromDbRow(rows[0]);
}


export async function deleteImageClassifier(id: string): Promise<void> {

    const queryString = 'DELETE FROM `bluemixclassifiers` WHERE `id` = ? AND `servicetype` = ?';

    const response = await dbExecute(queryString, [ id, 'visrec' ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete classifiers info');
    }
}

export async function getExpiredImageClassifiers(): Promise<TrainingObjects.VisualClassifier[]>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `language`, `created`, `expiry` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `expiry` < ? AND `servicetype` = ?';

    const rows = await dbExecute(queryString, [ new Date(), 'visrec' ]);
    return rows.map(dbobjects.getVisualClassifierFromDbRow);
}


// -----------------------------------------------------------------------------
//
// SCRATCH KEYS
//
// -----------------------------------------------------------------------------

export async function storeUntrainedScratchKey(project: Objects.Project): Promise<string>
{
    const obj = dbobjects.createUntrainedScratchKey(project.name, project.type, project.id);

    const queryString = 'INSERT INTO `scratchkeys` ' +
                        '(`id`, ' +
                        '`projectid`, `projectname`, `projecttype`, ' +
                        '`userid`, `classid`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?)';

    const values = [
        obj.id,
        project.id, obj.name, obj.type,
        project.userid, project.classid,
    ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store Scratch key');
        throw new Error('Failed to store Scratch key');
    }

    return obj.id;
}



export function resetExpiredScratchKey(id: string, projecttype: Objects.ProjectTypeLabel): Promise<void>
{
    const queryString = 'UPDATE `scratchkeys` ' +
                        'SET `classifierid` = ? , ' +
                            '`serviceurl` = ? , `serviceusername` = ? , `servicepassword` = ? ' +
                        'WHERE `classifierid` = ? AND `projecttype` = ?';
    const values = [
        null, null, null, null,
        id, projecttype,
    ];

    return dbExecute(queryString, values);
}



/**
 * @returns the ScratchKey ID - whether created or updated
 */
export async function storeOrUpdateScratchKey(
    project: Objects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string,
): Promise<string>
{
    const existing: Objects.ScratchKey[] = await findScratchKeys(project.userid, project.id, project.classid);
    if (existing.length > 0) {
        return updateScratchKey(
            existing[0].id,
            project.userid, project.id, project.classid,
            credentials,
            classifierid,
        );
    }
    else {
        return storeScratchKey(project, credentials, classifierid);
    }
}






/**
 * @returns the created scratchkey ID
 */
export async function storeScratchKey(
    project: Objects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string,
): Promise<string>
{
    const obj = dbobjects.createScratchKey(credentials, project.name, project.type, project.id, classifierid);

    const queryString = 'INSERT INTO `scratchkeys` ' +
                        '(`id`, `projectname`, `projecttype`, ' +
                        '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                        '`classifierid`, ' +
                        '`projectid`, `userid`, `classid`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [
        obj.id, project.name, project.type,
        obj.credentials.url, obj.credentials.username, obj.credentials.password,
        obj.classifierid,
        obj.projectid, project.userid, project.classid,
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
                            '`id`, `classid`, ' +
                            '`projectid`, `projectname`, `projecttype`, ' +
                            '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                            '`classifierid` ' +
                        'FROM `scratchkeys` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ key ]);
    if (rows.length !== 1) {
        log.error({ rows, func : 'getScratchKey' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving credentials for Scratch');
    }
    return dbobjects.getScratchKeyFromDbRow(rows[0]);
}



export async function findScratchKeys(
    userid: string, projectid: string, classid: string,
): Promise<Objects.ScratchKey[]>
{
    const queryString = 'SELECT ' +
                            '`id`, `classid`, `projectid`, `projectname`, `projecttype`, ' +
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

// export async function storeClassTenant(classid: string): Promise<Objects.ClassTenant>
// {
//     const obj = dbobjects.createClassTenant(classid);

//     const queryString = 'INSERT INTO `tenants` ' +
//                         '(`id`, `projecttypes`, `ismanaged`, ' +
//                          '`maxusers`, `maxprojectsperuser`, ' +
//                          '`textclassifiersexpiry`, `imageclassifiersexpiry`) ' +
//                         'VALUES (?, ?, ?, ?, ?, ?, ?)';

//     const values = [
//         obj.id, obj.projecttypes, obj.ismanaged,
//         obj.maxusers, obj.maxprojectsperuser,
//         obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
//     ];

//     const response = await dbExecute()
// }


export async function getClassTenant(classid: string): Promise<Objects.ClassTenant> {
    const queryString = 'SELECT `id`, `projecttypes`, `maxusers`, ' +
                               '`maxprojectsperuser`, ' +
                               '`textclassifiersexpiry`, `imageclassifiersexpiry`, ' +
                               '`ismanaged` ' +
                        'FROM `tenants` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ classid ]);
    if (rows.length !== 1) {
        log.debug({ rows, func : 'getClassTenant' }, 'Unexpected response from DB');

        return {
            id : classid,
            supportedProjectTypes : [ 'text', 'images', 'numbers' ],
            isManaged : false,
            maxUsers : 15,
            maxProjectsPerUser : 2,
            textClassifierExpiry : 24,
            imageClassifierExpiry : 24,
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
    switch (project.type) {
    case 'text': {
        const classifiers = await getConversationWorkspaces(project.id);
        for (const classifier of classifiers) {
            await conversation.deleteClassifier(classifier);
        }
        break;
    }
    case 'images': {
        const classifiers = await getImageClassifiers(project.id);
        for (const classifier of classifiers) {
            await visualrec.deleteClassifier(classifier);
        }
        break;
    }
    case 'numbers':
        await numbers.deleteClassifier(userid, classid, project.id);
        break;
    }

    const deleteQueries = [
        'DELETE FROM `projects` WHERE `id` = ?',
        'DELETE FROM `numbersprojectsfields` WHERE `projectid` = ?',
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

