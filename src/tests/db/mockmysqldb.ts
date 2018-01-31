// eslint-disable-file no-case-declarations

import * as mysql from 'mysql2/promise';
import * as sinon from 'sinon';

export const MOCK_POOL: mysql.ConnectionPool = {
    getConnection : () => {
        const mockConnection: mysql.Connection = {
            execute : mockExecute,
            query : mockQuery,
            release : sinon.stub(),
        };
        return Promise.resolve(mockConnection);
    },
    end : () => {
        return Promise.resolve();
    },
};


export let connectsCount: number = 0;
export let disconnectsCount: number = 0;


export function connect() {
    connectsCount += 1;
    return Promise.resolve(MOCK_POOL);
}

export function disconnect() {
    disconnectsCount += 1;
    return Promise.resolve();
}

export function createPool() {
    return Promise.resolve(MOCK_POOL);
}

function mockQuery(query: string, params: any[]): Promise<any[]> {
    return mockExecute(query, params);
}

// tslint:disable:max-line-length

function mockExecute(query: string, params: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {

        let ERROR: any;

        switch (query) {

        case 'SELECT `id`, `labels` FROM `projects` WHERE `id` = ? AND `userid` = ? AND `classid` = ?':
            // if (params[0] === 'projectid' && params[1] === 'userid' && params[2] === 'classid') {
            return resolve([[{ id : params[0], labels : 'one,two,three' }]]);

        case 'SELECT COUNT(*) AS count FROM `projects` WHERE `userid` = ? AND `classid` = ?':
            if (params[0] === 'UNCOUNTABLE') {
                ERROR = new Error('The MySQL server is running with the --read-only option so it cannot execute this statement');
                ERROR.code = 'ER_OPTION_PREVENTS_STATEMENT';
                ERROR.errno = 1290;
                return reject(ERROR);
            }
            else {
                return resolve([ { count : 1 } ]);
            }

        case 'SELECT COUNT(*) AS `trainingcount` FROM `texttraining` WHERE `projectid` = ?':
        case 'SELECT COUNT(*) AS `trainingcount` FROM `numbertraining` WHERE `projectid` = ?':
            return resolve([[ { trainingcount : 10 } ]]);

        case 'SELECT `id`, `projecttypes`, `maxusers`, `maxprojectsperuser`, `textclassifiersexpiry`, `imageclassifiersexpiry`, `ismanaged` FROM `tenants` WHERE `id` = ?':
            return resolve([[]]);

        case 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `language`, `labels`, `numfields`, `iscrowdsourced` FROM `projects` WHERE `id` = ?':
            return resolve([[ {
                id : 'PROJECTID',
                userid : 'EXCEPTION',
                classid : 'CLASSID',
                typeid : 1,
                name : 'name',
                language : 'en',
                labels : '',
                numfields : 0,
                iscrowdsourced : 0,
            } ]]);

        case 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `language`, `labels`, `iscrowdsourced` FROM `projects` WHERE `classid` = ? AND (`userid` = ? OR `iscrowdsourced` = True)':
            ERROR = new Error('Some technical sounding SQL error from selecting projects');
            ERROR.code = 'ER_NO_SUCH_SELECT_ERROR';
            ERROR.errno = 6677;
            ERROR.sqlState = '#12S34';
            return reject(ERROR);

        case 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`, `classifierid`, `url`, `name`, `language`, `created`, `expiry` FROM `bluemixclassifiers` WHERE `projectid` = ?':
            return resolve([[]]);

        case 'DELETE FROM `texttraining` WHERE `id` = ? AND `projectid` = ?':
        case 'DELETE FROM `numbertraining` WHERE `id` = ? AND `projectid` = ?':
            if (params[0] === 'warningtrainingid') {
                return resolve([{ warningStatus : 1 }]);
            }
            ERROR = new Error('Some technical SQL error from deleting training data rows');
            ERROR.code = 'ER_NO_SUCH_DELETE_ERROR';
            ERROR.errno = 6677;
            ERROR.sqlState = '#12S34';
            return reject(ERROR);

        case 'DELETE FROM `texttraining` WHERE `projectid` = ?':
            if (params[0] === 'FAIL') {
                ERROR = new Error('Some technical sounding SQL error from deleting all the training data rows');
                ERROR.code = 'ER_NO_SUCH_DELETE_ERROR';
                ERROR.errno = 6677;
                ERROR.sqlState = '#12S34';
                return reject(ERROR);
            }
            else if (params[0] === 'ODDFAIL') {
                return resolve([{ warningStatus : 1 }]);
            }
            else {
                return resolve();
            }
        case 'DELETE FROM `numbertraining` WHERE `projectid` = ?':
            if (params[0] === 'FAIL') {
                ERROR = new Error('Some technical sounding SQL error from deleting all the training data rows');
                ERROR.code = 'ER_NO_SUCH_DELETE_ERROR';
                ERROR.errno = 6677;
                ERROR.sqlState = '#12S34';
                return reject(ERROR);
            }
            else {
                return resolve();
            }
        case 'DELETE FROM `numbersprojectsfields` WHERE `projectid` = ?':
            return resolve();
        case 'DELETE FROM `bluemixclassifiers` WHERE `projectid` = ?':
            return resolve();
        case 'DELETE FROM `taxinoclassifiers` WHERE `projectid` = ?':
            return resolve();
        case 'DELETE FROM `scratchkeys` WHERE `projectid` = ?':
            return resolve();

        case 'INSERT INTO `projects` (`id`, `userid`, `classid`, `typeid`, `name`, `language`, `labels`, `numfields`, `iscrowdsourced`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)':
            if (params[1] === 'EXCEPTION') {
                ERROR = new Error('We could not write the project to the DB');
                ERROR.code = 'ER_SOME_INSERT_ERROR';
                ERROR.errno = 2929;
                ERROR.sqlState = '#12345';
                return reject(ERROR);
            }
            else {
                return resolve([[ { affectedRows : 0 } ]]);
            }

        case 'INSERT INTO `texttraining` (`id`, `projectid`, `textdata`, `label`) VALUES (?, ?, ?, ?)':
            if (params[2] === 'throw an exception') {
                ERROR = new Error('We could not write the training data to the DB');
                ERROR.code = 'ER_SOME_INSERT_ERROR';
                ERROR.errno = 1919;
                ERROR.sqlState = '#12345';
                return reject(ERROR);
            }
            else {
                return resolve([[ { affectedRows : 0 } ]]);
            }

        case 'UPDATE `projects` SET `labels` = ? WHERE `id` = ? AND `userid` = ? AND `classid` = ?':
            if (params[0] === 'one,two,three,labeltoadd') {
                ERROR = new Error('We could not update the labels list in the project');
                ERROR.code = 'ER_SOME_UPDATE_ERROR';
                ERROR.errno = 2029;
                ERROR.sqlState = '#98123';
                return reject(ERROR);
            }
            else if (params[0] === 'one,two,three,BANG') {
                return resolve([[ { affectedRows : 0 } ]]);
            }
            else {
                return resolve([[ { affectedRows : 1 } ]]);
            }

        case 'DELETE FROM `projects` WHERE `id` = ?':
            ERROR = new Error('We could not delete the project from the DB');
            ERROR.code = 'ER_SOME_DELETE_ERROR';
            ERROR.errno = 2129;
            ERROR.sqlState = '#98765';
            return reject(ERROR);

        default:
            ERROR = new Error('Some technical sounding SQL error');
            ERROR.code = 'ER_NO_SUCH_ERROR';
            ERROR.errno = 1234;
            ERROR.sqlState = '#12S34';
            return reject(ERROR);
        }
    });
}
