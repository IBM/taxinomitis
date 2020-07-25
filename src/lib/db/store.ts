// external dependencies
import * as pg from 'pg';
// local dependencies
import * as postgresql from './postgresqldb';
import * as dbobjects from './objects';
import * as projectObjects from './projects';
import * as Objects from './db-types';
import * as numbers from '../training/numbers';
import * as conversation from '../training/conversation';
import * as visualrec from '../training/visualrecognition';
import * as TrainingObjects from '../training/training-types';
import * as limits from './limits';
import { ONE_HOUR } from '../utils/constants';
import loggerSetup from '../utils/logger';


const log = loggerSetup();

let dbConnPool: pg.Pool;

export async function init() {
    if (!dbConnPool) {
        dbConnPool = await postgresql.connect();
    }
}

export async function disconnect() {
    if (dbConnPool) {
        await postgresql.disconnect();
        // @ts-ignore
        dbConnPool = undefined;
    }
}

export function replaceDbConnPoolForTest(testDbConnPool: pg.Pool) {
    dbConnPool = testDbConnPool;
}

async function restartConnection() {
    log.info('Restarting DB connection pool');
    try {
        await disconnect();
        await init();
    }
    catch (err) {
        /* istanbul ignore next */
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
    // const dbConn = await dbConnPool.getConnection();
    try {
        log.error({ query, params }, 'dbExecute');
        const response = await dbConnPool.query(query, params);
        log.error('success');
        return response;
    }
    catch (err) {
        log.error({ query, params : params.join(','), err }, 'DB error');
        await handleDbException(err);
        throw err;
    }
    // finally {
    //     dbConn.release();
    // }
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

    const insertProjectQry: string = 'INSERT INTO projects ' +
        '(id, userid, classid, typeid, name, language, labels, numfields, iscrowdsourced) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
    const insertProjectValues = [
        obj.id,
        obj.userid, obj.classid,
        obj.typeid,
        obj.name, obj.language, obj.labels,
        obj.fields.length,
        obj.iscrowdsourced,
    ];

    const queryParameterValues = [];
    let queryIdx = 1;
    const insertFieldsQryPlaceholders = [];
    for (const field of obj.fields) {
        queryParameterValues.push(field.id);
        queryParameterValues.push(field.userid);
        queryParameterValues.push(field.classid);
        queryParameterValues.push(field.projectid);
        queryParameterValues.push(field.name);
        queryParameterValues.push(field.fieldtype);
        queryParameterValues.push(field.choices);

        insertFieldsQryPlaceholders.push('(' +
            '$' + (queryIdx + 0) + ', ' +
            '$' + (queryIdx + 1) + ', ' +
            '$' + (queryIdx + 2) + ', ' +
            '$' + (queryIdx + 3) + ', ' +
            '$' + (queryIdx + 4) + ', ' +
            '$' + (queryIdx + 5) + ', ' +
            '$' + (queryIdx + 6) +
        ')');

        queryIdx += 7;
    }
    const insertFieldsQry = 'INSERT INTO numbersprojectsfields ' +
        '(id, userid, classid, projectid, name, fieldtype, choices) ' +
        'VALUES ' +
        insertFieldsQryPlaceholders.join(', ');

    let outcome = InsertTrainingOutcome.StoredOk;

    // const dbConn = await dbConnPool.getConnection();
    try {
        // store the project info
        const insertResponse = await dbExecute(insertProjectQry, insertProjectValues);
        if (insertResponse.rowCount !== 1) {
            log.error({ insertResponse }, 'Failed to store project info');
            outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
        }

        // store the fields for the project if we have any
        if (outcome === InsertTrainingOutcome.StoredOk && obj.fields.length > 0) {
            const insertFieldsResponse = await dbConnPool.query(insertFieldsQry, queryParameterValues);
            if (insertFieldsResponse.rowCount !== obj.fields.length) {
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
    // finally {
    //     dbConn.release();
    // }


    if (outcome === InsertTrainingOutcome.StoredOk) {
        return dbobjects.getProjectFromDbRow(obj);
    }

    throw new Error('Failed to store project');
}


export async function updateProjectCrowdSourced(
    userid: string, classid: string, projectid: string,
    isCrowdSourced: boolean,
): Promise<void>
{
    const queryString = 'UPDATE projects ' +
                        'SET iscrowdsourced = $1 ' +
                        'WHERE userid = $2 AND classid = $3 AND id = $4';
    const values = [
        isCrowdSourced ? 1 : 0,
        userid, classid, projectid,
    ];
    const response = await dbExecute(queryString, values);
    if (response.rowCount === 1) {
        // success
        return;
    }

    /* istanbul ignore else */
    if (response.rowCount === 0) {
        log.warn({ userid, classid, projectid, func : 'updateProjectCrowdSourced' },
                 'Project not found');
        throw new Error('Project not found');
    }
    else {
        // id is a primary key, so an update can only affect 0 or 1 rows
        log.error({
            func : 'updateProjectCrowdSourced',
            userid, classid, projectid,
            response,
        }, 'Unexpected response');
        throw new Error('Unexpected response when updating project status');
    }
}


export async function getNumberProjectFields(
    userid: string, classid: string, projectid: string,
): Promise<Objects.NumbersProjectField[]>
{
    const queryString = 'SELECT id, userid, classid, projectid, name, fieldtype, choices ' +
                        'FROM numbersprojectsfields ' +
                        'WHERE userid = $1 AND classid = $2 AND projectid = $3 ' +
                        'ORDER BY id';

    const resp = await dbExecute(queryString, [ userid, classid, projectid ]);

    return resp.rows.map(dbobjects.getNumbersProjectFieldFromDbRow);
}


async function getCurrentLabels(userid: string, classid: string, projectid: string): Promise<string[]> {
    const queryString = 'SELECT id, labels ' +
                        'FROM projects ' +
                        'WHERE id = $1 AND userid = $2 AND classid = $3';
    const values = [
        projectid,
        userid,
        classid,
    ];
    const resp = await dbExecute(queryString, values);
    const rows = resp.rows;
    if (rows.length === 1) {
        return dbobjects.getLabelsFromList(rows[0].labels);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({ projectid, classid, func : 'getCurrentLabels' }, 'Project not found in request for labels');
    }
    else {
        // id is a PRIMARY key, so the DB should only ever return 0 or 1 rows
        log.error({ projectid, classid, rows, func : 'getCurrentLabels' }, 'Unexpected number of project rows');
    }
    throw new Error('Project not found');
}
async function updateLabels(userid: string, classid: string, projectid: string, labels: string[]): Promise<any> {
    const queryString = 'UPDATE projects ' +
                        'SET labels = $1 ' +
                        'WHERE id = $2 AND userid = $3 AND classid = $4';
    const values = [
        dbobjects.getLabelListFromArray(labels),
        projectid,
        userid,
        classid,
    ];
    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
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
    const queryString = 'SELECT id, userid, classid, ' +
                            'typeid, name, language, ' +
                            'labels, numfields, ' +
                            'iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE id = $1';

    const resp = await dbExecute(queryString, [ id ]);
    const rows = resp.rows;
    if (rows.length === 1) {
        return dbobjects.getProjectFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({ id, func : 'getProject' }, 'Project not found');
    }
    else {
        /* istanbul ignore next */
        // id is a PRIMARY key, so the DB should only ever return 0 or 1 rows
        log.error({ rows, id, func : 'getProject' }, 'Project not found');
    }
    return;
}


/**
 * Fetches projects that the specified user owns.
 *
 * This list should only include projects created by the specified user
 */
export async function getProjectsOwnedByUserId(userid: string, classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT id, userid, classid, ' +
                            'typeid, name, language, ' +
                            'labels, ' +
                            'iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE classid = $1 AND userid = $2';

    const resp = await dbExecute(queryString, [ classid, userid ]);
    const rows = resp.rows;
    return rows.map(dbobjects.getProjectFromDbRow);
}

/**
 * Fetches projects that the specified user is entitled to access.
 *
 * This list should include:
 *  Any projects created by the specified user
 *  Any crowd-sourced projects owned by the user the class is in.
 */
export async function getProjectsByUserId(userid: string, classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT id, userid, classid, ' +
                            'typeid, name, language, ' +
                            'labels, ' +
                            'iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE classid = $1 AND (userid = $2 OR iscrowdsourced = True)';

    const resp = await dbExecute(queryString, [ classid, userid ]);
    const rows = resp.rows;
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function countProjectsByUserId(userid: string, classid: string): Promise<number> {
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM projects ' +
                        'WHERE userid = $1 AND classid = $2';

    const resp = await dbExecute(queryString, [ userid, classid ]);
    const rows = resp.rows;
    /* istanbul ignore if */
    // even if there are none, a SELECT COUNT(*) should return 0
    //  so we should never pass this if, but paranoia for the win
    if (rows.length !== 1) {
        log.error({ rows, func: 'countProjectsByUserId' }, 'Unexpected response from DB');
        return 0;
    }

    return rows[0].count;
}


export async function getProjectsByClassId(classid: string): Promise<Objects.Project[]> {
    const queryString = 'SELECT id, userid, classid, typeid, name, labels, language, iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE classid = $1';

    const resp = await dbExecute(queryString, [ classid ]);
    const rows = resp.rows;
    return rows.map(dbobjects.getProjectFromDbRow);
}


export async function deleteProjectsByClassId(classid: string): Promise<void> {
    const queryString = 'DELETE FROM projects WHERE classid = $1';

    /*const response =*/ await dbExecute(queryString, [ classid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete projects');
    // }
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
    const queryString = 'SELECT COUNT(*) AS trainingcount FROM ' + dbTable + ' WHERE projectid = $1';
    const response = await dbExecute(queryString, [projectid]);
    return response.rows[0].trainingcount;
}


export async function countTrainingByLabel(project: Objects.Project)
    : Promise<{ [label: string]: number }>
{
    const dbTable = getDbTable(project.type);

    const queryString = 'SELECT label, COUNT(*) AS trainingcount FROM ' + dbTable + ' ' +
                        'WHERE projectid = $1 ' +
                        'GROUP BY label';
    const response = await dbExecute(queryString, [project.id]);
    const rows = response.rows;
    const counts: { [label: string]: number } = {};
    for (const count of rows) {
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
    const queryString = 'UPDATE ' + dbTable + ' ' +
                        'SET label = $1 ' +
                        'WHERE projectid = $2 AND label = $3';
    // const dbConn = await dbConnPool.getConnection();
    await dbConnPool.query(queryString, [ labelAfter, projectid, labelBefore ]);
    // dbConn.release();
}


export async function deleteTraining(
    type: Objects.ProjectTypeLabel,
    projectid: string, trainingid: string,
): Promise<void>
{
    const dbTable = getDbTable(type);
    const queryString = 'DELETE FROM ' + dbTable + ' WHERE id = $1 AND projectid = $2';

    /*const response =*/ await dbExecute(queryString, [ trainingid, projectid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete training');
    // }
}


async function deleteTrainingLabel(
    type: Objects.ProjectTypeLabel,
    projectid: string, label: string,
): Promise<void>
{
    const dbTable = getDbTable(type);
    const queryString = 'DELETE FROM ' + dbTable + ' WHERE projectid = $1 AND label = $2';

    /*const response =*/ await dbExecute(queryString, [ projectid, label ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete label');
    // }
}


export async function deleteTrainingByProjectId(type: Objects.ProjectTypeLabel, projectid: string): Promise<void> {
    const dbTable = getDbTable(type);
    const queryString = 'DELETE FROM ' + dbTable + ' WHERE projectid = $1';

    /*const response =*/ await dbExecute(queryString, [ projectid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete training');
    // }
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

    const countQry = 'SELECT COUNT(*) AS trainingcount FROM texttraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO texttraining (id, projectid, textdata, label) VALUES ($1, $2, $3, $4)';
    const insertValues = [ obj.id, obj.projectid, obj.textdata, obj.label ];


    //
    // connect to the DB
    //

    // const dbConn = await dbConnPool.getConnection();

    try {
        // count how much training data they already have
        const countResponse = await dbConnPool.query(countQry, countValues);
        const countRows = countResponse.rows;
        const count = countRows[0].trainingcount;

        if (count >= limits.getStoreLimits().textTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't hit their limit - okay to do the INSERT now
            const insertResponse = await dbConnPool.query(insertQry, insertValues);
            if (insertResponse.rowCount === 1) {
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
    // finally {
    //     dbConn.release();
    // }


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
    projectid: string, training: {textdata: string, label: string}[],
): Promise<void>
{
    const queryParameterValues = [];
    let queryIdx = 1;
    const insertFieldsQryPlaceholders = [];

    for (const item of training) {
        const obj = dbobjects.createTextTraining(projectid, item.textdata, item.label);

        queryParameterValues.push(obj.id);
        queryParameterValues.push(obj.projectid);
        queryParameterValues.push(obj.textdata);
        queryParameterValues.push(obj.label);

        insertFieldsQryPlaceholders.push('(' +
            '$' + (queryIdx + 0) + ', ' +
            '$' + (queryIdx + 1) + ', ' +
            '$' + (queryIdx + 2) + ', ' +
            '$' + (queryIdx + 3) +
        ')');

        queryIdx += 4;
    }

    const queryString = 'INSERT INTO texttraining ' +
        '(id, projectid, textdata, label) ' +
        'VALUES ' +
        insertFieldsQryPlaceholders.join(', ');

    // const dbConn = await dbConnPool.getConnection();
    const response = await dbConnPool.query(queryString, queryParameterValues);
    // await dbConn.release();

    if (response.rowCount === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}



export async function getTextTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryString = 'SELECT id, textdata, label FROM texttraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label, id ' +
                        'LIMIT $2 OFFSET $3';

    const response = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    const rows = response.rows;
    return rows.map(dbobjects.getTextTrainingFromDbRow);
}


export async function getTextTrainingByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryString = 'SELECT id, textdata, label FROM texttraining ' +
                        'WHERE projectid = $1 AND label = $2 ' +
                        'ORDER BY textdata ' +
                        'LIMIT $3 OFFSET $4';

    const response = await dbExecute(queryString, [ projectid, label, options.limit, options.start ]);
    const rows = response.rows;
    return rows.map(dbobjects.getTextTrainingFromDbRow);
}

export async function getUniqueTrainingTextsByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<string[]>
{
    // Conversation chokes on duplicate texts, so we're using SELECT DISTINCT to avoid that
    const queryString = 'SELECT DISTINCT textdata FROM texttraining ' +
                        'WHERE projectid = $1 AND label = $2 ' +
                        'LIMIT $3 OFFSET $4';

    const queryParams = [ projectid, label, options.limit, options.start ];
    const response = await dbExecute(queryString, queryParams);
    const rows: { textdata: string }[] = response.rows;
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

    const countQry = 'SELECT COUNT(*) AS trainingcount FROM imagetraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO imagetraining ' +
                        '(id, projectid, imageurl, label, isstored) ' +
                        'VALUES ($1, $2, $3, $4, $5)';
    const insertValues = [ obj.id, obj.projectid, obj.imageurl, obj.label, obj.isstored ];


    //
    // connect to the DB
    //

    // const dbConn = await dbConnPool.getConnection();

    try {
        // count how much training data they already have
        const countResponse = await dbConnPool.query(countQry, countValues);
        const countRows = countResponse.rows;
        const count = countRows[0].trainingcount;

        if (count >= limits.getStoreLimits().imageTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't hit their limit - okay to do the INSERT now
            const insertResponse = await dbConnPool.query(insertQry, insertValues);
            if (insertResponse.rowCount === 1) {
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
    // finally {
    //     dbConn.release();
    // }


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
    projectid: string, training: {imageurl: string, label: string}[],
): Promise<void>
{
    const queryParameterValues = [];
    let queryIdx = 1;
    const insertFieldsQryPlaceholders = [];

    for (const item of training) {
        const obj = dbobjects.createImageTraining(projectid, item.imageurl, item.label, false);

        queryParameterValues.push(obj.id);
        queryParameterValues.push(obj.projectid);
        queryParameterValues.push(obj.imageurl);
        queryParameterValues.push(obj.label);
        queryParameterValues.push(obj.isstored);

        insertFieldsQryPlaceholders.push('(' +
            '$' + (queryIdx + 0) + ', ' +
            '$' + (queryIdx + 1) + ', ' +
            '$' + (queryIdx + 2) + ', ' +
            '$' + (queryIdx + 3) + ', ' +
            '$' + (queryIdx + 4) +
        ')');

        queryIdx += 5;
    }

    const queryString = 'INSERT INTO imagetraining ' +
        '(id, projectid, imageurl, label, isstored) ' +
        'VALUES ' +
        insertFieldsQryPlaceholders.join(', ');

    // const dbConn = await dbConnPool.getConnection();
    const response = await dbConnPool.query(queryString, queryParameterValues);
    // await dbConn.release();

    if (response.rowCount === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}


export async function getImageTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label, imageurl ' +
                        'LIMIT $2 OFFSET $3';

    const response = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    const rows = response.rows;
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}


export async function getImageTrainingByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 AND label = $2 ' +
                        'LIMIT $3 OFFSET $4';

    const response = await dbExecute(queryString, [ projectid, label, options.limit, options.start ]);
    const rows = response.rows;
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function getStoredImageTraining(projectid: string, label: string): Promise<Objects.ImageTraining[]>
{
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 AND label = $2 AND isstored = $3 ' +
                        'LIMIT 1000';

    const response = await dbExecute(queryString, [ projectid, label, true ]);
    const rows = response.rows;
    return rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function isImageStored(imageid: string): Promise<boolean> {
    const queryString = 'SELECT isstored FROM imagetraining WHERE id = $1';
    const values = [ imageid ];
    const response = await dbExecute(queryString, values);
    const rows = response.rows;
    if (rows.length > 0) {
        return rows[0].isstored;
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

    const countQry = 'SELECT COUNT(*) AS trainingcount FROM numbertraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO numbertraining ' +
                      '(id, projectid, numberdata, label) VALUES ($1, $2, $3, $4)';
    const insertValues = [ obj.id, obj.projectid, data.join(','), obj.label ];


    //
    // connect to the DB
    //

    // const dbConn = await dbConnPool.getConnection();

    try {
        // count how much training data they already have
        const countResponse = await dbConnPool.query(countQry, countValues);
        const countRows = countResponse.rows;
        const count = countRows[0].trainingcount;

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
            const insertResponse = await dbConnPool.query(insertQry, insertValues);
            if (insertResponse.rowCount === 1) {
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
    // finally {
    //     dbConn.release();
    // }


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
    projectid: string, training: {numberdata: number[], label: string}[],
): Promise<void>
{
    const queryParameterValues = [];
    let queryIdx = 1;
    const insertFieldsQryPlaceholders = [];

    for (const item of training) {
        const obj = dbobjects.createNumberTraining(projectid, item.numberdata, item.label);

        queryParameterValues.push(obj.id);
        queryParameterValues.push(obj.projectid);
        queryParameterValues.push(obj.numberdata.join(','));
        queryParameterValues.push(obj.label);

        insertFieldsQryPlaceholders.push('(' +
            '$' + (queryIdx + 0) + ', ' +
            '$' + (queryIdx + 1) + ', ' +
            '$' + (queryIdx + 2) + ', ' +
            '$' + (queryIdx + 3) +
        ')');

        queryIdx += 4;
    }

    const queryString = 'INSERT INTO numbertraining ' +
        '(id, projectid, numberdata, label) ' +
        'VALUES ' +
        insertFieldsQryPlaceholders.join(', ');

    // const dbConn = await dbConnPool.getConnection();
    const response = await dbConnPool.query(queryString, queryParameterValues);
    // dbConn.release();

    if (response.rowCount === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}


export async function getNumberTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.NumberTraining[]>
{
    const queryString = 'SELECT id, numberdata, label FROM numbertraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label ' +
                        'LIMIT $2 OFFSET $3';

    const response = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    const rows = response.rows;
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
    const countQry = 'SELECT COUNT(*) AS trainingcount from soundtraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertQry = 'INSERT INTO soundtraining (id, projectid, audiourl, label) VALUES ($1, $2, $3, $4)';
    const insertValues = [ obj.id, obj.projectid, obj.audiourl, obj.label ];

    // connect to the DB
    // const dbConn = await dbConnPool.getConnection();

    // store the data unless the project is already full
    try {
        // count the number of training items already in the project
        const countResponse = await dbConnPool.query(countQry, countValues);
        const countRows = countResponse.rows;
        const count = countRows[0].trainingcount;

        if (count >= limits.getStoreLimits().soundTrainingItemsPerProject) {
            // they already have too much data - nothing else to do
            outcome = InsertTrainingOutcome.NotStored_MetLimit;
        }
        else {
            // they haven't reached their limit yet - okay to INSERT
            const insertResponse = await dbConnPool.query(insertQry, insertValues);
            if (insertResponse.rowCount === 1) {
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
    // finally {
    //     dbConn.release();
    // }


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
    const queryString = 'SELECT id, audiourl, label FROM soundtraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label, id ' +
                        'LIMIT $2 OFFSET $3';

    const response = await dbExecute(queryString, [ projectid, options.limit, options.start ]);
    const rows = response.rows;
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
    const queryString = 'INSERT INTO bluemixcredentials ' +
                        '(id, classid, servicetype, url, username, password, credstypeid, notes) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';

    const values = [ credentials.id, classid,
        credentials.servicetype, credentials.url, credentials.username, credentials.password,
        credentials.credstypeid,
        credentials.notes ? credentials.notes : null ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount === 1) {
        return dbobjects.getCredentialsFromDbRow(credentials);
    }
    throw new Error('Failed to store credentials');
}

export async function storeBluemixCredentialsPool(
    credentials: TrainingObjects.BluemixCredentialsPoolDbRow,
): Promise<TrainingObjects.BluemixCredentials>
{
    const queryString = 'INSERT INTO bluemixcredentialspool ' +
                        '(id, servicetype, url, username, password, credstypeid, notes, lastfail) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';

    const values = [ credentials.id,
        credentials.servicetype, credentials.url, credentials.username, credentials.password,
        credentials.credstypeid, credentials.notes,
        credentials.lastfail,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount === 1) {
        return dbobjects.getCredentialsPoolFromDbRow(credentials);
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

    const queryString = 'UPDATE bluemixcredentials ' +
                        'SET credstypeid = $1 ' +
                        'WHERE id = $2 AND servicetype = $3 AND classid = $4';
    const queryParameters = [ credstypeObj.id, credentialsid, servicetype, classid ];

    const response = await dbExecute(queryString, queryParameters);
    if (response.rowCount !== 1) {
        log.error({ queryString, queryParameters, response }, 'Failed to update credentials');
        throw new Error('Bluemix credentials not updated');
    }
}


export async function getAllBluemixCredentials(
    service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                        'FROM bluemixcredentials ' +
                        'WHERE servicetype = $1 ' +
                        'LIMIT 2000';

    const response = await dbExecute(queryString, [ service ]);
    const rows = response.rows;
    return rows.map(dbobjects.getCredentialsFromDbRow);
}


export async function getBluemixCredentials(
    tenant: Objects.ClassTenant, service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                        'FROM bluemixcredentials ' +
                        'WHERE classid = $1 AND servicetype = $2';

    const response = await dbExecute(queryString, [ tenant.id, service ]);
    const rows = response.rows;
    if (rows.length === 0) {
        log.warn({ rows, func : 'getBluemixCredentials' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return rows.map(dbobjects.getCredentialsFromDbRow);
}

export async function getBluemixCredentialsPoolBatch(
    service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryString = 'SELECT id, servicetype, url, username, password, credstypeid, lastfail ' +
                        'FROM bluemixcredentialspool ' +
                        'WHERE servicetype = $1 ' +
                        'ORDER BY lastfail ' +
                        'LIMIT 100';

    const response = await dbExecute(queryString, [ service ]);
    const rows = response.rows;
    if (rows.length === 0) {
        log.warn({ rows, func : 'getBluemixCredentialsPoolBatch' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return rows.map(dbobjects.getCredentialsPoolFromDbRow);
}

export function recordBluemixCredentialsPoolFailure(credentials: TrainingObjects.BluemixCredentialsPool): Promise<TrainingObjects.BluemixCredentialsPool>
{
    return updateBluemixCredentialsPoolTimestamp(credentials, new Date());
}
export function recordBluemixCredentialsPoolModelDeletion(credentials: TrainingObjects.BluemixCredentialsPool): Promise<TrainingObjects.BluemixCredentialsPool>
{
    let updatedTimestamp: Date;
    if (credentials.lastfail) {
        updatedTimestamp = new Date(credentials.lastfail.getTime() - ONE_HOUR);
    }
    else {
        log.error({ credentials }, 'Missing timestamp for credentials, defaulting to now');
        updatedTimestamp = new Date(Date.now() - ONE_HOUR);
    }
    return updateBluemixCredentialsPoolTimestamp(credentials, updatedTimestamp);
}

async function updateBluemixCredentialsPoolTimestamp(credentials: TrainingObjects.BluemixCredentialsPool, newlastfail: Date): Promise<TrainingObjects.BluemixCredentialsPool>
{
    credentials.lastfail = newlastfail;

    const queryString: string = 'UPDATE bluemixcredentialspool ' +
                                'SET lastfail = $1 ' +
                                'WHERE id = $2';
    const values = [ credentials.lastfail, credentials.id ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({
            credentials, queryString, values, response,
        }, 'Failed to update failure date');
    }

    return credentials;
}

export async function getCombinedBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    const credsQuery = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                       'FROM bluemixcredentials ' +
                       'WHERE id = $1 ' +
                       'UNION ' +
                       'SELECT id, \'managedpooluse\' as classid, servicetype, url, username, password, credstypeid ' +
                       'FROM bluemixcredentialspool ' +
                       'WHERE id = $1';
    const response = await dbExecute(credsQuery, [ credentialsid ]);
    const rows = response.rows;

    if (rows.length === 1) {
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }
    if (rows.length === 2) {
        log.error({
            credentialsid, credsQuery, rows,
            func : 'getCombinedBluemixCredentialsById',
        }, 'Credentials stored in multiple tables');
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({
            credentialsid, credsQuery, rows,
            func : 'getCombinedBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        // id is a PRIMARY key, so the DB shouldn't be able to return a different number of rows
        log.error({
            credentialsid, credsQuery, rows,
            func : 'getCombinedBluemixCredentialsById',
        }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving the service credentials');
}

export async function getBluemixCredentialsById(classType: Objects.ClassTenantType, credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    if (classType === Objects.ClassTenantType.ManagedPool) {
        return getPoolBluemixCredentialsById(credentialsid);
    }
    else {
        return getClassBluemixCredentialsById(credentialsid);
    }
}

async function getClassBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials> {
    const credsQuery = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                       'FROM bluemixcredentials ' +
                       'WHERE id = $1';
    const response = await dbExecute(credsQuery, [ credentialsid ]);
    const rows = response.rows;

    if (rows.length === 1) {
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({
            credentialsid, credsQuery, rows,
            func : 'getClassBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        // id is a PRIMARY key, so the DB should only return 0 or 1 rows
        log.error({
            credentialsid, credsQuery, rows,
            func : 'getClassBluemixCredentialsById',
        }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving the service credentials');
}

async function getPoolBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials> {
    const credsQuery = 'SELECT id, servicetype, url, username, password, credstypeid, lastfail ' +
                       'FROM bluemixcredentialspool ' +
                       'WHERE id = $1';
    const response = await dbExecute(credsQuery, [ credentialsid ]);
    const rows = response.rows;

    if (rows.length === 1) {
        return dbobjects.getCredentialsPoolFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({
            credentialsid, credsQuery, rows,
            func : 'getPoolBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        // id is a PRIMARY key, so the DB should only return 0 or 1 rows
        log.error({
            credentialsid, credsQuery, rows,
            func : 'getPoolBluemixCredentialsById',
        }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving service credentials');
}


export async function countBluemixCredentialsByType(classid: string): Promise<{ conv: number, visrec: number }>
{
    const credsQuery = 'SELECT servicetype, credstypeid, count(*) as count ' +
                       'FROM bluemixcredentials ' +
                       'WHERE classid = $1 ' +
                       'GROUP BY servicetype, credstypeid';
    const response = await dbExecute(credsQuery, [ classid ]);
    const rows = response.rows;

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
    const credsQuery = 'SELECT classid, ' +
                           'sum(case when servicetype = \'conv\' then 1 else 0 end) conv, ' +
                           'sum(case when servicetype = \'visrec\' then 1 else 0 end) visrec ' +
                       'FROM bluemixcredentials ' +
                       'GROUP BY classid';

    const response = await dbExecute(credsQuery, []);
    const rows = response.rows;

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
    const queryString = 'DELETE FROM bluemixcredentials WHERE id = $1';

    /*const response =*/ await dbExecute(queryString, [ credentialsid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete credentials info');
    // }
}

export async function deleteBluemixCredentialsPool(credentialsid: string): Promise<void> {
    const queryString = 'DELETE FROM bluemixcredentialspool WHERE id = $1';

    /*const response =*/ await dbExecute(queryString, [ credentialsid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete credentials info');
    // }
}

export function deleteBluemixCredentialsPoolForTests(): Promise<void> {
    // ensure this function is only used in tests, so we don't
    //  accidentally trash a production database table
    if (process.env.MYSQLHOST === 'localhost') {
        const queryString = 'DELETE FROM bluemixcredentialspool';
        return dbExecute(queryString, [ ])
            .then(() => { return; });
    }
    else {
        log.error('deleteBluemixCredentialsPoolForTests called on production system');
        return Promise.resolve();
    }
}


export async function deleteClassifiersByCredentials(credentials: TrainingObjects.BluemixCredentials): Promise<void> {
    const queryString = 'DELETE FROM bluemixclassifiers WHERE credentialsid = $1';

    /*const response =*/ await dbExecute(queryString, [ credentials.id ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete credentials info');
    // }
}


export async function getNumbersClassifiers(projectid: string): Promise<TrainingObjects.NumbersClassifier[]>
{
    const queryString = 'SELECT projectid, userid, classid, ' +
                        'created, status ' +
                        'FROM taxinoclassifiers ' +
                        'WHERE projectid = $1';

    const response = await dbExecute(queryString, [ projectid ]);
    const rows = response.rows;
    return rows.map(dbobjects.getNumbersClassifierFromDbRow);
}

export async function getConversationWorkspaces(
    projectid: string,
): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                        ' classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE projectid = $1';

    const response = await dbExecute(queryString, [ projectid ]);
    const rows = response.rows;
    return rows.map(dbobjects.getWorkspaceFromDbRow);
}

export async function getConversationWorkspace(
    projectid: string, classifierid: string,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                        ' classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE projectid = $1 AND classifierid = $2';

    const response = await dbExecute(queryString, [ projectid, classifierid ]);
    const rows = response.rows;
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
                        'FROM bluemixclassifiers ' +
                        'WHERE classid = $1';

    const response = await dbExecute(queryString, [ classid ]);
    const rows = response.rows;
    /* istanbul ignore if */
    // even if there are none, a SELECT COUNT(*) should return 0
    //  so we should never pass this if, but paranoia for the win
    if (rows.length !== 1) {
        log.error({ rows, func: 'countConversationWorkspaces' }, 'Unexpected response from DB');
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

    const queryString: string = 'INSERT INTO bluemixclassifiers ' +
                                '(id, credentialsid, ' +
                                'projectid, userid, classid, ' +
                                'servicetype, ' +
                                'classifierid, url, name, language, ' +
                                'created, expiry) ' +
                                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';

    const values = [obj.id, obj.credentialsid,
        obj.projectid, obj.userid, obj.classid,
        obj.servicetype,
        obj.classifierid, obj.url, obj.name, obj.language,
        obj.created, obj.expiry];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ response }, 'Failed to store workspace info');
        throw new Error('Failed to store workspace');
    }

    return workspace;
}


export async function updateConversationWorkspaceExpiry(
    workspace: TrainingObjects.ConversationWorkspace,
): Promise<void>
{
    const queryString: string = 'UPDATE bluemixclassifiers ' +
                                'SET created = $1, expiry = $2 ' +
                                'WHERE id = $3';
    const values = [ workspace.created, workspace.expiry, workspace.id ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ queryString, values, response }, 'Failed to update expiry date');
        throw new Error('Conversation Workspace expiry not updated');
    }
}

export async function getExpiredConversationWorkspaces(): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                        ' classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE expiry < $1 AND servicetype = $2';

    const response = await dbExecute(queryString, [ new Date(), 'conv' ]);
    const rows = response.rows;
    return rows.map(dbobjects.getWorkspaceFromDbRow);
}


export async function storeNumbersClassifier(
    userid: string, classid: string, projectid: string, status: TrainingObjects.NumbersStatus,
): Promise<TrainingObjects.NumbersClassifier>
{
    const obj = dbobjects.createNumbersClassifier(userid, classid, projectid, status);

    const queryString: string = 'INSERT INTO taxinoclassifiers ' +
                                    '(projectid, userid, classid, created, status) ' +
                                'VALUES ' +
                                    '($1, $2, $3, $4, $5) ' +
                                'ON CONFLICT (projectid) DO UPDATE SET ' +
                                    'userid = $2, classid = $3, created = $4, status = $5';

    const values = [obj.projectid, obj.userid, obj.classid, obj.created, obj.status];

    /*const response =*/ await dbExecute(queryString, values);
    // if (response.warningStatus !== 0) {
    //     log.error({ response }, 'Failed to store classifier info');
    //     throw new Error('Failed to store classifier');
    // }

    return dbobjects.getNumbersClassifierFromDbRow(obj);
}



export async function deleteConversationWorkspace(id: string): Promise<void>
{
    const queryString = 'DELETE FROM bluemixclassifiers WHERE id = $1 AND servicetype = $2';

    /*const response =*/ await dbExecute(queryString, [ id, 'conv' ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete classifiers info');
    // }
}


export async function deleteConversationWorkspacesByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM bluemixclassifiers WHERE projectid = $1';

    /*const response =*/ await dbExecute(queryString, [ projectid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete classifiers info');
    // }
}



export async function storeImageClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    project: Objects.Project,
    classifier: TrainingObjects.VisualClassifier,
): Promise<TrainingObjects.VisualClassifier>
{
    const obj = dbobjects.createVisualClassifier(classifier, credentials, project);

    const queryString: string = 'INSERT INTO bluemixclassifiers ' +
                                '(id, credentialsid, ' +
                                'projectid, userid, classid, ' +
                                'servicetype, ' +
                                'classifierid, url, name, language, ' +
                                'created, expiry) ' +
                                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';

    const values = [obj.id, obj.credentialsid,
        obj.projectid, obj.userid, obj.classid,
        obj.servicetype,
        obj.classifierid, obj.url, obj.name, obj.language,
        obj.created, obj.expiry];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ response }, 'Failed to store classifier info');
        throw new Error('Failed to store classifier');
    }

    return classifier;
}


export async function getImageClassifiers(
    projectid: string,
): Promise<TrainingObjects.VisualClassifier[]>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                        ' classifierid, url, name, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE projectid = $1';

    const response = await dbExecute(queryString, [ projectid ]);
    const rows = response.rows;
    return rows.map(dbobjects.getVisualClassifierFromDbRow);
}

export async function getImageClassifier(
    projectid: string, classifierid: string,
): Promise<TrainingObjects.VisualClassifier>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                        ' classifierid, url, name, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE projectid = $1 AND classifierid = $2';

    const response = await dbExecute(queryString, [ projectid, classifierid ]);
    const rows = response.rows;
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

    const queryString = 'DELETE FROM bluemixclassifiers WHERE id = $1 AND servicetype = $2';

    /*const response =*/ await dbExecute(queryString, [ id, 'visrec' ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete classifiers info');
    // }
}

export async function getExpiredImageClassifiers(): Promise<TrainingObjects.VisualClassifier[]>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                        ' classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE expiry < $1 AND servicetype = $2';

    const response = await dbExecute(queryString, [ new Date(), 'visrec' ]);
    const rows = response.rows;
    return rows.map(dbobjects.getVisualClassifierFromDbRow);
}



export async function getProjectsWithBluemixClassifiers(classid: string): Promise<{[projectid: string]: string}> {
    const queryString = 'SELECT projectid, classifierid FROM bluemixclassifiers WHERE classid = $1';

    const projects: {[projectid: string]: string} = {};

    const response = await dbExecute(queryString, [ classid ]);
    const rows = response.rows;
    rows.forEach((row: any) => {
        projects[row.projectid] = row.classifierid;
    });

    return projects;
}




export async function getClassifierByBluemixId(classifierid: string):
    Promise<TrainingObjects.VisualClassifier|TrainingObjects.ConversationWorkspace|undefined>
{
    const queryString = 'SELECT id, credentialsid, projectid, servicetype,' +
                            ' classifierid, url, name, language, created, expiry ' +
                            'FROM bluemixclassifiers ' +
                            'WHERE classifierid = $1';

    const response = await dbExecute(queryString, [ classifierid ]);
    const rows = response.rows;
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

    const queryString = 'INSERT INTO scratchkeys ' +
                        '(id, ' +
                        'projectid, projectname, projecttype, ' +
                        'userid, classid, updated) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7)';

    const values = [
        obj.id,
        project.id, obj.name, obj.type,
        project.userid, project.classid, obj.updated,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ response }, 'Failed to store Scratch key');
        throw new Error('Failed to store Scratch key');
    }

    return obj.id;
}



export function resetExpiredScratchKey(id: string, projecttype: Objects.ProjectTypeLabel): Promise<void>
{
    const queryString = 'UPDATE scratchkeys ' +
                        'SET classifierid = $1 , ' +
                            'serviceurl = $2 , serviceusername = $3 , servicepassword = $4, ' +
                            'updated = $5 ' +
                        'WHERE classifierid = $6 AND projecttype = $7';
    const values = [
        null, null, null, null,
        new Date(),
        id, projecttype,
    ];

    return dbExecute(queryString, values)
        .then(() => { return; });
}


export function removeCredentialsFromScratchKeys(credentials: TrainingObjects.BluemixCredentials): Promise<void>
{
    const queryString = 'UPDATE scratchkeys ' +
                        'SET classifierid = $1 , ' +
                            'serviceurl = $2 , serviceusername = $3 , servicepassword = $4, ' +
                            'updated = $5 ' +
                        'WHERE serviceusername = $6 AND servicepassword = $7 AND classid = $8';
    const values = [
        null, null, null, null,
        new Date(),
        credentials.username, credentials.password, credentials.classid,
    ];

    return dbExecute(queryString, values)
        .then(() => { return; });
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

    const queryString = 'INSERT INTO scratchkeys ' +
                        '(id, projectname, projecttype, ' +
                        'serviceurl, serviceusername, servicepassword, ' +
                        'classifierid, ' +
                        'projectid, userid, classid, updated) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
    const values = [
        obj.id, project.name, project.type,
        obj.credentials && obj.credentials.url ? obj.credentials.url : '',
        obj.credentials && obj.credentials.username ? obj.credentials.username : '',
        obj.credentials && obj.credentials.password ? obj.credentials.password : '',
        obj.classifierid,
        obj.projectid, project.userid, project.classid,
        obj.updated,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
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
    const queryString = 'UPDATE scratchkeys ' +
                        'SET classifierid = $1 , ' +
                            'updated = $2, ' +
                            'serviceurl = $3 , serviceusername = $4 , servicepassword = $5 ' +
                        'WHERE id = $6 AND ' +
                            'userid = $7 AND projectid = $8 AND classid = $9';
    const values = [
        classifierid,
        timestamp,
        credentials.url, credentials.username, credentials.password,
        scratchKeyId,
        userid, projectid, classid,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
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
    const queryString = 'UPDATE scratchkeys ' +
                        'SET updated = $1 ' +
                        'WHERE userid = $2 AND projectid = $3 AND classid = $4';
    const values = [
        timestamp,
        project.userid, project.id, project.classid,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ queryString, values, response }, 'Failed to update scratchkey timestamp');
        throw new Error('Scratch key timestamp not updated');
    }
}




export async function getScratchKey(key: string): Promise<Objects.ScratchKey> {
    const queryString = 'SELECT ' +
                            'id, classid, ' +
                            'projectid, projectname, projecttype, ' +
                            'serviceurl, serviceusername, servicepassword, ' +
                            'classifierid, updated ' +
                        'FROM scratchkeys ' +
                        'WHERE id = $1';

    const response = await dbExecute(queryString, [ key ]);
    const rows = response.rows;
    if (rows.length === 1) {
        return dbobjects.getScratchKeyFromDbRow(rows[0]);
    }

    if (rows.length === 0) {
        log.warn({ key, func : 'getScratchKey' }, 'Scratch key not found');
    }
    else if (rows.length > 1) {
        /* istanbul ignore next */
        // id is a PRIMARY key, so the DB should only return 0 or 1 rows
        log.error({ rows, key, func : 'getScratchKey' }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving credentials for Scratch');
}



export async function findScratchKeys(
    userid: string, projectid: string, classid: string,
): Promise<Objects.ScratchKey[]>
{
    const queryString = 'SELECT ' +
                            'id, classid, projectid, projectname, projecttype, ' +
                            'serviceurl, serviceusername, servicepassword, ' +
                            'classifierid, updated ' +
                        'FROM scratchkeys ' +
                        'WHERE projectid = $1 AND userid = $2 AND classid = $3';

    const values = [ projectid, userid, classid ];

    const response = await dbExecute(queryString, values);
    const rows = response.rows;
    return rows.map(dbobjects.getScratchKeyFromDbRow);
}


export async function deleteScratchKey(id: string): Promise<void> {
    const queryString = 'DELETE FROM scratchkeys WHERE id = $1';

    /*const response =*/ await dbExecute(queryString, [ id ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete scratch key info');
    // }
}


export async function deleteScratchKeysByProjectId(projectid: string): Promise<void> {
    const queryString = 'DELETE FROM scratchkeys WHERE projectid = $1';

    /*const response =*/ await dbExecute(queryString, [ projectid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete scratch key info');
    // }
}


// -----------------------------------------------------------------------------
//
// KNOWN SYSTEM ERRORS
//
// -----------------------------------------------------------------------------

export async function getAllKnownErrors(): Promise<TrainingObjects.KnownError[]> {
    const queryString = 'SELECT * FROM knownsyserrors';
    const response = await dbExecute(queryString, []);
    const rows = response.rows;
    return rows.map(dbobjects.getKnownErrorFromDbRow);
}

export async function storeNewKnownError(
    type: TrainingObjects.KnownErrorCondition,
    service: TrainingObjects.BluemixServiceType,
    objectid: string,
): Promise<TrainingObjects.KnownError>
{
    const knownError = dbobjects.createKnownError(type, service, objectid);

    const queryString = 'INSERT INTO knownsyserrors ' +
        '(id, type, servicetype, objid) ' +
        'VALUES ($1, $2, $3, $4)';

    const values = [ knownError.id, knownError.type, knownError.servicetype, knownError.objid ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ response, values, knownError }, 'Failed to store known error');
        throw new Error('Failed to store known error');
    }

    return knownError;
}


// only used for unit tests
export function deleteAllKnownErrors(): Promise<void>
{
    return dbExecute('DELETE FROM knownsyserrors', [])
        .then(() => { return; });
}



// -----------------------------------------------------------------------------
//
// PENDING JOBS
//
// -----------------------------------------------------------------------------

export function deleteAllPendingJobs(): Promise<void>
{
    return dbExecute('DELETE FROM pendingjobs', [])
        .then(() => { return; });
}

async function storePendingJob(job: Objects.PendingJob): Promise<Objects.PendingJob>
{
    const queryString = 'INSERT INTO pendingjobs ' +
        '(id, jobtype, jobdata, attempts) ' +
        'VALUES ($1, $2, $3, $4)';

    const values = [
        job.id,
        job.jobtype,
        JSON.stringify(job.jobdata),
        job.attempts,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
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

    const queryString = 'UPDATE pendingjobs ' +
                            'SET attempts = $1, lastattempt = $2 ' +
                            'WHERE id = $3';
    const values = [ attempts, lastattempt, job.id ];

    const response = await dbExecute(queryString,  values);
    if (response.rowCount !== 1) {
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
    const queryString = 'DELETE from pendingjobs where id = $1';
    const values = [ job.id ];

    /*const response =*/ await dbExecute(queryString, values);
    // if (response.warningStatus !== 0) {
    //     log.error({ job, response, values }, 'Failed to delete pending job');
    //     throw new Error('Failed to delete pending job');
    // }
}

export async function getNextPendingJob(): Promise<Objects.PendingJob | undefined>
{
    const queryString = 'SELECT * from pendingjobs ORDER BY id LIMIT 1';
    const response = await dbExecute(queryString, []);
    const rows = response.rows;

    if (rows.length === 0) {
        // no more jobs to do - yay
        return undefined;
    }

    /* istanbul ignore else */
    // should never go into the else.... because the SQL says LIMIT 1!
    if (rows.length === 1) {
        // found a job to do - that's okay
        return dbobjects.getPendingJobFromDbRow(rows[0]);
    }
    else {
        log.error({ rows, func : 'getNextPendingJob' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving pending job from DB');
    }
}


// -----------------------------------------------------------------------------
//
// TENANT INFO
//
// -----------------------------------------------------------------------------


export async function storeManagedClassTenant(classid: string, numstudents: number, maxprojects: number, type: Objects.ClassTenantType): Promise<Objects.ClassTenant>
{
    const obj = dbobjects.createClassTenant(classid);
    const NUM_USERS = numstudents + 1;

    const queryString = 'INSERT INTO tenants ' +
                        '(id, projecttypes, ismanaged, ' +
                        'maxusers, maxprojectsperuser, ' +
                        'textclassifiersexpiry, imageclassifiersexpiry) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7)';

    const values = [
        obj.id, obj.projecttypes,
        type, NUM_USERS,
        maxprojects,
        obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1) {
        log.error({ response, values }, 'Failed to store managed tenant');
        throw new Error('Failed to store managed tenant');
    }
    const created = {
        id : obj.id,
        supportedProjectTypes : obj.projecttypes.split(',') as Objects.ProjectTypeLabel[],
        tenantType : type,
        maxUsers : NUM_USERS,
        maxProjectsPerUser : maxprojects,
        textClassifierExpiry : obj.textclassifiersexpiry,
        imageClassifierExpiry : obj.imageclassifiersexpiry,
    };
    return created;
}


export async function getClassTenant(classid: string): Promise<Objects.ClassTenant> {
    const queryString = 'SELECT id, projecttypes, maxusers, ' +
                               'maxprojectsperuser, ' +
                               'textclassifiersexpiry, imageclassifiersexpiry, ' +
                               'ismanaged ' +
                        'FROM tenants ' +
                        'WHERE id = $1';

    const response = await dbExecute(queryString, [ classid ]);
    const rows = response.rows;
    /* istanbul ignore else */
    if (rows.length === 0) {
        log.debug({ rows, func : 'getClassTenant' }, 'Empty response from DB');
        return dbobjects.getDefaultClassTenant(classid);
    }
    else if (rows.length === 1) {
        return dbobjects.getClassFromDbRow(rows[0]);
    }
    else {
        // id is a primary key, so it shouldn't be possible to end up here
        log.error({ rows, func : 'getClassTenant' }, 'Unexpected response from DB');
        return dbobjects.getDefaultClassTenant(classid);
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

    const queryString = 'INSERT INTO tenants ' +
                            '(id, projecttypes, ' +
                                'maxusers, maxprojectsperuser, ' +
                                'textclassifiersexpiry, imageclassifiersexpiry, ' +
                                'ismanaged) ' +
                            'VALUES ($1, $2, $3, $4, $5, $6, $7) ' +
                            'ON CONFLICT(id) DO UPDATE SET ' +
                                'textclassifiersexpiry = $8, ' +
                                'imageclassifiersexpiry = $9';

    const values = [
        obj.id, obj.projecttypes,
        obj.maxusers, obj.maxprojectsperuser,
        obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
        obj.ismanaged,
        //
        obj.textclassifiersexpiry, obj.imageclassifiersexpiry,
    ];

    const response = await dbExecute(queryString, values);
    if (response.rowCount !== 1 &&  // row inserted
        response.rowCount !== 2)    // row updated
    {
        log.error({ response, values }, 'Failed to update tenant info');
        throw new Error('Failed to update tenant info');
    }

    return modified;
}


export async function deleteClassTenant(classid: string): Promise<void> {
    const deleteQuery = 'DELETE FROM tenants WHERE id = $1';
    /*const response =*/ await dbExecute(deleteQuery, [ classid ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete class tenant');
    // }
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
                            'SELECT 1 from ' + tablename + ' ' +
                                'WHERE id = $1' +
                        ') as stringinlist';
    const response = await dbExecute(queryString, [ value ]);
    const rows = response.rows;

    return dbobjects.getAsBoolean(rows[0], 'stringinlist');
}



// -----------------------------------------------------------------------------
//
// TEMPORARY SESSION USERS
//
// -----------------------------------------------------------------------------


export function testonly_resetSessionUsersStore(): Promise<void>
{
    return dbExecute('DELETE FROM sessionusers', [])
        .then(() => { return; });
}



export async function storeTemporaryUser(lifespan: number): Promise<Objects.TemporaryUser>
{
    const obj = dbobjects.createTemporaryUser(lifespan);

    const insertUserQry = 'INSERT INTO sessionusers ' +
        '(id, token, sessionexpiry) ' +
        'VALUES ($1, $2, $3)';

    const insertUserValues = [ obj.id, obj.token, obj.sessionexpiry ];

    const response = await dbExecute(insertUserQry, insertUserValues);
    if (response.rowCount === 1) {
        return dbobjects.getTemporaryUserFromDbRow(obj);
    }
    throw new Error('Failed to store temporary user');
}

export async function getTemporaryUser(id: string): Promise<Objects.TemporaryUser | undefined>
{
    const queryString = 'SELECT id, token, sessionexpiry ' +
                        'FROM sessionusers ' +
                        'WHERE id = $1';

    const response = await dbExecute(queryString, [ id ]);
    const rows = response.rows;
    if (rows.length !== 1) {
        log.warn({ id }, 'Temporary user not found');
        return;
    }
    return dbobjects.getTemporaryUserFromDbRow(rows[0]);
}

export async function deleteTemporaryUser(user: Objects.TemporaryUser): Promise<void>
{
    const queryString = 'DELETE FROM sessionusers WHERE id = $1';

    /*const response =*/ await dbExecute(queryString, [ user.id ]);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete temporary user');
    // }
}

export async function countTemporaryUsers(): Promise<number>
{
    const queryString = 'SELECT COUNT(*) AS count FROM sessionusers';

    const response = await dbExecute(queryString, [ ]);
    const rows = response.rows;
    /* istanbul ignore if */
    // even if there are none, a SELECT COUNT(*) should return 0
    //  so we should never pass this if, but paranoia for the win
    if (rows.length !== 1) {
        log.error({ rows, func: 'countTemporaryUsers' }, 'Unexpected response from DB');
        return 0;
    }

    return rows[0].count;
}


export async function getExpiredTemporaryUsers(): Promise<Objects.TemporaryUser[]>
{
    const queryString = 'SELECT id, token, sessionexpiry ' +
                        'FROM sessionusers ' +
                        'WHERE sessionexpiry < $1 ' +
                        'LIMIT 50';

    const response = await dbExecute(queryString, [ new Date() ]);
    const rows = response.rows;
    return rows.map(dbobjects.getTemporaryUserFromDbRow);
}

export async function bulkDeleteTemporaryUsers(users: Objects.TemporaryUser[]): Promise<void>
{
    const queryPlaceholders: string[] = [];
    const ids = users.map((user, idx) => {
        queryPlaceholders.push('$' + (idx + 1));
        return user.id;
    });

    const deleteQueryString = 'DELETE FROM sessionusers WHERE id IN (' + queryPlaceholders.join(',') + ')';

    /*const response =*/ await dbExecute(deleteQueryString, ids);
    // if (response.warningStatus !== 0) {
    //     throw new Error('Failed to delete temporary users');
    // }
}



// -----------------------------------------------------------------------------
//
// SITE ALERTS
//
// -----------------------------------------------------------------------------

export function testonly_resetSiteAlertsStore(): Promise<void>
{
    return dbExecute('DELETE FROM sitealerts', [])
        .then(() => { return; });
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

    const insertAlertQry: string = 'INSERT INTO sitealerts ' +
        '(timestamp , severityid, audienceid, message, url, expiry) ' +
        'VALUES ($1, $2, $3, $4, $5, $6)';
    const insertAlertValues = [
        obj.timestamp,
        obj.severityid, obj.audienceid,
        obj.message, obj.url,
        obj.expiry,
    ];

    const response = await dbExecute(insertAlertQry, insertAlertValues);
    if (response.rowCount === 1) {
        return dbobjects.getSiteAlertFromDbRow(obj);
    }
    throw new Error('Failed to store site alert');
}


export async function getLatestSiteAlert(): Promise<Objects.SiteAlert | undefined>
{
    const queryString = 'SELECT timestamp , severityid, audienceid, message, url, expiry ' +
                        'FROM sitealerts ' +
                        'ORDER BY timestamp DESC ' +
                        'LIMIT 1';
    const response = await dbExecute(queryString, []);
    const rows = response.rows;
    /* istanbul ignore else */
    if (rows.length === 1) {
        return dbobjects.getSiteAlertFromDbRow(rows[0]);
    }
    else if (rows.length === 0) {
        return;
    }
    else {
        // LIMIT 1 in query means it shouldn't be possible to end up here
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
        const tenant = await getClassTenant(classid);
        for (const classifier of classifiers) {
            await conversation.deleteClassifier(tenant, classifier);
        }
        break;
    }
    case 'images': {
        const classifiers = await getImageClassifiers(project.id);
        const tenant = await getClassTenant(classid);
        for (const classifier of classifiers) {
            await visualrec.deleteClassifier(tenant, classifier);
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
        'DELETE FROM projects WHERE id = $1',
        'DELETE FROM numbersprojectsfields WHERE projectid = $1',
        'DELETE FROM texttraining WHERE projectid = $1',
        'DELETE FROM numbertraining WHERE projectid = $1',
        'DELETE FROM imagetraining WHERE projectid = $1',
        'DELETE FROM soundtraining WHERE projectid = $1',
        'DELETE FROM bluemixclassifiers WHERE projectid = $1',
        'DELETE FROM taxinoclassifiers WHERE projectid = $1',
        'DELETE FROM scratchkeys WHERE projectid = $1',
    ];

    // const dbConn = await dbConnPool.getConnection();
    for (const deleteQuery of deleteQueries) {
        await dbConnPool.query(deleteQuery, [ project.id ]);
    }
    // dbConn.release();
}


export async function deleteEntireUser(userid: string, classid: string): Promise<void> {
    const projects = await getProjectsOwnedByUserId(userid, classid);
    for (const project of projects) {
        await deleteEntireProject(userid, classid, project);
    }

    const deleteQueries = [
        'DELETE FROM projects WHERE userid = $1',
        'DELETE FROM bluemixclassifiers WHERE userid = $1',
        'DELETE FROM taxinoclassifiers WHERE userid = $1',
        'DELETE FROM scratchkeys WHERE userid = $1',
    ];

    // const dbConn = await dbConnPool.getConnection();
    for (const deleteQuery of deleteQueries) {
        await dbConnPool.query(deleteQuery, [ userid ]);
    }
    // dbConn.release();
}


export async function deleteClassResources(classid: string): Promise<void> {
    const deleteQueries = [
        'DELETE FROM bluemixcredentials WHERE classid = $1',
    ];

    // const dbConn = await dbConnPool.getConnection();
    for (const deleteQuery of deleteQueries) {
        await dbConnPool.query(deleteQuery, [ classid ]);
    }
    // dbConn.release();
}




// -----------------------------------------------------------------------------
// TEST AND OPS ONLY
// -----------------------------------------------------------------------------

/* istanbul ignore next */
export function getDetailedBluemixCredentialsForClass(tenantid: string): Promise<TrainingObjects.BluemixCredentialsDbRow[]>
{
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid, notes ' +
                        'FROM bluemixcredentials ' +
                        'WHERE classid = $1';
    return dbExecute(queryString, [ tenantid ])
        .then((resp) => {
            return resp.rows;
        });
}

/* istanbul ignore next */
export function moveToPool(tenantid: string): Promise<void>
{
    const queryString = 'UPDATE tenants SET ismanaged = 2 WHERE id = $1';
    return dbExecute(queryString, [ tenantid ])
        .then((resp) => {
            if (resp.rowCount === 1) {
                return;
            }
            else {
                log.error({ resp, tenantid }, 'Update failed');
                throw new Error('Something went wrong');
            }
        });
}
