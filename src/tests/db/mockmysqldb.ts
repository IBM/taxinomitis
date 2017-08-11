// eslint-disable-file no-case-declarations

import * as sinon from 'sinon';

export const MOCK_POOL = {
    getConnection : () => {
        return Promise.resolve({
            execute : mockExecute,
            release : sinon.stub(),
        });
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

// tslint:disable:max-line-length

function mockExecute(query, params) {
    let ERROR: any;

    switch (query) {

    case 'SELECT COUNT(*) AS count FROM `projects` WHERE `classid` = ? AND `userid` = ?':
        if (params[1] === 'UNCOUNTABLE') {
            ERROR = new Error('The MySQL server is running with the --read-only option so it cannot execute this statement');
            ERROR.code = 'ER_OPTION_PREVENTS_STATEMENT';
            ERROR.errno = 1290;
            return Promise.reject(ERROR);
        }
        else {
            return Promise.resolve([ { count : 1 } ]);
        }

    case 'SELECT COUNT(*) AS `trainingcount` FROM `texttraining` WHERE `projectid` = ?':
    case 'SELECT COUNT(*) AS `trainingcount` FROM `numbertraining` WHERE `projectid` = ?':
        return Promise.resolve([[ { trainingcount : 10 } ]]);

    case 'SELECT `id`, `projecttypes`, `maxusers`, `maxprojectsperuser`, `textclassifiersexpiry`, `imageclassifiersexpiry`, `ismanaged` FROM `tenants` WHERE `id` = ?':
        return Promise.resolve([[]]);

    case 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels`, `fields` FROM `projects` WHERE `id` = ?':
        return Promise.resolve([[ {
            id : 'PROJECTID',
            userid : 'EXCEPTION',
            classid : 'CLASSID',
            typeid : 1,
            name : 'name',
            labels : '',
            fields : '',
        } ]]);

    case 'SELECT `id`, `userid`, `classid`, `typeid`, `name`, `labels` FROM `projects` WHERE `classid` = ? AND `userid` = ?':
        ERROR = new Error('Some technical sounding SQL error from selecting projects');
        ERROR.code = 'ER_NO_SUCH_SELECT_ERROR';
        ERROR.errno = 6677;
        ERROR.sqlState = '#12S34';
        return Promise.reject(ERROR);

    case 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`, `classifierid`, `url`, `name`, `language`, `created`, `expiry` FROM `bluemixclassifiers` WHERE `projectid` = ?':
        return Promise.resolve([[]]);

    case 'DELETE FROM `texttraining` WHERE `id` = ? AND `projectid` = ?':
    case 'DELETE FROM `numbertraining` WHERE `id` = ? AND `projectid` = ?':
        ERROR = new Error('Some technical sounding SQL error from deleting training data rows');
        ERROR.code = 'ER_NO_SUCH_DELETE_ERROR';
        ERROR.errno = 6677;
        ERROR.sqlState = '#12S34';
        return Promise.reject(ERROR);

    case 'DELETE FROM `texttraining` WHERE `projectid` = ?':
        if (params[0] === 'FAIL') {
            ERROR = new Error('Some technical sounding SQL error from deleting all the training data rows');
            ERROR.code = 'ER_NO_SUCH_DELETE_ERROR';
            ERROR.errno = 6677;
            ERROR.sqlState = '#12S34';
            return Promise.reject(ERROR);
        }
        else {
            return Promise.resolve();
        }
    case 'DELETE FROM `numbertraining` WHERE `projectid` = ?':
        if (params[0] === 'FAIL') {
            ERROR = new Error('Some technical sounding SQL error from deleting all the training data rows');
            ERROR.code = 'ER_NO_SUCH_DELETE_ERROR';
            ERROR.errno = 6677;
            ERROR.sqlState = '#12S34';
            return Promise.reject(ERROR);
        }
        else {
            return Promise.resolve();
        }
    case 'DELETE FROM `bluemixclassifiers` WHERE `projectid` = ?':
        return Promise.resolve();
    case 'DELETE FROM `taxinoclassifiers` WHERE `projectid` = ?':
        return Promise.resolve();
    case 'DELETE FROM `scratchkeys` WHERE `projectid` = ?':
        return Promise.resolve();

    case 'INSERT INTO `projects` (`id`, `userid`, `classid`, `typeid`, `name`, `labels`, `fields`) VALUES (?, ?, ?, ?, ?, ?, ?)':
        if (params[1] === 'EXCEPTION') {
            ERROR = new Error('We could not write the project to the DB');
            ERROR.code = 'ER_SOME_INSERT_ERROR';
            ERROR.errno = 2929;
            ERROR.sqlState = '#12345';
            return Promise.reject(ERROR);
        }
        else {
            return Promise.resolve([[ { affectedRows : 0 } ]]);
        }

    case 'INSERT INTO `texttraining` (`id`, `projectid`, `textdata`, `label`) VALUES (?, ?, ?, ?)':
        if (params[2] === 'throw an exception') {
            ERROR = new Error('We could not write the training data to the DB');
            ERROR.code = 'ER_SOME_INSERT_ERROR';
            ERROR.errno = 1919;
            ERROR.sqlState = '#12345';
            return Promise.reject(ERROR);
        }
        else {
            return Promise.resolve([[ { affectedRows : 0 } ]]);
        }

    case 'DELETE FROM `projects` WHERE `id` = ?':
        ERROR = new Error('We could not delete the project from the DB');
        ERROR.code = 'ER_SOME_DELETE_ERROR';
        ERROR.errno = 2129;
        ERROR.sqlState = '#98765';
        return Promise.reject(ERROR);

    default:
        // console.log(query);
        // console.log(params);
        ERROR = new Error('Some technical sounding SQL error');
        ERROR.code = 'ER_NO_SUCH_ERROR';
        ERROR.errno = 1234;
        ERROR.sqlState = '#12S34';
        return Promise.reject(ERROR);
    }
}
