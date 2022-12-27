// external dependencies
import * as pg from 'pg';
// local dependencies
import * as postgresql from './postgresqldb';
import * as dbobjects from './objects';
import * as projectObjects from './projects';
import * as Objects from './db-types';
import * as numbers from '../training/numbers';
import * as conversation from '../training/conversation';
import * as TrainingObjects from '../training/training-types';
import * as limits from './limits';
import { ONE_HOUR, ONE_DAY_PLUS_A_BIT } from '../utils/constants';
import loggerSetup from '../utils/logger';


const log = loggerSetup();

let dbConnPool: pg.Pool;

export async function init() {
    if (!dbConnPool) {
        dbConnPool = await postgresql.connect();
    }
}

export async function disconnect() {
    log.info('Disconnecting client from DB');
    if (dbConnPool) {
        await postgresql.disconnect();
        // @ts-ignore
        dbConnPool = undefined;
    }
}

export function replaceDbConnPoolForTest(testDbConnPool: pg.Pool) {
    dbConnPool = testDbConnPool;
}

function dbExecute(queryname: string, query: string, params: any[]) {
    return dbConnPool.query({ name: queryname, text: query, values: params })
        .catch((err) => {
            log.error({ queryname, query, params : params.join(','), err }, 'DB error');
            throw err;
        });
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

    const insertProjectName = 'dbqn-insert-projects';
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

    // store the project info
    const insertResponse = await dbExecute(insertProjectName, insertProjectQry, insertProjectValues);
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
    const queryName = 'dbqn-update-projects-crowdsourced';
    const queryString = 'UPDATE projects ' +
                        'SET iscrowdsourced = $1 ' +
                        'WHERE userid = $2 AND classid = $3 AND id = $4';
    const queryValues = [
        isCrowdSourced ? 1 : 0,
        userid, classid, projectid,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
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
    const queryName = 'dbqn-select-numbersprojectsfields';
    const queryString = 'SELECT id, userid, classid, projectid, name, fieldtype, choices ' +
                        'FROM numbersprojectsfields ' +
                        'WHERE userid = $1 AND classid = $2 AND projectid = $3 ' +
                        'ORDER BY id';
    const queryValues = [ userid, classid, projectid ];

    const resp = await dbExecute(queryName, queryString, queryValues);

    return resp.rows.map(dbobjects.getNumbersProjectFieldFromDbRow);
}


async function getCurrentLabels(userid: string, classid: string, projectid: string): Promise<string[]>
{
    const queryName = 'dbqn-select-projects-labels';
    const queryString = 'SELECT id, labels ' +
                        'FROM projects ' +
                        'WHERE id = $1 AND userid = $2 AND classid = $3';
    const queryValues = [ projectid, userid, classid ];

    const resp = await dbExecute(queryName, queryString, queryValues);
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

async function updateLabels(userid: string, classid: string, projectid: string, labels: string[]): Promise<any>
{
    const queryName = 'dbqn-update-projects-labels';
    const queryString = 'UPDATE projects ' +
                        'SET labels = $1 ' +
                        'WHERE id = $2 AND userid = $3 AND classid = $4';
    const queryValues = [
        dbobjects.getLabelListFromArray(labels),
        projectid,
        userid,
        classid,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
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

    // case-insentive check to see if the label is already
    //  in use, because Watson Assistant chokes on projects
    //  with labels that differ only in case
    if (labels.map(l => l.toLowerCase()).includes(newlabel.toLowerCase()) === false) {
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


export async function getProject(id: string): Promise<Objects.Project | undefined>
{
    const queryName = 'dbqn-select-projects-id';
    const queryString = 'SELECT id, userid, classid, ' +
                            'typeid, name, language, ' +
                            'labels, numfields, ' +
                            'iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE id = $1';
    const queryValues = [ id ];

    const resp = await dbExecute(queryName, queryString, queryValues);
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
export async function getProjectsOwnedByUserId(userid: string, classid: string): Promise<Objects.Project[]>
{
    const queryName = 'dbqn-select-projects-userid';
    const queryString = 'SELECT id, userid, classid, ' +
                            'typeid, name, language, ' +
                            'labels, ' +
                            'iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE classid = $1 AND userid = $2';
    const queryValues = [ classid, userid ];

    const resp = await dbExecute(queryName, queryString, queryValues);
    return resp.rows.map(dbobjects.getProjectFromDbRow);
}

/**
 * Fetches projects that the specified user is entitled to access.
 *
 * This list should include:
 *  Any projects created by the specified user
 *  Any crowd-sourced projects owned by the user the class is in.
 */
export async function getProjectsByUserId(userid: string, classid: string): Promise<Objects.Project[]>
{
    const queryName = 'dbqn-select-projects-useridorcrowd';
    const queryString = 'SELECT id, userid, classid, ' +
                            'typeid, name, language, ' +
                            'labels, ' +
                            'iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE classid = $1 AND (userid = $2 OR iscrowdsourced = True)';
    const queryValues = [ classid, userid ];

    const resp = await dbExecute(queryName, queryString, queryValues);
    return resp.rows.map(dbobjects.getProjectFromDbRow);
}


export async function countProjectsByUserId(userid: string, classid: string): Promise<number>
{
    const queryName = 'dbqn-select-projects-count';
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM projects ' +
                        'WHERE userid = $1 AND classid = $2';
    const queryValues = [ userid, classid ];

    const resp = await dbExecute(queryName, queryString, queryValues);

    /* istanbul ignore if */
    // even if there are none, a SELECT COUNT(*) should return 0
    //  so we should never pass this if, but paranoia for the win
    if (resp.rows.length !== 1) {
        log.error({ rows: resp.rows, func: 'countProjectsByUserId' }, 'Unexpected response from DB');
        return 0;
    }

    return resp.rows[0].count;
}


export async function getProjectsByClassId(classid: string): Promise<Objects.Project[]>
{
    const queryName = 'dbqn-select-projects-classid';
    const queryString = 'SELECT id, userid, classid, typeid, name, labels, language, iscrowdsourced ' +
                        'FROM projects ' +
                        'WHERE classid = $1';
    const queryValues = [ classid ];

    const resp = await dbExecute(queryName, queryString, queryValues);
    return resp.rows.map(dbobjects.getProjectFromDbRow);
}


export async function deleteProjectsByClassId(classid: string): Promise<void>
{
    const queryName = 'dbqn-delete-projects-classid';
    const queryString = 'DELETE FROM projects WHERE classid = $1';
    const queryValues = [ classid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
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
    case 'imgtfjs':
        return 'imagetraining';
    case 'sounds':
        return 'soundtraining';
    }
}


export async function countTraining(type: Objects.ProjectTypeLabel, projectid: string): Promise<number>
{
    const dbTable = getDbTable(type);

    const queryName = 'dbqn-count-training-project-' + dbTable;
    const queryString = 'SELECT COUNT(*) AS trainingcount FROM ' + dbTable + ' WHERE projectid = $1';
    const queryValues = [ projectid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows[0].trainingcount;
}


export async function countTrainingByLabel(project: Objects.Project)
    : Promise<{ [label: string]: number }>
{
    const dbTable = getDbTable(project.type);

    const queryName = 'dbqn-count-training-label-' + dbTable;
    const queryString = 'SELECT label, COUNT(*) AS trainingcount FROM ' + dbTable + ' ' +
                        'WHERE projectid = $1 ' +
                        'GROUP BY label';
    const queryValues = [ project.id ];

    const resp = await dbExecute(queryName, queryString, queryValues);

    const counts: { [label: string]: number } = {};
    for (const count of resp.rows) {
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

    const queryName = 'dbqn-update-training-label-' + dbTable;
    const queryString = 'UPDATE ' + dbTable + ' ' +
                        'SET label = $1 ' +
                        'WHERE projectid = $2 AND label = $3';
    const queryValues = [ labelAfter, projectid, labelBefore ];

    await dbExecute(queryName, queryString, queryValues);
}


export async function deleteTraining(
    type: Objects.ProjectTypeLabel,
    projectid: string, trainingid: string,
): Promise<void>
{
    const dbTable = getDbTable(type);

    const queryName = 'dbqn-delete-training-' + dbTable;
    const queryString = 'DELETE FROM ' + dbTable + ' WHERE id = $1 AND projectid = $2';
    const queryValues = [ trainingid, projectid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete training');
    }
}


async function deleteTrainingLabel(
    type: Objects.ProjectTypeLabel,
    projectid: string, label: string,
): Promise<void>
{
    const dbTable = getDbTable(type);

    const queryName = 'dbqn-delete-training-label-' + dbTable;
    const queryString = 'DELETE FROM ' + dbTable + ' WHERE projectid = $1 AND label = $2';
    const queryValues = [ projectid, label ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete label');
    }
}


export async function deleteTrainingByProjectId(type: Objects.ProjectTypeLabel, projectid: string): Promise<void>
{
    const dbTable = getDbTable(type);

    const queryName = 'dbqn-delete-training-projectid-' + dbTable;
    const queryString = 'DELETE FROM ' + dbTable + ' WHERE projectid = $1';
    const queryValues = [ projectid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
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

    const countName = 'dbqn-select-count-texttraining';
    const countQry = 'SELECT COUNT(*) AS trainingcount FROM texttraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertName = 'dbqn-insert-texttraining';
    const insertQry = 'INSERT INTO texttraining (id, projectid, textdata, label) VALUES ($1, $2, $3, $4)';
    const insertValues = [ obj.id, obj.projectid, obj.textdata, obj.label ];

    // count how much training data they already have
    const countResponse = await dbExecute(countName, countQry, countValues);
    const count = countResponse.rows[0].trainingcount;

    if (count >= limits.getStoreLimits().textTrainingItemsPerProject) {
        // they already have too much data - nothing else to do
        outcome = InsertTrainingOutcome.NotStored_MetLimit;
    }
    else {
        // they haven't hit their limit - okay to do the INSERT now
        const insertResponse = await dbExecute(insertName, insertQry, insertValues);
        if (insertResponse.rowCount === 1) {
            outcome = InsertTrainingOutcome.StoredOk;
        }
        else {
            // insert failed for no clear reason
            log.error({ projectid, data, label, insertQry, insertValues, insertResponse }, 'INSERT text failure');
            outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
        }
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

    const response = await dbConnPool.query(queryString, queryParameterValues);

    if (response.rowCount === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}



export async function getTextTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryName = 'dbqn-select-texttraining';
    const queryString = 'SELECT id, textdata, label FROM texttraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label, id ' +
                        'LIMIT $2 OFFSET $3';
    const queryValues = [ projectid, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getTextTrainingFromDbRow);
}


export async function getTextTrainingByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<Objects.TextTraining[]>
{
    const queryName = 'dbqn-select-texttraining-label';
    const queryString = 'SELECT id, textdata, label FROM texttraining ' +
                        'WHERE projectid = $1 AND label = $2 ' +
                        'ORDER BY textdata ' +
                        'LIMIT $3 OFFSET $4';
    const queryValues = [ projectid, label, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getTextTrainingFromDbRow);
}

export async function getUniqueTrainingTextsByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<string[]>
{
    const queryName = 'dbqn-select-texttraining-distinct';
    // Watson Assistant chokes on (case insensitive) duplicate texts, so
    //  we're using DISTINCT to avoid that
    const queryString = 'SELECT DISTINCT ON (LOWER(textdata)) textdata FROM texttraining ' +
                        'WHERE projectid = $1 AND label = $2 ' +
                        'LIMIT $3 OFFSET $4';
    const queryValues = [ projectid, label, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
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

    const countName = 'dbqn-select-count-imagetraining';
    const countQry = 'SELECT COUNT(*) AS trainingcount FROM imagetraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertName = 'dbqn-insert-imagetraining';
    const insertQry = 'INSERT INTO imagetraining ' +
                        '(id, projectid, imageurl, label, isstored) ' +
                        'VALUES ($1, $2, $3, $4, $5)';
    const insertValues = [ obj.id, obj.projectid, obj.imageurl, obj.label, obj.isstored ];

    // count how much training data they already have
    const countResponse = await dbExecute(countName, countQry, countValues);
    const count = countResponse.rows[0].trainingcount;

    if (count >= limits.getStoreLimits().imageTrainingItemsPerProject) {
        // they already have too much data - nothing else to do
        outcome = InsertTrainingOutcome.NotStored_MetLimit;
    }
    else {
        // they haven't hit their limit - okay to do the INSERT now
        const insertResponse = await dbExecute(insertName, insertQry, insertValues);
        if (insertResponse.rowCount === 1) {
            outcome = InsertTrainingOutcome.StoredOk;
        }
        else {
            // insert failed for no clear reason
            outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
        }
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

    const response = await dbConnPool.query(queryString, queryParameterValues);

    if (response.rowCount === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}


export async function getImageTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryName = 'dbqn-select-imagetraining';
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label, imageurl ' +
                        'LIMIT $2 OFFSET $3';
    const queryValues = [ projectid, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function getImageTrainingItem(projectid: string, trainingid: string): Promise<Objects.ImageTraining>
{
    const queryName = 'dbqn-select-imagetraining-item';
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 AND id = $2 ' +
                        'LIMIT 1000';
    const queryValues = [ projectid, trainingid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;

    if (rows.length !== 1) {
        log.error({
            projectid, trainingid,
            func : 'getImageTrainingItem',
        }, 'Training item not found');

        throw new Error('Training data not found');
    }
    return dbobjects.getImageTrainingFromDbRow(response.rows[0]);
}



export async function getImageTrainingByLabel(
    projectid: string, label: string, options: Objects.PagingOptions,
): Promise<Objects.ImageTraining[]>
{
    const queryName = 'dbqn-select-imagetraining-label';
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 AND label = $2 ' +
                        'LIMIT $3 OFFSET $4';
    const queryValues = [ projectid, label, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function getStoredImageTraining(projectid: string, label: string): Promise<Objects.ImageTraining[]>
{
    const queryName = 'dbqn-select-imagetraining-stored';
    const queryString = 'SELECT id, imageurl, label, isstored FROM imagetraining ' +
                        'WHERE projectid = $1 AND label = $2 AND isstored = $3 ' +
                        'LIMIT 1000';
    const queryValues = [ projectid, label, true ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getImageTrainingFromDbRow);
}

export async function isImageStored(imageid: string): Promise<boolean>
{
    const queryName = 'dbqn-select-imagetraining-isstored';
    const queryString = 'SELECT isstored FROM imagetraining WHERE id = $1';
    const queryValues = [ imageid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rows.length > 0) {
        return response.rows[0].isstored;
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

    const countName = 'dbqn-select-count-numbertraining';
    const countQry = 'SELECT COUNT(*) AS trainingcount FROM numbertraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertName = 'dbqn-insert-numbertraining';
    const insertQry = 'INSERT INTO numbertraining ' +
                      '(id, projectid, numberdata, label) VALUES ($1, $2, $3, $4)';
    const insertValues = [ obj.id, obj.projectid, data.join(','), obj.label ];


    // count how much training data they already have
    const countResponse = await dbExecute(countName, countQry, countValues);
    const count = countResponse.rows[0].trainingcount;

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
        const insertResponse = await dbExecute(insertName, insertQry, insertValues);
        if (insertResponse.rowCount === 1) {
            outcome = InsertTrainingOutcome.StoredOk;
        }
        else {
            // insert failed for no clear reason
            outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
        }
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

    const response = await dbConnPool.query(queryString, queryParameterValues);

    if (response.rowCount === training.length) {
        return;
    }
    throw new Error('Failed to store training data');
}


export async function getNumberTraining(
    projectid: string, options: Objects.PagingOptions,
): Promise<Objects.NumberTraining[]>
{
    const queryName = 'dbqn-select-numbertraining';
    const queryString = 'SELECT id, numberdata, label FROM numbertraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label ' +
                        'LIMIT $2 OFFSET $3';
    const queryValues = [ projectid, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getNumberTrainingFromDbRow);
}






export async function storeSoundTraining(
    projectid: string, audiourl: string, label: string, audioid: string,
): Promise<Objects.SoundTraining>
{
    let outcome: InsertTrainingOutcome;

    // prepare the data to be stored
    const obj = dbobjects.createSoundTraining(projectid, audiourl, label, audioid);

    // prepare the DB queries
    const countName = 'dbqn-select-count-soundtraining';
    const countQry = 'SELECT COUNT(*) AS trainingcount from soundtraining WHERE projectid = $1';
    const countValues = [ projectid ];

    const insertName = 'dbqn-insert-soundtraining';
    const insertQry = 'INSERT INTO soundtraining (id, projectid, audiourl, label) VALUES ($1, $2, $3, $4)';
    const insertValues = [ obj.id, obj.projectid, obj.audiourl, obj.label ];

    // store the data unless the project is already full

    // count the number of training items already in the project
    const countResponse = await dbExecute(countName, countQry, countValues);
    const count = countResponse.rows[0].trainingcount;

    if (count >= limits.getStoreLimits().soundTrainingItemsPerProject) {
        // they already have too much data - nothing else to do
        outcome = InsertTrainingOutcome.NotStored_MetLimit;
    }
    else {
        // they haven't reached their limit yet - okay to INSERT
        const insertResponse = await dbExecute(insertName, insertQry, insertValues);
        if (insertResponse.rowCount === 1) {
            outcome = InsertTrainingOutcome.StoredOk;
        }
        else {
            // insert failed for an unknown reason
            outcome = InsertTrainingOutcome.NotStored_UnknownFailure;
        }
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
    const queryName = 'dbqn-select-soundtraining';
    const queryString = 'SELECT id, audiourl, label FROM soundtraining ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY label, id ' +
                        'LIMIT $2 OFFSET $3';
    const queryValues = [ projectid, options.limit, options.start ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getSoundTrainingFromDbRow);
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
    const queryName = 'dbqn-insert-bluemixcredentials';
    const queryString = 'INSERT INTO bluemixcredentials ' +
                        '(id, classid, servicetype, url, username, password, credstypeid, notes) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';

    const queryValues = [ credentials.id, classid,
        credentials.servicetype, credentials.url, credentials.username, credentials.password,
        credentials.credstypeid,
        credentials.notes ? credentials.notes : null ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount === 1) {
        return dbobjects.getCredentialsFromDbRow(credentials);
    }
    throw new Error('Failed to store credentials');
}

export async function storeBluemixCredentialsPool(
    credentials: TrainingObjects.BluemixCredentialsPoolDbRow,
): Promise<TrainingObjects.BluemixCredentials>
{
    const queryName = 'dbqn-insert-bluemixcredentialspool';
    const queryString = 'INSERT INTO bluemixcredentialspool ' +
                        '(id, servicetype, url, username, password, credstypeid, notes, lastfail) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';

    const queryValues = [ credentials.id,
        credentials.servicetype, credentials.url, credentials.username, credentials.password,
        credentials.credstypeid, credentials.notes,
        credentials.lastfail,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
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

    const queryName = 'dbqn-update-bluemixcredentials-type';
    const queryString = 'UPDATE bluemixcredentials ' +
                        'SET credstypeid = $1 ' +
                        'WHERE id = $2 AND servicetype = $3 AND classid = $4';
    const queryValues = [ credstypeObj.id, credentialsid, servicetype, classid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ queryString, queryValues, response }, 'Failed to update credentials');
        throw new Error('Bluemix credentials not updated');
    }
}


export async function getAllBluemixCredentials(
    service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryName = 'dbqn-select-bluemixcredentials-all';
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                        'FROM bluemixcredentials ' +
                        'WHERE servicetype = $1 ' +
                        'LIMIT 2000';
    const queryValues = [ service ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getCredentialsFromDbRow);
}


export async function getBluemixCredentials(
    tenant: Objects.ClassTenant, service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryName = 'dbqn-select-bluemixcredentials-classid';
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                        'FROM bluemixcredentials ' +
                        'WHERE classid = $1 AND servicetype = $2';
    const queryValues = [ tenant.id, service ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rows.length === 0) {
        log.warn({ rows: response.rows, func : 'getBluemixCredentials' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return response.rows.map(dbobjects.getCredentialsFromDbRow);
}

export async function getBluemixCredentialsPoolBatch(
    service: TrainingObjects.BluemixServiceType,
): Promise<TrainingObjects.BluemixCredentials[]>
{
    const queryName = 'dbqn-select-bluemixcredentialspool-batch';
    const queryString = 'SELECT id, servicetype, url, username, password, credstypeid, lastfail ' +
                        'FROM bluemixcredentialspool ' +
                        'WHERE servicetype = $1 ' +
                        'ORDER BY lastfail ' +
                        'LIMIT 100';
    const queryValues = [ service ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rows.length === 0) {
        log.warn({ rows: response.rows, func : 'getBluemixCredentialsPoolBatch' }, 'Unexpected response from DB');
        throw new Error('Unexpected response when retrieving service credentials');
    }
    return response.rows.map(dbobjects.getCredentialsPoolFromDbRow);
}

export function recordBluemixCredentialsPoolFailure(credentials: TrainingObjects.BluemixCredentialsPool): Promise<TrainingObjects.BluemixCredentialsPool>
{
    let updatedTimestamp: Date;
    if (credentials.lastfail) {
        updatedTimestamp = new Date(credentials.lastfail.getTime() + ONE_DAY_PLUS_A_BIT);
    }
    else {
        log.error({ credentials }, 'Missing timestamp for credentials, defaulting to now');
        updatedTimestamp = new Date();
    }
    return updateBluemixCredentialsPoolTimestamp(credentials, updatedTimestamp);
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

    const queryName = 'dbqn-update-bluemixcredentialspool-lastfail';
    const queryString = 'UPDATE bluemixcredentialspool ' +
                            'SET lastfail = $1 ' +
                            'WHERE id = $2';
    const queryValues = [ credentials.lastfail, credentials.id ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({
            credentials, queryString, queryValues, response,
        }, 'Failed to update failure date');
    }

    return credentials;
}

export async function getCombinedBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    const queryName = 'dbqn-select-bluemixcredentials-combined';
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                           'FROM bluemixcredentials ' +
                           'WHERE id = $1 ' +
                       'UNION ' +
                       'SELECT id, \'managedpooluse\' as classid, servicetype, url, username, password, credstypeid ' +
                           'FROM bluemixcredentialspool ' +
                           'WHERE id = $1';
    const queryValues = [ credentialsid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;

    if (rows.length === 1) {
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }
    if (rows.length === 2) {
        log.error({
            credentialsid, queryString, rows,
            func : 'getCombinedBluemixCredentialsById',
        }, 'Credentials stored in multiple tables');
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({
            credentialsid, queryString, rows,
            func : 'getCombinedBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        // id is a PRIMARY key, so the DB shouldn't be able to return a different number of rows
        log.error({
            credentialsid, queryString, rows,
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

async function getClassBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    const queryName = 'dbqn-select-bluemixcredentials-id';
    const queryString = 'SELECT id, classid, servicetype, url, username, password, credstypeid ' +
                       'FROM bluemixcredentials ' +
                       'WHERE id = $1';
    const queryValues = [ credentialsid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;

    if (rows.length === 1) {
        return dbobjects.getCredentialsFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({
            credentialsid, queryString, rows,
            func : 'getClassBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        // id is a PRIMARY key, so the DB should only return 0 or 1 rows
        log.error({
            credentialsid, queryString, rows,
            func : 'getClassBluemixCredentialsById',
        }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving the service credentials');
}

async function getPoolBluemixCredentialsById(credentialsid: string): Promise<TrainingObjects.BluemixCredentials>
{
    const queryName = 'dbqn-select-bluemixcredentialspool-id';
    const queryString = 'SELECT id, servicetype, url, username, password, credstypeid, lastfail ' +
                        'FROM bluemixcredentialspool ' +
                        'WHERE id = $1';
    const queryValues = [ credentialsid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;

    if (rows.length === 1) {
        return dbobjects.getCredentialsPoolFromDbRow(rows[0]);
    }

    /* istanbul ignore else */
    if (rows.length === 0) {
        log.warn({
            credentialsid, queryString, rows,
            func : 'getPoolBluemixCredentialsById',
        }, 'Credentials not found');
    }
    else {
        // id is a PRIMARY key, so the DB should only return 0 or 1 rows
        log.error({
            credentialsid, queryString, rows,
            func : 'getPoolBluemixCredentialsById',
        }, 'Unexpected response from DB');
    }
    throw new Error('Unexpected response when retrieving service credentials');
}


export async function countBluemixCredentialsByType(classid: string): Promise<{ conv: number }>
{
    const queryName = 'dbqn-select-bluemixcredentials-counttype';
    const queryString = 'SELECT servicetype, credstypeid, count(*) as count ' +
                        'FROM bluemixcredentials ' +
                        'WHERE classid = $1 ' +
                        'GROUP BY servicetype, credstypeid';
    const queryValues = [ classid ];

    const response = await dbExecute(queryName, queryString, queryValues);

    const counts = { conv : 0 };
    for (const row of response.rows) {
        if (row.servicetype === 'conv') {
            if (row.credstypeid === projectObjects.credsTypesByLabel.conv_standard.id) {
                counts.conv += (20 * row.count);
            }
            else {
                counts.conv += (5 * row.count);
            }
        }
        else {
            log.error({ row, classid }, 'Unexpected bluemix service type found in DB');
        }
    }

    return counts;
}


export async function countGlobalBluemixCredentials():
    Promise<{ [classid: string]: { conv: number, total: number } }>
{
    const queryName = 'dbqn-select-bluemixcredentials-counttype-group';
    const queryString = 'SELECT classid, ' +
                            'sum(case when servicetype = \'conv\' then 1 else 0 end) conv ' +
                        'FROM bluemixcredentials ' +
                        'GROUP BY classid';
    const queryValues: any[] = [];

    const response = await dbExecute(queryName, queryString, queryValues);

    const counts: { [classid: string]: { conv: number, total: number } } = {};
    for (const row of response.rows) {
        const conv = parseInt(row.conv, 10);
        const total = conv;
        counts[row.classid] = { conv, total };
    }
    return counts;
}


export async function deleteBluemixCredentials(credentialsid: string): Promise<void>
{
    const queryName = 'dbqn-delete-bluemixcredentials-id';
    const queryString = 'DELETE FROM bluemixcredentials WHERE id = $1';
    const queryValues = [ credentialsid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete credentials info');
    }
}

export async function deleteBluemixCredentialsPool(credentialsid: string): Promise<void>
{
    const queryName = 'dbqn-delete-bluemixcredentialspool-id';
    const queryString = 'DELETE FROM bluemixcredentialspool WHERE id = $1';
    const queryValues = [ credentialsid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete credentials info');
    }
}

export function deleteBluemixCredentialsPoolForTests(): Promise<void> {
    // ensure this function is only used in tests, so we don't
    //  accidentally trash a production database table
    if (process.env.POSTGRESQLHOST === 'localhost' || process.env.POSTGRESQLHOST === 'host.docker.internal') {
        const queryName = 'dbqn-delete-bluemixcredentialspool-all';
        const queryString = 'DELETE FROM bluemixcredentialspool';
        const queryValues: any[] = [];

        return dbExecute(queryName, queryString, queryValues)
            .then(() => { return; });
    }
    else {
        log.error('deleteBluemixCredentialsPoolForTests called on production system');
        return Promise.resolve();
    }
}


export async function deleteClassifiersByCredentials(credentials: TrainingObjects.BluemixCredentials): Promise<void>
{
    const queryName = 'dbqn-delete-bluemixclassifiers-credsid';
    const queryString = 'DELETE FROM bluemixclassifiers WHERE credentialsid = $1';
    const queryValues = [ credentials.id ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete classifiers info');
    }
}


export async function getNumbersClassifiers(projectid: string): Promise<TrainingObjects.NumbersClassifier[]>
{
    const queryName = 'dbqn-select-taxinoclassifiers-projectid';
    const queryString = 'SELECT projectid, userid, classid, ' +
                        'created, status ' +
                        'FROM taxinoclassifiers ' +
                        'WHERE projectid = $1';
    const queryValues = [ projectid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getNumbersClassifierFromDbRow);
}

export async function getConversationWorkspaces(
    projectid: string,
): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const queryName = 'dbqn-select-bluemixclassifiers-projectid';
    const queryString = 'SELECT id, credentialsid, projectid, servicetype, ' +
                            'classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE projectid = $1 ' +
                        'ORDER BY created';
    const queryValues = [ projectid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getWorkspaceFromDbRow);
}

export async function getConversationWorkspace(
    projectid: string, classifierid: string,
): Promise<TrainingObjects.ConversationWorkspace>
{
    const queryName = 'dbqn-select-bluemixclassifieirs-classifierid';
    const queryString = 'SELECT id, credentialsid, projectid, servicetype, ' +
                            'classifierid, url, name, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE projectid = $1 AND classifierid = $2';
    const queryValues = [ projectid, classifierid ];

    const response = await dbExecute(queryName, queryString, queryValues);
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


export async function countConversationWorkspaces(classid: string): Promise<number>
{
    const queryName = 'dbqn-select-bluemixclassifiers-countclass';
    const queryString = 'SELECT COUNT(*) AS count ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE classid = $1';
    const queryValues = [ classid ];

    const response = await dbExecute(queryName, queryString, queryValues);
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

    const queryName = 'dbqn-insert-bluemixclassifiers';
    const queryString = 'INSERT INTO bluemixclassifiers ' +
                            '(id, credentialsid, ' +
                             'projectid, userid, classid, ' +
                             'servicetype, ' +
                             'classifierid, url, name, language, ' +
                             'created, expiry) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)';
    const queryValues = [ obj.id, obj.credentialsid,
        obj.projectid, obj.userid, obj.classid,
        obj.servicetype,
        obj.classifierid, obj.url, obj.name, obj.language,
        obj.created, obj.expiry ];

    const response = await dbExecute(queryName, queryString, queryValues);
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
    const queryName = 'dbqn-update-bluemixclassifiers-expiry';
    const queryString = 'UPDATE bluemixclassifiers ' +
                                'SET created = $1, expiry = $2 ' +
                                'WHERE id = $3';
    const queryValues = [ workspace.created, workspace.expiry, workspace.id ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ queryString, queryValues, response }, 'Failed to update expiry date');
        throw new Error('Conversation Workspace expiry not updated');
    }
}

export async function getExpiredConversationWorkspaces(): Promise<TrainingObjects.ConversationWorkspace[]>
{
    const queryName = 'dbqn-select-bluemixclassifiers-expired';
    const queryString = 'SELECT id, credentialsid, projectid, servicetype, ' +
                            'classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE expiry < $1 AND servicetype = $2';
    const queryValues = [ new Date(), 'conv' ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getWorkspaceFromDbRow);
}


export async function storeNumbersClassifier(
    userid: string, classid: string, projectid: string, status: TrainingObjects.NumbersStatus,
): Promise<TrainingObjects.NumbersClassifier>
{
    const obj = dbobjects.createNumbersClassifier(userid, classid, projectid, status);

    const queryName = 'dbqn-insert-taxinoclassifiers';
    const queryString: string = 'INSERT INTO taxinoclassifiers ' +
                                    '(projectid, userid, classid, created, status) ' +
                                'VALUES ' +
                                    '($1, $2, $3, $4, $5) ' +
                                'ON CONFLICT (projectid) DO UPDATE SET ' +
                                    'userid = $2, classid = $3, created = $4, status = $5';
    const queryValues = [ obj.projectid, obj.userid, obj.classid, obj.created, obj.status ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to store classifier');
    }

    return dbobjects.getNumbersClassifierFromDbRow(obj);
}



export async function deleteConversationWorkspace(id: string): Promise<void>
{
    const queryName = 'dbqn-delete-bluemixclassifiers-id';
    const queryString = 'DELETE FROM bluemixclassifiers WHERE id = $1 AND servicetype = $2';
    const queryValues = [ id, 'conv' ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete classifiers info');
    }
}


export async function deleteConversationWorkspacesByProjectId(projectid: string): Promise<void>
{
    const queryName = 'dbqn-delete-bluemixclassifiers-projectid';
    const queryString = 'DELETE FROM bluemixclassifiers WHERE projectid = $1';
    const queryValues = [ projectid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete classifiers info');
    }
}



export async function getProjectsWithBluemixClassifiers(classid: string): Promise<{[projectid: string]: string}>
{
    const queryName = 'dbqn-select-bluemixclassifiers-projectclassifierid';
    const queryString = 'SELECT projectid, classifierid FROM bluemixclassifiers WHERE classid = $1';
    const queryValues = [ classid ];

    const projects: {[projectid: string]: string} = {};

    const response = await dbExecute(queryName, queryString, queryValues);
    response.rows.forEach((row: any) => {
        projects[row.projectid] = row.classifierid;
    });

    return projects;
}




export async function getClassifierByBluemixId(classifierid: string):
    Promise<TrainingObjects.ConversationWorkspace|undefined>
{
    const queryName = 'dbqn-select-bluemixclassifiers-classifierid';
    const queryString = 'SELECT id, credentialsid, projectid, servicetype, ' +
                            'classifierid, url, name, language, created, expiry ' +
                        'FROM bluemixclassifiers ' +
                        'WHERE classifierid = $1';
    const queryValues = [ classifierid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;
    if (rows.length === 0) {
        return;
    }
    else if (rows.length === 1) {
        const classifierType: TrainingObjects.BluemixServiceType = rows[0].servicetype;
        switch (classifierType) {
        case 'conv':
            return dbobjects.getWorkspaceFromDbRow(rows[0]);
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

    const queryName = 'dbqn-insert-scratchkeys-small';
    const queryString = 'INSERT INTO scratchkeys ' +
                        '(id, ' +
                            'projectid, projectname, projecttype, ' +
                            'userid, classid, updated) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7)';
    const queryValues = [
        obj.id,
        project.id, obj.name, obj.type,
        project.userid, project.classid, obj.updated,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ response }, 'Failed to store Scratch key');
        throw new Error('Failed to store Scratch key');
    }

    return obj.id;
}



export function resetExpiredScratchKey(id: string, projecttype: Objects.ProjectTypeLabel): Promise<void>
{
    const queryName = 'dbqn-update-scratchkeys-expired';
    const queryString = 'UPDATE scratchkeys ' +
                        'SET classifierid = $1 , ' +
                            'serviceurl = $2 , serviceusername = $3 , servicepassword = $4, ' +
                            'updated = $5 ' +
                        'WHERE classifierid = $6 AND projecttype = $7';
    const queryValues = [
        null, null, null, null,
        new Date(),
        id, projecttype,
    ];

    return dbExecute(queryName, queryString, queryValues)
        .then(() => { return; });
}


export function removeCredentialsFromScratchKeys(credentials: TrainingObjects.BluemixCredentials): Promise<void>
{
    const queryName = 'dbqn-update-scratchkeys-remove';
    const queryString = 'UPDATE scratchkeys ' +
                        'SET classifierid = $1 , ' +
                            'serviceurl = $2 , serviceusername = $3 , servicepassword = $4, ' +
                            'updated = $5 ' +
                        'WHERE serviceusername = $6 AND servicepassword = $7 AND classid = $8';
    const queryValues = [
        null, null, null, null,
        new Date(),
        credentials.username, credentials.password, credentials.classid,
    ];

    return dbExecute(queryName, queryString, queryValues)
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

    const queryName = 'dbqn-insert-scratchkeys-full';
    const queryString = 'INSERT INTO scratchkeys ' +
                        '(id, projectname, projecttype, ' +
                            'serviceurl, serviceusername, servicepassword, ' +
                            'classifierid, ' +
                            'projectid, userid, classid, updated) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
    const queryValues = [
        obj.id, project.name, project.type,
        obj.credentials && obj.credentials.url ? obj.credentials.url : '',
        obj.credentials && obj.credentials.username ? obj.credentials.username : '',
        obj.credentials && obj.credentials.password ? obj.credentials.password : '',
        obj.classifierid,
        obj.projectid, project.userid, project.classid,
        obj.updated,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ response, queryString, queryValues }, 'Failed to store Scratch key');
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
    const queryName = 'dbqn-update-scratchkeys-full';
    const queryString = 'UPDATE scratchkeys ' +
                        'SET classifierid = $1 , ' +
                            'updated = $2, ' +
                            'serviceurl = $3 , serviceusername = $4 , servicepassword = $5 ' +
                        'WHERE id = $6 AND ' +
                            'userid = $7 AND projectid = $8 AND classid = $9';
    const queryValues = [
        classifierid,
        timestamp,
        credentials.url, credentials.username, credentials.password,
        scratchKeyId,
        userid, projectid, classid,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ queryString, queryValues, response }, 'Failed to update scratchkey');
        throw new Error('Scratch key not updated');
    }

    return scratchKeyId;
}




export async function updateScratchKeyTimestamp(
    project: Objects.Project,
    timestamp: Date,
): Promise<void>
{
    const queryName = 'dbqn-update-scratchkeys-timestamp';
    const queryString = 'UPDATE scratchkeys ' +
                        'SET updated = $1 ' +
                        'WHERE userid = $2 AND projectid = $3 AND classid = $4';
    const queryValues = [
        timestamp,
        project.userid, project.id, project.classid,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ queryString, queryValues, response }, 'Failed to update scratchkey timestamp');
        throw new Error('Scratch key timestamp not updated');
    }
}




export async function getScratchKey(key: string): Promise<Objects.ScratchKey>
{
    const queryName = 'dbqn-select-scratchkeys-id';
    const queryString = 'SELECT ' +
                            'id, classid, ' +
                            'projectid, projectname, projecttype, ' +
                            'serviceurl, serviceusername, servicepassword, ' +
                            'classifierid, updated ' +
                        'FROM scratchkeys ' +
                        'WHERE id = $1';
    const queryValues = [ key ];

    const response = await dbExecute(queryName, queryString, queryValues);
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
    const queryName = 'dbqn-select-scratchkeys';
    const queryString = 'SELECT ' +
                            'id, classid, projectid, projectname, projecttype, ' +
                            'serviceurl, serviceusername, servicepassword, ' +
                            'classifierid, updated ' +
                        'FROM scratchkeys ' +
                        'WHERE projectid = $1 AND userid = $2 AND classid = $3';
    const queryValues = [ projectid, userid, classid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;
    return rows.map(dbobjects.getScratchKeyFromDbRow);
}


export async function deleteScratchKey(id: string): Promise<void>
{
    const queryName = 'dbqn-delete-scratchkeys-id';
    const queryString = 'DELETE FROM scratchkeys WHERE id = $1';
    const queryValues = [ id ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete scratch key info');
    }
}


export async function deleteScratchKeysByProjectId(projectid: string): Promise<void>
{
    const queryName = 'dbqn-delete-scratchkeys-projectid';
    const queryString = 'DELETE FROM scratchkeys WHERE projectid = $1';
    const queryValues = [ projectid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete scratch key info');
    }
}


// -----------------------------------------------------------------------------
//
// KNOWN SYSTEM ERRORS
//
// -----------------------------------------------------------------------------

export async function getAllKnownErrors(): Promise<TrainingObjects.KnownError[]>
{
    const queryName = 'dbqn-select-knownsyserrors';
    const queryString = 'SELECT * FROM knownsyserrors';
    const queryValues: any[] = [];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getKnownErrorFromDbRow);
}

export async function storeNewKnownError(
    type: TrainingObjects.KnownErrorCondition,
    service: TrainingObjects.BluemixServiceType,
    objectid: string,
): Promise<TrainingObjects.KnownError>
{
    const knownError = dbobjects.createKnownError(type, service, objectid);

    const queryName = 'dbqn-insert-knownsyserrors';
    const queryString = 'INSERT INTO knownsyserrors ' +
        '(id, type, servicetype, objid) ' +
        'VALUES ($1, $2, $3, $4)';
    const queryValues = [ knownError.id, knownError.type, knownError.servicetype, knownError.objid ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ response, queryValues, knownError }, 'Failed to store known error');
        throw new Error('Failed to store known error');
    }

    return knownError;
}


// only used for unit tests
export function deleteAllKnownErrors(): Promise<void>
{
    // ensure this function is only used in tests, so we don't
    //  accidentally trash a production database table
    /* istanbul ignore else */
    if (process.env.POSTGRESQLHOST === 'localhost' || process.env.POSTGRESQLHOST === 'host.docker.internal') {
        const queryName = 'dbqn-delete-knownsyserrors-all';
        const queryString = 'DELETE FROM knownsyserrors';
        const queryValues: any[] = [];

        return dbExecute(queryName, queryString, queryValues)
            .then(() => { return; });
    }
    else {
        log.error('deleteAllKnownErrors called on production system');
        return Promise.resolve();
    }
}



// -----------------------------------------------------------------------------
//
// PENDING JOBS
//
// -----------------------------------------------------------------------------

// only used for unit tests
export function deleteAllPendingJobs(): Promise<void>
{
    // ensure this function is only used in tests, so we don't
    //  accidentally trash a production database table
    /* istanbul ignore else */
    if (process.env.POSTGRESQLHOST === 'localhost' || process.env.POSTGRESQLHOST === 'host.docker.internal') {
        const queryName = 'dbqn-delete-pendingjobs-all';
        const queryString = 'DELETE FROM pendingjobs';
        const queryValues: any[] = [];

        return dbExecute(queryName, queryString, queryValues)
            .then(() => { return; });
    }
    else {
        log.error('deleteAllPendingJobs called on production system');
        return Promise.resolve();
    }
}

async function storePendingJob(job: Objects.PendingJob): Promise<Objects.PendingJob>
{
    const queryName = 'dbqn-insert-pendingjobs';
    const queryString = 'INSERT INTO pendingjobs ' +
                        '(id, jobtype, jobdata, attempts) ' +
                        'VALUES ($1, $2, $3, $4)';
    const queryValues = [
        job.id,
        job.jobtype,
        JSON.stringify(job.jobdata),
        job.attempts,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
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

    const queryName = 'dbqn-update-pendingjobs';
    const queryString = 'UPDATE pendingjobs ' +
                            'SET attempts = $1, lastattempt = $2 ' +
                            'WHERE id = $3';
    const queryValues = [ attempts, lastattempt, job.id ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ queryString, queryValues, job }, 'Failed to update pending job');
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
    const queryName = 'dbqn-delete-pendingjobs-id';
    const queryString = 'DELETE from pendingjobs where id = $1';
    const queryValues = [ job.id ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        log.error({ job, queryValues }, 'Failed to delete pending job');
        throw new Error('Failed to delete pending job');
    }
}

export async function getNextPendingJob(): Promise<Objects.PendingJob | undefined>
{
    const queryName = 'dbqn-select-pendingjobs-one';
    const queryString = 'SELECT * from pendingjobs ORDER BY id LIMIT 1';
    const queryValues: any[] = [];

    const response = await dbExecute(queryName, queryString, queryValues);
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
    const obj = dbobjects.createClassTenant(classid, [ 'text', 'numbers', 'sounds', 'imgtfjs' ]);
    const NUM_USERS = numstudents + 1;

    const queryName = 'dbqn-insert-tenants';
    const queryString = 'INSERT INTO tenants ' +
                            '(id, projecttypes, ismanaged, ' +
                            'maxusers, maxprojectsperuser, ' +
                            'textclassifiersexpiry) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6)';
    const queryValues = [
        obj.id, obj.projecttypes,
        type, NUM_USERS,
        maxprojects,
        obj.textclassifiersexpiry,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1) {
        log.error({ response, queryValues }, 'Failed to store managed tenant');
        throw new Error('Failed to store managed tenant');
    }
    const created = {
        id : obj.id,
        supportedProjectTypes : obj.projecttypes.split(',') as Objects.ProjectTypeLabel[],
        tenantType : type,
        maxUsers : NUM_USERS,
        maxProjectsPerUser : maxprojects,
        textClassifierExpiry : obj.textclassifiersexpiry,
    };
    return created;
}


export async function getClassTenant(classid: string): Promise<Objects.ClassTenant>
{
    const queryName = 'dbqn-select-tenants-id';
    const queryString = 'SELECT id, projecttypes, maxusers, ' +
                               'maxprojectsperuser, ' +
                               'textclassifiersexpiry, ' +
                               'ismanaged ' +
                        'FROM tenants ' +
                        'WHERE id = $1';
    const queryValues = [ classid ];

    const response = await dbExecute(queryName, queryString, queryValues);
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
    textexpiry: number,
): Promise<Objects.ClassTenant>
{
    const tenantinfo = await getClassTenant(classid);

    const modified = dbobjects.setClassTenantExpiries(tenantinfo, textexpiry);
    const obj = dbobjects.getClassDbRow(modified);

    const queryName = 'dbqn-insert-tenants-expiry';
    const queryString = 'INSERT INTO tenants ' +
                            '(id, projecttypes, ' +
                                'maxusers, maxprojectsperuser, ' +
                                'textclassifiersexpiry, ' +
                                'ismanaged) ' +
                            'VALUES ($1, $2, $3, $4, $5, $6) ' +
                            'ON CONFLICT(id) DO UPDATE SET ' +
                                'textclassifiersexpiry = $7';
    const queryValues = [
        obj.id, obj.projecttypes,
        obj.maxusers, obj.maxprojectsperuser,
        obj.textclassifiersexpiry,
        obj.ismanaged,
        //
        obj.textclassifiersexpiry,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount !== 1 &&  // row inserted
        response.rowCount !== 2)    // row updated
    {
        log.error({ response, queryValues }, 'Failed to update tenant info');
        throw new Error('Failed to update tenant info');
    }

    return modified;
}


export async function deleteClassTenant(classid: string): Promise<void>
{
    const queryName = 'dbqn-delete-tenants-id';
    const queryString = 'DELETE FROM tenants WHERE id = $1';
    const queryValues = [ classid ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete class tenant');
    }
}


// -----------------------------------------------------------------------------
//
// TEMPORARY SESSION USERS
//
// -----------------------------------------------------------------------------


export function testonly_resetSessionUsersStore(): Promise<void>
{
    // ensure this function is only used in tests, so we don't
    //  accidentally trash a production database table
    /* istanbul ignore else */
    if (process.env.POSTGRESQLHOST === 'localhost' || process.env.POSTGRESQLHOST === 'host.docker.internal') {
        const queryName = 'dbqn-delete-sessionusers-all';
        const queryString = 'DELETE FROM sessionusers';
        const queryValues: any[] = [];

        return dbExecute(queryName, queryString, queryValues)
            .then(() => { return; });
    }
    else {
        log.error('testonly_resetSessionUsersStore called on production system');
        return Promise.resolve();
    }
}



export async function storeTemporaryUser(lifespan: number): Promise<Objects.TemporaryUser>
{
    const obj = dbobjects.createTemporaryUser(lifespan);

    const queryName = 'dbqn-insert-sessionusers';
    const queryString = 'INSERT INTO sessionusers ' +
                            '(id, token, sessionexpiry) ' +
                        'VALUES ($1, $2, $3)';
    const queryValues = [ obj.id, obj.token, obj.sessionexpiry ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount === 1) {
        return dbobjects.getTemporaryUserFromDbRow(obj);
    }
    throw new Error('Failed to store temporary user');
}

export async function getTemporaryUser(id: string): Promise<Objects.TemporaryUser | undefined>
{
    const queryName = 'dbqn-select-sessionusers-id';
    const queryString = 'SELECT id, token, sessionexpiry ' +
                        'FROM sessionusers ' +
                        'WHERE id = $1';
    const queryValues = [ id ];

    const response = await dbExecute(queryName, queryString, queryValues);
    const rows = response.rows;
    if (rows.length !== 1) {
        log.warn({ id }, 'Temporary user not found');
        return;
    }
    return dbobjects.getTemporaryUserFromDbRow(rows[0]);
}

export async function deleteTemporaryUser(user: Objects.TemporaryUser): Promise<void>
{
    const queryName = 'dbqn-delete-sessionusers-id';
    const queryString = 'DELETE FROM sessionusers WHERE id = $1';
    const queryValues = [ user.id ];

    try {
        await dbExecute(queryName, queryString, queryValues);
    }
    catch (err) {
        throw new Error('Failed to delete temporary user');
    }
}

export async function countTemporaryUsers(): Promise<number>
{
    const queryName = 'dbqn-select-sessionusers-count';
    const queryString = 'SELECT COUNT(*) AS count FROM sessionusers';
    const queryValues: any[] = [];

    const response = await dbExecute(queryName, queryString, queryValues);
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
    const queryName = 'dbqn-select-sessionusers-expired';
    const queryString = 'SELECT id, token, sessionexpiry ' +
                        'FROM sessionusers ' +
                        'WHERE sessionexpiry < $1 ' +
                        'LIMIT 50';
    const queryValues = [ new Date() ];

    const response = await dbExecute(queryName, queryString, queryValues);
    return response.rows.map(dbobjects.getTemporaryUserFromDbRow);
}

export async function bulkDeleteTemporaryUsers(users: Objects.TemporaryUser[]): Promise<void>
{
    const queryPlaceholders: string[] = [];
    const ids = users.map((user, idx) => {
        queryPlaceholders.push('$' + (idx + 1));
        return user.id;
    });

    const deleteQueryString = 'DELETE FROM sessionusers WHERE id IN (' + queryPlaceholders.join(',') + ')';

    try {
        await dbConnPool.query(deleteQueryString, ids);
    }
    catch (err) {
        log.error({ err, ids, deleteQueryString }, 'Failed to delete temporary users');
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
    // ensure this function is only used in tests, so we don't
    //  accidentally trash a production database table
    /* istanbul ignore else */
    if (process.env.POSTGRESQLHOST === 'localhost' || process.env.POSTGRESQLHOST === 'host.docker.internal') {
        const queryName = 'dbqn-delete-sitealerts-all';
        const queryString = 'DELETE FROM sitealerts';
        const queryValues: any[] = [];

        return dbExecute(queryName, queryString, queryValues)
            .then(() => { return; });
    }
    else {
        log.error('testonly_resetSiteAlertsStore called on production system');
        return Promise.resolve();
    }
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

    const queryName = 'dbqn-insert-sitealerts';
    const queryString = 'INSERT INTO sitealerts ' +
                            '(timestamp , severityid, audienceid, message, url, expiry) ' +
                        'VALUES ($1, $2, $3, $4, $5, $6)';
    const queryValues = [
        obj.timestamp,
        obj.severityid, obj.audienceid,
        obj.message, obj.url,
        obj.expiry,
    ];

    const response = await dbExecute(queryName, queryString, queryValues);
    if (response.rowCount === 1) {
        return dbobjects.getSiteAlertFromDbRow(obj);
    }
    throw new Error('Failed to store site alert');
}


export async function getLatestSiteAlert(): Promise<Objects.SiteAlert | undefined>
{
    const queryName = 'dbqb-select-sitealerts-latest';
    const queryString = 'SELECT timestamp , severityid, audienceid, message, url, expiry ' +
                        'FROM sitealerts ' +
                        'ORDER BY timestamp DESC ' +
                        'LIMIT 1';
    const queryValues: any[] = [];

    const response = await dbExecute(queryName, queryString, queryValues);
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
            try {
                await conversation.deleteClassifier(tenant, classifier);
            }
            catch (err) {
                log.error({ err, userid, classid, projectid : project.id }, 'Failed to delete Assistant workspace');
            }
        }
        break;
    }
    case 'imgtfjs':
    case 'images':
        // nothing to do - models all stored client-side
        break;
    case 'numbers':
        try {
            await numbers.deleteClassifier(userid, classid, project.id);
        }
        catch (err) {
            log.error({ err, userid, classid, projectid : project.id }, 'Failed to delete numbers model');
        }
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

    for (const deleteQuery of deleteQueries) {
        await dbConnPool.query(deleteQuery, [ project.id ]);
    }
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

    for (const deleteQuery of deleteQueries) {
        await dbConnPool.query(deleteQuery, [ userid ]);
    }
}


export async function deleteClassResources(classid: string): Promise<void> {
    const deleteQueries = [
        'DELETE FROM bluemixcredentials WHERE classid = $1',
    ];

    for (const deleteQuery of deleteQueries) {
        await dbConnPool.query(deleteQuery, [ classid ]);
    }
}
