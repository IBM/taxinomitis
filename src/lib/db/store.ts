// external dependencies
import * as mysql from 'mysql2/promise';
// local dependencies
import * as mysqldb from './mysqldb';
import * as dbobjects from './objects';
import * as projectObjects from './projects';
import * as Objects from './db-types';
import * as numbers from '../training/numbers';
import * as conversation from '../training/conversation';
import * as visualrec from '../training/visualrecognition';
import * as TrainingObjects from '../training/training-types';
import * as limits from './limits';
import loggerSetup from '../utils/logger';

const log = loggerSetup();

let dbConnPool: mysql.ConnectionPool;

export async function init() {
    if (!dbConnPool) {
        dbConnPool = await mysqldb.connect();
    }
}

export async function disconnect() {
    if (dbConnPool) {
        await mysqldb.disconnect();
        // @ts-ignore
        dbConnPool = undefined;
    }
}

export function replaceDbConnPoolForTest(testDbConnPool: mysql.ConnectionPool) {
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


async function handleDbException(err: NodeJS.ErrnoException) {
    if (err.code === 'ER_OPTION_PREVENTS_STATEMENT' &&  err.errno === 1290)
    {
        // for this error, it is worth trying to reconnect to the DB
        await restartConnection();
    }
}


async function dbExecute(query: string, params: any[]) {
    const dbConn = await dbConnPool.getConnection();
    try {
        const [response] = await dbConn.execute(query, params);
        return response;
    }
    catch (err) {
        log.error({ query, params : params.join(','), err }, 'DB error');
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
    userid: string, classid: string,
    type: Objects.ProjectTypeLabel,
    name: string,
    language: Objects.TextProjectLanguage,
    fields: Objects.NumbersProjectFieldSummary[],
    crowdsource: boolean,
): Promise<Objects.Project>
{
    let obj: Objects.ProjectDbRow;
    try {
        obj = dbobjects.createProject(userid, classid, type, name, language, fields, crowdsource);
    }
    catch (err) {
        err.statusCode = 400;
        throw err;
    }

    const insertProjectQry: string = 'INSERT INTO `projects` ' +
        '(`id`, `userid`, `classid`, `typeid`, `name`, `language`, `labels`, `numfields`, `iscrowdsourced`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const insertProjectValues = [
        obj.id,
        obj.userid, obj.classid,
        obj.typeid,
        obj.name, obj.language, obj.labels,
        obj.fields.length,
        obj.iscrowdsourced,
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
        if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
            err.statusCode = 400;
            err.message = 'Sorry, some of those letters can\'t be used in project names';
            throw err;
        }

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
    if (rows.length === 1) {
        return dbobjects.getLabelsFromList(rows[0].labels);
    }
    else if (rows.length === 0) {
        log.warn({ projectid, classid, func : 'getCurrentLabels' }, 'Project not found in request for labels');
    }
    else {
        log.error({ projectid, classid, rows, func : 'getCurrentLabels' }, 'Unexpected number of project rows');
    }
    throw new Error('Project not found');
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
    if (!project) {
        throw new Error('Project not found');
    }

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


export async function getProject(id: string): Promise<Objects.Project | undefined> {
    const queryString = 'SELECT `id`, `userid`, `classid`, ' +
                            '`typeid`, `name`, `language`, ' +
                            '`labels`, `numfields`, ' +
                            '`iscrowdsourced` ' +
                        'FROM `projects` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ id ]);
    if (rows.length === 1) {
        return dbobjects.getProjectFromDbRow(rows[0]);
    }
    else if (rows.length === 0) {
        log.warn({ id, func : 'getProject' }, 'Project not found');
    }
    else {
        log.error({ rows, id, func : 'getProject' }, 'Project not found');
    }
    return;
}


/**
 * Fetches projects that the specified user is entitled to access.
 *
 * This list should include:
 *  Any projects created by the specified user
 *  Any crowd-sourced projects owned by the user the class is in.
 */
export async function getProjectsByUserId(userid: string, classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT `id`, `userid`, `classid`, ' +
                            '`typeid`, `name`, `language`, ' +
                            '`labels`, ' +
                            '`iscrowdsourced` ' +
                        'FROM `projects` ' +
                        'WHERE `classid` = ? AND (`userid` = ? OR `iscrowdsourced` = True)';

    const rows = await dbExecute(queryString, [ classid, userid ]);
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function countProjectsByUserId(userid: string, classid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM `projects` ' +
                        'WHERE `userid` = ? AND `classid` = ?';

    const rows = await dbExecute(queryString, [ userid, classid ]);
    if (rows.length !== 1) {
        return 0;
    }

    return rows[0].count;
}


export async function getProjectsByClassId(classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels`, `language`, `iscrowdsourced` ' +
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
    case 'sounds':
        return 'soundtraining';
    }
}


export async function countTraining(type: Objects.ProjectTypeLabel, projectid: string): Promise<number> {
    const dbTable = getDbTable(type);
    const queryString = 'SELECT COUNT(*) AS `trainingcount` FROM `' + dbTable + '` WHERE `projectid` = ?';
    const response = await dbExecute(queryString, [projectid]);
    return response[0].trainingcount;
}


export async function countTrainingByLabel(project: Objects.Project)
    : Promise<{ [label: string]: number }>
{
    const dbTable = getDbTable(project.type);

    const queryString = 'SELECT `label`, COUNT(*) AS `trainingcount` FROM `' + dbTable + '` ' +
                        'WHERE `projectid` = ? ' +
                        'GROUP BY `label`';
    const response = await dbExecute(queryString, [project.id]);
    const counts: { [label: string]: number } = {};
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
                log.error({ projectid, data, label, insertQry, insertValues, insertResponse }, 'INSERT text failure');
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

    const queryParams = [ projectid, label, options.limit, options.start ];

    const rows: Array<{ textdata: string }> = await dbExecute(queryString, queryParams);
    return rows.map((row) => row.textdata);
}


export async function storeImageTraining(
    projectid: string, imageurl: string, label: string, stored: boolean, imageid?: string,
): Promise<Objects.ImageTraining>
{
    let outcome: InsertTrainingOutcome;

    // prepare the data that we want to store
    const obj = dbobjects.createImageTraining(projectid, imageurl, label, stored, imageid);


    //
    // prepare the queries so we have everything ready before we
    //  get a DB connection from the pool
    //

    const countQry = 'SELECT COUNT(*) AS `trainingcount` FROM `imagetraining` WHERE `projectid` = ?';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO `imagetraining` ' +
                        '(`id`, `projectid`, `imageurl`, `label`, `isstored`) ' +
                        'VALUES (?, ?, ?, ?, ?)';
    const insertValues = [ obj.id, obj.projectid, obj.imageurl, obj.label, obj.isstored ];


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


export async function bulkStoreImageTraining(
    projectid: string, training: Array<{imageurl: string, label: string}>,
): Promise<void>
{
    const objects = training.map((item) => {
        const obj = dbobjects.createImageTraining(projectid, item.imageurl, item.label, false);
        return [ obj.id, obj.projectid, obj.imageurl, obj.label, obj.isstored ];
    });

    const queryString = 'INSERT INTO `imagetraining` (`id`, `projectid`, `imageurl`, `label`, `isstored`) VALUES ?';

    const dbConn = await dbConnPool.getConnection();
    const [response] = await dbConn.query(queryString, [ objects ]);
    await dbConn.release();

    if (response.affectedRows === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}


export async function getImageTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT `id`, `imageurl`, `label`, `isstored` FROM `imagetraining` ' +
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
    const queryString = 'SELECT `id`, `imageurl`, `label`, `isstored` FROM `imagetraining` ' +
                        'WHERE `projectid` = ? AND `label` = ? ' +
                        'LIMIT ? OFFSET ?';

    const rows = await dbExecute(queryString, [ projectid, label, options.limit, options.start ]);
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function getStoredImageTraining(projectid: string, label: string): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT `id`, `imageurl`, `label`, `isstored` FROM `imagetraining` ' +
                        'WHERE `projectid` = ? AND `label` = ? AND `isstored` = 1 ' +
                        'LIMIT 1000';

    const rows = await dbExecute(queryString, [ projectid, label ]);
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function isImageStored(imageid: string): Promise<boolean> {
    const queryString = 'SELECT `isstored` FROM `imagetraining` WHERE `id` = ?';
    const values = [ imageid ];
    const rows = await dbExecute(queryString, values);
    if (rows.length > 0) {
        return rows[0].isstored === 1;
    }
    return false;
}




enum InsertTrainingOutcome {
    StoredOk,
    NotStored_MetLimit,
    NotStored_UnknownFailure,
}


export async function storeNumberTraining(
    projectid: string, isClassProject: boolean, data: number[], label: string,
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

        // how much training data are they allowed to have
        const classLimits = limits.getStoreLimits();
        const limit = isClassProject ? classLimits.numberTrainingItemsPerClassProject :
                                       classLimits.numberTrainingItemsPerProject;

        if (count >= limit) {
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






export async function storeSoundTraining(
    projectid: string, audiourl: string, label: string, audioid: string,
): Promise<Objects.SoundTraining>
{
    let outcome: InsertTrainingOutcome;

    // prepare the data to be stored
    const obj = dbobjects.createSoundTraining(projectid, audiourl, label, audioid);

    // prepare the DB queries
    const countQry = 'SELECT COUNT(*) AS `trainingcount` from `soundtraining` WHERE `projectid` = ?';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO `soundtraining` (`id`, `projectid`, `audiourl`, `label`) VALUES (?, ?, ?, ?)';
    const insertValues = [ obj.id, obj.projectid, obj.audiourl, obj.label ];

    // connect to the DB
    const dbConn = await dbConnPool.getConnection();

    // store the data unless the project is already full
    try {
        // count the number of training items already in the project
        const [countResponse] = await dbConn.execute(countQry, countValues);
        const count = countResponse[0].trainingcount;

        if (count >= limits.getStoreLimits().soundTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't reached their limit yet - okay to INSERT
            const [insertResponse] = await dbConn.execute(insertQry, insertValues);
            if (insertResponse.affectedRows === 1) {
                outcome = InsertTrainingOutcome.StoredOk;
            }
            else {
                // insert failed for an unknown reason
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


    // prepare the response

    switch (outcome) {
    case InsertTrainingOutcome.StoredOk:
        return obj;
    case InsertTrainingOutcome.NotStored_MetLimit:
        throw new Error('Project already has maximum allowed amount of training data');
    case InsertTrainingOutcome.NotStored_UnknownFailure:
        throw new Error('Failed to store training data');
    }
}


export async function getSoundTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.SoundTraining[]>
{
    const queryString = 'SELECT `id`, `audiourl`, `label` FROM `soundtraining` ' +
                        'WHERE `projectid` = ? ' +
                        'ORDER BY `label`, `id` ' +
                        'LIMIT ? OFFSET ?';

    const rows = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    return rows.map(dbobjects.getSoundTrainingFromDbRow);
}





// -----------------------------------------------------------------------------
//
// BLUEMIX CREDENTIALS
//
// -----------------------------------------------------------------------------

export async function storeBluemixCredentials(
    classid: string, credentials: TrainingObjects.BluemixCredentialsDbRow,
): Promise<TrainingObjects.BluemixCredentials>
{
    const queryString = 'INSERT INTO `bluemixcredentials` ' +
                        '(`id`, `classid`, `servicetype`, `url`, `username`, `password`, `credstypeid`, `notes`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    const values = [ credentials.id, classid,
        credentials.servicetype, credentials.url, credentials.username, credentials.password,
        credentials.credstypeid,
        credentials.notes ? credentials.notes : null ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows === 1) {
        return dbobjects.getCredentialsFromDbRow(credentials);
    }
    throw new Error('Failed to store credentials');
}


export async function setBluemixCredentialsType(
    classid: string, credentialsid: string,
    servicetype: TrainingObjects.BluemixServiceType,
    credstype: TrainingObjects.BluemixCredentialsTypeLabel,
): Promise<void>
{
    const credstypeObj = projectObjects.credsTypesByLabel[credstype];
    if (!credstypeObj) {
        throw new Error('Unrecognised credentials type');
    }

    const queryString = 'UPDATE `bluemixcredentials` ' +
                        'SET `credstypeid` = ? ' +
                        'WHERE `id` = ? AND `servicetype` = ? AND `classid` = ?';
    const queryParameters = [ credstypeObj.id, credentialsid, servicetype, classid ];

    const response = await dbExecute(queryString, queryParameters);
    if (response.affectedRows !== 1) {
        log.error({ queryString, queryParameters, response }, 'Failed to update credentials');
        throw new Error('Bluemix credentials not updated');
    }
}


export async function getAllBluemixCredentials(
    service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password`, `credstypeid` ' +
                        'FROM `bluemixcredentials` ' +
                        'WHERE `servicetype` = ? ' +
                        'LIMIT 2000';

    const rows = await dbExecute(queryString, [ service ]);
    return rows.map(dbobjects.getCredentialsFromDbRow);
}



export async function getBluemixCredentials(
    classid: string, service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password`, `credstypeid` ' +
                        'FROM `bluemixcredentials` ' +
                        'WHERE `classid` = ? AND `servicetype` = ?';

    const rows = await dbExecute(queryString, [ classid, service ]);
    if (rows.length === 0) {
        log.warn({ rows, func : 'getBluemixCredentials' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return rows.map(dbobjects.getCredentialsFromDbRow);
}


export async function getBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    const credsQuery = 'SELECT `id`, `classid`, `servicetype`, `url`, `username`, `password`, `credstypeid` ' +
                       'FROM `bluemixcredentials` ' +
                       'WHERE `id` = ?';
    const rows = await dbExecute(credsQuery, [ credentialsid ]);

    if (rows.length === 1) {
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }
    else if (rows.length === 0) {
        log.warn({
            credentialsid, credsQuery, rows,
            func : 'getBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        log.error({
            credentialsid, credsQuery, rows,
            func : 'getBluemixCredentialsById',
        }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving the service credentials');
}



export async function countBluemixCredentialsByType(classid: string): Promise<{ conv: number, visrec: number }>
{
    const credsQuery = 'SELECT `servicetype`, `credstypeid`, count(*) as count ' +
                       'FROM `bluemixcredentials` ' +
                       'WHERE `classid` = ? ' +
                       'GROUP BY `servicetype`, `credstypeid`';
    const rows = await dbExecute(credsQuery, [ classid ]);

    const counts = { conv : 0, visrec : 0 };
    for (const row of rows) {
        if (row.servicetype === 'conv') {
            if (row.credstypeid === projectObjects.credsTypesByLabel.conv_standard.id) {
                counts.conv += (20 * row.count);
            }
            else {
                counts.conv += (5 * row.count);
            }
        }
        else if (row.servicetype === 'visrec') {
            counts.visrec += (2 * row.count);
        }
        else {
            log.error({ row, classid }, 'Unexpected bluemix service type found in DB');
        }
    }

    return counts;
}


export async function countGlobalBluemixCredentials():
    Promise<{ [classid: string]: { conv: number, visrec: number, total: number } }>
{
    const credsQuery = 'SELECT `classid`, ' +
                           'sum(case when servicetype = "conv" then 1 else 0 end) conv, ' +
                           'sum(case when servicetype = "visrec" then 1 else 0 end) visrec ' +
                       'FROM `bluemixcredentials` ' +
                       'GROUP BY `classid`';
    const rows = await dbExecute(credsQuery, []);

    const counts: { [classid: string]: { conv: number, visrec: number, total: number } } = {};
    for (const row of rows) {
        const conv = parseInt(row.conv, 10);
        const visrec = parseInt(row.visrec, 10);
        const total = conv + visrec;
        counts[row.classid] = { conv, visrec, total };
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


export async function deleteClassifiersByCredentials(credentials: TrainingObjects.BluemixCredentials): Promise<void> {
    const queryString = 'DELETE FROM `bluemixclassifiers` WHERE `credentialsid` = ?';

    const response = await dbExecute(queryString, [ credentials.id ]);
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
    if (rows.length === 1) {
        return dbobjects.getWorkspaceFromDbRow(rows[0]);
    }
    else if (rows.length > 1) {
        log.error({ projectid, classifierid, rows, func : 'getConversationWorkspace' }, 'Unexpected response from DB');
    }
    else {
        log.warn({ projectid, classifierid, func : 'getConversationWorkspace' }, 'Conversation workspace not found');
    }
    throw new Error('Unexpected response when retrieving conversation workspace details');
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
                                'SET `created` = ?, `expiry` = ? ' +
                                'WHERE `id` = ?';
    const values = [ workspace.created, workspace.expiry, workspace.id ];

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
    if (rows.length === 1) {
        return dbobjects.getVisualClassifierFromDbRow(rows[0]);
    }
    if (rows.length > 1) {
        log.error({ rows, func : 'getImageClassifier' }, 'Unexpected response from DB');
    }
    else {
        log.warn({ projectid, classifierid, func : 'getImageClassifier' }, 'Image classifier not found');
    }
    throw new Error('Unexpected response when retrieving image classifier details');
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



export async function getProjectsWithBluemixClassifiers(classid: string): Promise<{[projectid: string]: string}> {
    const queryString = 'SELECT `projectid`, `classifierid` FROM `bluemixclassifiers` WHERE `classid` = ?';

    const projects: {[projectid: string]: string} = {};

    const rows = await dbExecute(queryString, [ classid ]);
    rows.forEach((row: any) => {
        projects[row.projectid] = row.classifierid;
    });

    return projects;
}




export async function getClassifierByBluemixId(classifierid: string):
    Promise<TrainingObjects.VisualClassifier|TrainingObjects.ConversationWorkspace|undefined>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                            ' `classifierid`, `url`, `name`, `language`, `created`, `expiry` ' +
                            'FROM `bluemixclassifiers` ' +
                            'WHERE `classifierid` = CONVERT(? USING latin1)';

    const rows = await dbExecute(queryString, [ classifierid ]);
    if (rows.length === 0) {
        return;
    }
    else if (rows.length === 1) {
        const classifierType: TrainingObjects.BluemixServiceType = rows[0].servicetype;
        switch (classifierType) {
        case 'conv':
            return dbobjects.getWorkspaceFromDbRow(rows[0]);
        case 'visrec':
            return dbobjects.getVisualClassifierFromDbRow(rows[0]);
        default:
            log.error({ rows, func : 'getClassifierByBluemixId' }, 'Unexpected response from DB');
            throw new Error('Unspected response when retrieving Bluemix classifier details');
        }
    }
    else {
        log.error({ rows, func : 'getClassifierByBluemixId' }, 'Unexpected response from DB');
        throw new Error('Unspected response when retrieving Bluemix classifier details');
    }
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
                        '`userid`, `classid`, `updated`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?)';

    const values = [
        obj.id,
        project.id, obj.name, obj.type,
        project.userid, project.classid, obj.updated,
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
                            '`serviceurl` = ? , `serviceusername` = ? , `servicepassword` = ?, ' +
                            '`updated` = ? ' +
                        'WHERE `classifierid` = ? AND `projecttype` = ?';
    const values = [
        null, null, null, null,
        new Date(),
        id, projecttype,
    ];

    return dbExecute(queryString, values);
}


export function removeCredentialsFromScratchKeys(credentials: TrainingObjects.BluemixCredentials): Promise<void>
{
    const queryString = 'UPDATE `scratchkeys` ' +
                        'SET `classifierid` = ? , ' +
                            '`serviceurl` = ? , `serviceusername` = ? , `servicepassword` = ?, ' +
                            '`updated` = ? ' +
                        'WHERE `serviceusername` = ? AND `servicepassword` = ? AND `classid` = ?';
    const values = [
        null, null, null, null,
        new Date(),
        credentials.username, credentials.password, credentials.classid,
    ];

    return dbExecute(queryString, values);
}



/**
 * @returns the ScratchKey ID - whether created or updated
 */
export async function storeOrUpdateScratchKey(
    project: Objects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string, timestamp: Date,
): Promise<string>
{
    const existing: Objects.ScratchKey[] = await findScratchKeys(project.userid, project.id, project.classid);
    if (existing.length > 0) {
        return updateScratchKey(
            existing[0].id,
            project.userid, project.id, project.classid,
            credentials,
            classifierid, timestamp,
        );
    }
    else {
        return storeScratchKey(project, credentials, classifierid, timestamp);
    }
}




/**
 * @returns the created scratchkey ID
 */
export async function storeScratchKey(
    project: Objects.Project,
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string, timestamp: Date,
): Promise<string>
{
    const obj = dbobjects.createScratchKey(
        credentials,
        project.name, project.type, project.id,
        classifierid, timestamp);

    const queryString = 'INSERT INTO `scratchkeys` ' +
                        '(`id`, `projectname`, `projecttype`, ' +
                        '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                        '`classifierid`, ' +
                        '`projectid`, `userid`, `classid`, `updated`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [
        obj.id, project.name, project.type,
        obj.credentials ? obj.credentials.url : undefined,
        obj.credentials ? obj.credentials.username : undefined,
        obj.credentials ? obj.credentials.password : undefined,
        obj.classifierid,
        obj.projectid, project.userid, project.classid,
        obj.updated,
    ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response, queryString, values }, 'Failed to store Scratch key');
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
    credentials: TrainingObjects.BluemixCredentials,
    classifierid: string, timestamp: Date,
): Promise<string>
{
    const queryString = 'UPDATE `scratchkeys` ' +
                        'SET `classifierid` = ? , ' +
                            '`updated` = ?, ' +
                            '`serviceurl` = ? , `serviceusername` = ? , `servicepassword` = ? ' +
                        'WHERE `id` = ? AND ' +
                            '`userid` = ? AND `projectid` = ? AND `classid` = ?';
    const values = [
        classifierid,
        timestamp,
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




export async function updateScratchKeyTimestamp(
    project: Objects.Project,
    timestamp: Date,
): Promise<void>
{
    const queryString = 'UPDATE `scratchkeys` ' +
                        'SET `updated` = ? ' +
                        'WHERE `userid` = ? AND `projectid` = ? AND `classid` = ?';
    const values = [
        timestamp,
        project.userid, project.id, project.classid,
    ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ queryString, values, response }, 'Failed to update scratchkey timestamp');
        throw new Error('Scratch key timestamp not updated');
    }
}




export async function getScratchKey(key: string): Promise<Objects.ScratchKey> {
    const queryString = 'SELECT ' +
                            '`id`, `classid`, ' +
                            '`projectid`, `projectname`, `projecttype`, ' +
                            '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                            '`classifierid`, `updated` ' +
                        'FROM `scratchkeys` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ key ]);
    if (rows.length === 1) {
        return dbobjects.getScratchKeyFromDbRow(rows[0]);
    }

    if (rows.length === 0) {
        log.warn({ key, func : 'getScratchKey' }, 'Scratch key not found');
    }
    else if (rows.length > 1) {
        log.error({ rows, key, func : 'getScratchKey' }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving credentials for Scratch');
}



export async function findScratchKeys(
    userid: string, projectid: string, classid: string,
): Promise<Objects.ScratchKey[]>
{
    const queryString = 'SELECT ' +
                            '`id`, `classid`, `projectid`, `projectname`, `projecttype`, ' +
                            '`serviceurl`, `serviceusername`, `servicepassword`, ' +
                            '`classifierid`, `updated` ' +
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
// KNOWN SYSTEM ERRORS
//
// -----------------------------------------------------------------------------

export async function getAllKnownErrors(): Promise<TrainingObjects.KnownError[]> {
    const queryString = 'SELECT * FROM `knownsyserrors`';
    const rows = await dbExecute(queryString, []);
    return rows.map(dbobjects.getKnownErrorFromDbRow);
}

export async function storeNewKnownError(
    type: TrainingObjects.KnownErrorCondition,
    service: TrainingObjects.BluemixServiceType,
    objectid: string,
): Promise<TrainingObjects.KnownError>
{
    const knownError = dbobjects.createKnownError(type, service, objectid);

    const queryString = 'INSERT INTO `knownsyserrors` ' +
        '(`id`, `type`, `servicetype`, `objid`) ' +
        'VALUES (?, ?, ?, ?)';

    const values = [ knownError.id, knownError.type, knownError.servicetype, knownError.objid ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response, values, knownError }, 'Failed to store known error');
        throw new Error('Failed to store known error');
    }

    return knownError;
}


// only used for unit tests
export function deleteAllKnownErrors(): Promise<void>
{
    return dbExecute('DELETE FROM `knownsyserrors`', []);
}



// -----------------------------------------------------------------------------
//
// PENDING JOBS
//
// -----------------------------------------------------------------------------

export function deleteAllPendingJobs(): Promise<void>
{
    return dbExecute('DELETE FROM `pendingjobs`', []);
}

async function storePendingJob(job: Objects.PendingJob): Promise<Objects.PendingJob>
{
    const queryString = 'INSERT INTO `pendingjobs` ' +
        '(`id`, `jobtype`, `jobdata`, `attempts`) ' +
        'VALUES (?, ?, ?, ?)';

    const values = [
        job.id,
        job.jobtype,
        JSON.stringify(job.jobdata),
        job.attempts,
    ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response, job }, 'Failed to store pending job');
        throw new Error('Failed to store pending job');
    }

    return job;
}

export function storeDeleteObjectJob(
    classid: string, userid: string, projectid: string,
    objectid: string,
): Promise<Objects.PendingJob>
{
    const obj = dbobjects.createDeleteObjectStoreJob({ classid, userid, projectid, objectid });
    return storePendingJob(obj);
}

export function storeDeleteProjectObjectsJob(
    classid: string, userid: string, projectid: string,
): Promise<Objects.PendingJob>
{
    const obj = dbobjects.createDeleteProjectObjectsJob({ classid, userid, projectid });
    return storePendingJob(obj);
}

export function storeDeleteUserObjectsJob(
    classid: string, userid: string,
): Promise<Objects.PendingJob>
{
    const obj = dbobjects.createDeleteUserObjectsJob({ classid, userid });
    return storePendingJob(obj);
}

export function storeDeleteClassObjectsJob(classid: string): Promise<Objects.PendingJob>
{
    const obj = dbobjects.createDeleteClassObjectsJob({ classid });
    return storePendingJob(obj);
}


export async function recordUnsuccessfulPendingJobExecution(job: Objects.PendingJob): Promise<Objects.PendingJob>
{
    const attempts = job.attempts + 1;
    const lastattempt = new Date();

    const queryString = 'UPDATE `pendingjobs` ' +
                            'SET `attempts` = ?, `lastattempt` = ? ' +
                            'WHERE `id` = ?';
    const values = [ attempts, lastattempt, job.id ];

    const response = await dbExecute(queryString,  values);
    if (response.affectedRows !== 1) {
        log.error({ queryString, values, job }, 'Failed to update pending job');
        throw new Error('Pending job not updated');
    }

    return {
        id: job.id,
        jobtype: job.jobtype,
        jobdata: job.jobdata,
        attempts,
        lastattempt,
    };
}

export async function deletePendingJob(job: Objects.PendingJob): Promise<void>
{
    const queryString = 'DELETE from `pendingjobs` where `id` = ?';
    const values = [ job.id ];

    const response = await dbExecute(queryString, values);
    if (response.warningStatus !== 0) {
        log.error({ job, response, values }, 'Failed to delete pending job');
        throw new Error('Failed to delete pending job');
    }
}

export async function getNextPendingJob(): Promise<Objects.PendingJob | undefined>
{
    const queryString = 'SELECT * from `pendingjobs` ORDER BY `id` LIMIT 1';
    const rows = await dbExecute(queryString, []);

    if (rows.length === 0) {
        // no more jobs to do - yay
        return undefined;
    }
    else if (rows.length === 1) {
        // found a job to do - that's okay
        return dbobjects.getPendingJobFromDbRow(rows[0]);
    }
    else {
        // should never get here.... because the SQL says LIMIT 1!
        log.error({ rows, func : 'getNextPendingJob' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving pending job from DB');
    }
}


// -----------------------------------------------------------------------------
//
// TENANT INFO
//
// -----------------------------------------------------------------------------


export async function storeManagedClassTenant(classid: string, numstudents: number): Promise<Objects.ClassTenant>
{
    const obj = dbobjects.createClassTenant(classid);
    const IS_MANAGED = true;
    const NUM_USERS = numstudents + 1;

    const queryString = 'INSERT INTO `tenants` ' +
                        '(`id`, `projecttypes`, `ismanaged`, ' +
                        '`maxusers`, `maxprojectsperuser`, ' +
                        '`textclassifiersexpiry`, `imageclassifiersexpiry`) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?)';

    const values = [
        obj.id, obj.projecttypes,
        IS_MANAGED, NUM_USERS,
        obj.maxprojectsperuser,
        obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
    ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response, values }, 'Failed to store managed tenant');
        throw new Error('Failed to store managed tenant');
    }
    const created = {
        id : obj.id,
        supportedProjectTypes : obj.projecttypes.split(',') as Objects.ProjectTypeLabel[],
        isManaged : IS_MANAGED,
        maxUsers : NUM_USERS,
        maxProjectsPerUser : obj.maxprojectsperuser,
        textClassifierExpiry : obj.textclassifiersexpiry,
        imageClassifierExpiry : obj.imageclassifiersexpiry,
    };
    return created;
}


export async function getClassTenant(classid: string): Promise<Objects.ClassTenant> {
    const queryString = 'SELECT `id`, `projecttypes`, `maxusers`, ' +
                               '`maxprojectsperuser`, ' +
                               '`textclassifiersexpiry`, `imageclassifiersexpiry`, ' +
                               '`ismanaged` ' +
                        'FROM `tenants` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ classid ]);
    if (rows.length === 0) {
        log.debug({ rows, func : 'getClassTenant' }, 'Empty response from DB');
        return dbobjects.getDefaultClassTenant(classid);
    }
    else if (rows.length > 1) {
        log.error({ rows, func : 'getClassTenant' }, 'Unexpected response from DB');
        return dbobjects.getDefaultClassTenant(classid);
    }
    else {
        return dbobjects.getClassFromDbRow(rows[0]);
    }
}


export async function modifyClassTenantExpiries(
    classid: string,
    textexpiry: number, imageexpiry: number,
): Promise<Objects.ClassTenant>
{
    const tenantinfo = await getClassTenant(classid);

    const modified = dbobjects.setClassTenantExpiries(tenantinfo, textexpiry, imageexpiry);
    const obj = dbobjects.getClassDbRow(modified);

    const queryString = 'INSERT INTO `tenants` ' +
                            '(`id`, `projecttypes`, ' +
                                '`maxusers`, `maxprojectsperuser`, ' +
                                '`textclassifiersexpiry`, `imageclassifiersexpiry`, ' +
                                '`ismanaged`) ' +
                            'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
                            'ON DUPLICATE KEY UPDATE `textclassifiersexpiry` = ?, ' +
                                                    '`imageclassifiersexpiry` = ?';

    const values = [
        obj.id, obj.projecttypes,
        obj.maxusers, obj.maxprojectsperuser,
        obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
        obj.ismanaged,
        //
        obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
    ];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1 &&  // row inserted
        response.affectedRows !== 2)    // row updated
    {
        log.error({ response, values }, 'Failed to update tenant info');
        throw new Error('Failed to update tenant info');
    }

    return modified;
}


export async function deleteClassTenant(classid: string): Promise<void> {
    const deleteQuery = 'DELETE FROM `tenants` WHERE `id` = ?';
    const response = await dbExecute(deleteQuery, [ classid ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete class tenant');
    }
}




/**
 * Checks the list of disruptive tenants to see if the provided class id
 * is on the list.
 *
 * "Disruptive" tenants are classes that have caused thousands of
 * notifications about training failures, who consistently ignore
 * warnings of insufficient API keys, and consistently ignore UI
 * requests to stop training new models even after rate limiting is
 * introduced.
 *
 * With the current implementation, where I receive a notification
 * to my mobile phone in the event of a training failure, this
 * is, at best, disruptive. Thousands of alert notifications in
 * an evening, aside from flattening my mobile phone battery,
 * makes it impossible for me to monitor or support other classes.
 *
 * For such classes, all errors are ignored.
 *
 * @returns true if the tenant ID is on the disruptive list
 */
export function isTenantDisruptive(tenantid: string): Promise<boolean> {
    return isStringInListTable(tenantid, 'disruptivetenants');
}

/**
 * Checks the list of notification opt-outs to see if the provided class id
 * is on the list.
 *
 * Most of these are tenants run by users who make regular usage of Bluemix
 * API keys and do not need to be notified of usage outside of ML for Kids.
 *
 * @returns true if the tenant ID is on the opt-out list
 */
export function hasTenantOptedOutOfNotifications(tenantid: string): Promise<boolean> {
    return isStringInListTable(tenantid, 'notificationoptouts');
}


/** Helper function to see if the provided value is contained in the provided single-column table. */
async function isStringInListTable(value: string, tablename: string): Promise<boolean> {
    const queryString = 'SELECT exists (' +
                            'SELECT * from `' + tablename + '` ' +
                                'WHERE `id` = ? ' +
                                'LIMIT 1' +
                        ') as stringinlist';
    const rows = await dbExecute(queryString, [ value ]);

    return dbobjects.getAsBoolean(rows[0], 'stringinlist');
}



// -----------------------------------------------------------------------------
//
// TEMPORARY SESSION USERS
//
// -----------------------------------------------------------------------------


export function testonly_resetSessionUsersStore(): Promise<void>
{
    return dbExecute('DELETE FROM `sessionusers`', []);
}



export async function storeTemporaryUser(lifespan: number): Promise<Objects.TemporaryUser>
{
    const obj = dbobjects.createTemporaryUser(lifespan);

    const insertUserQry = 'INSERT INTO `sessionusers` ' +
        '(`id`, `token`, `sessionexpiry`) ' +
        'VALUES (?, ?, ?)';

    const insertUserValues = [ obj.id, obj.token, obj.sessionexpiry ];

    const response = await dbExecute(insertUserQry, insertUserValues);
    if (response.affectedRows === 1) {
        return dbobjects.getTemporaryUserFromDbRow(obj);
    }
    throw new Error('Failed to store temporary user');
}

export async function getTemporaryUser(id: string): Promise<Objects.TemporaryUser | undefined>
{
    const queryString = 'SELECT `id`, `token`, `sessionexpiry` ' +
                        'FROM `sessionusers` ' +
                        'WHERE `id` = ?';

    const rows = await dbExecute(queryString, [ id ]);
    if (rows.length !== 1) {
        log.warn({ id }, 'Temporary user not found');
        return;
    }
    return dbobjects.getTemporaryUserFromDbRow(rows[0]);
}

export async function deleteTemporaryUser(user: Objects.TemporaryUser): Promise<void>
{
    const queryString = 'DELETE FROM `sessionusers` WHERE `id` = ?';

    const response = await dbExecute(queryString, [ user.id ]);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete temporary user');
    }
}

export async function countTemporaryUsers(): Promise<number>
{
    const queryString = 'SELECT COUNT(*) AS count FROM `sessionusers`';

    const rows = await dbExecute(queryString, [ ]);
    if (rows.length !== 1) {
        return 0;
    }

    return rows[0].count;
}


export async function getExpiredTemporaryUsers(): Promise<Objects.TemporaryUser[]>
{
    const queryString = 'SELECT `id`, `token`, `sessionexpiry` ' +
                        'FROM `sessionusers` ' +
                        'WHERE `sessionexpiry` < ? ' +
                        'LIMIT 50';

    const rows = await dbExecute(queryString, [ new Date() ]);
    return rows.map(dbobjects.getTemporaryUserFromDbRow);
}

export async function bulkDeleteTemporaryUsers(users: Objects.TemporaryUser[]): Promise<void>
{
    const queryPlaceholders: string[] = [];
    const ids = users.map((user) => {
        queryPlaceholders.push('?');
        return user.id;
    });

    const deleteQueryString = 'DELETE FROM `sessionusers` WHERE `id` IN (' + queryPlaceholders.join(',') + ')';

    const response = await dbExecute(deleteQueryString, ids);
    if (response.warningStatus !== 0) {
        throw new Error('Failed to delete temporary users');
    }
}



// -----------------------------------------------------------------------------
//
// SITE ALERTS
//
// -----------------------------------------------------------------------------

export function testonly_resetSiteAlertsStore(): Promise<void>
{
    return dbExecute('DELETE FROM `sitealerts`', []);
}


export async function storeSiteAlert(
    message: string, url: string,
    audience: Objects.SiteAlertAudienceLabel,
    severity: Objects.SiteAlertSeverityLabel,
    expiry: number,
): Promise<Objects.SiteAlert>
{
    let obj: Objects.SiteAlertDbRow;
    try {
        obj = dbobjects.createSiteAlert(message, url, audience, severity, expiry);
    }
    catch (err) {
        err.statusCode = 400;
        throw err;
    }

    const insertAlertQry: string = 'INSERT INTO `sitealerts` ' +
        '(`timestamp` , `severityid`, `audienceid`, `message`, `url`, `expiry`) ' +
        'VALUES (?, ?, ?, ?, ?, ?)';
    const insertAlertValues = [
        obj.timestamp,
        obj.severityid, obj.audienceid,
        obj.message, obj.url,
        obj.expiry,
    ];

    const response = await dbExecute(insertAlertQry, insertAlertValues);
    if (response.affectedRows === 1) {
        return dbobjects.getSiteAlertFromDbRow(obj);
    }
    throw new Error('Failed to store site alert');
}


export async function getLatestSiteAlert(): Promise<Objects.SiteAlert | undefined>
{
    const queryString = 'SELECT `timestamp` , `severityid`, `audienceid`, `message`, `url`, `expiry` ' +
                        'FROM `sitealerts` ' +
                        'ORDER BY `timestamp` DESC ' +
                        'LIMIT 1';
    const rows = await dbExecute(queryString, []);
    if (rows.length === 1) {
        return dbobjects.getSiteAlertFromDbRow(rows[0]);
    }
    else if (rows.length === 0) {
        return;
    }
    else {
        log.error({ rows, num : rows.length, func : 'getLatestSiteAlert' }, 'Unexpected response from DB');
        return;
    }
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

    case 'sounds':
        // nothing to do - models all stored client-side
        break;
    }

    const deleteQueries = [
        'DELETE FROM `projects` WHERE `id` = ?',
        'DELETE FROM `numbersprojectsfields` WHERE `projectid` = ?',
        'DELETE FROM `texttraining` WHERE `projectid` = ?',
        'DELETE FROM `numbertraining` WHERE `projectid` = ?',
        'DELETE FROM `imagetraining` WHERE `projectid` = ?',
        'DELETE FROM `soundtraining` WHERE `projectid` = ?',
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


export async function deleteClassResources(classid: string): Promise<void> {
    const deleteQueries = [
        'DELETE FROM `bluemixcredentials` WHERE `classid` = ?',
    ];

    const dbConn = await dbConnPool.getConnection();
    for (const deleteQuery of deleteQueries) {
        await dbConn.execute(deleteQuery, [ classid ]);
    }
    dbConn.release();
}
