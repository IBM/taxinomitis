/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';

import * as mockMysqldb from './mockmysqldb';

import * as store from '../../lib/db/store';


describe('DB store - error handling', () => {

    let stubbedStore;

    before('set up mocks', () => {
        stubbedStore = proxyquire('../../lib/db/store', {
            './mysqldb' : mockMysqldb,
        });

        return stubbedStore.init();
    });

    after(() => {
        return stubbedStore.disconnect();
    });


    describe('restartConnection', () => {

        it('should restart the DB connection after READ_ONLY errors', async () => {
            const connBefore = mockMysqldb.connectsCount;
            const discBefore = mockMysqldb.disconnectsCount;

            try {
                await stubbedStore.countProjectsByUserId('UNCOUNTABLE', 'classid');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(mockMysqldb.connectsCount, connBefore + 1);
                assert.equal(mockMysqldb.disconnectsCount, discBefore + 1);
                assert.equal(err.message,
                    'The MySQL server is running with the --read-only option so it cannot execute this statement');
            }
        });

    });



    describe('getProjectsByUserId', () => {

        it('should handle weird errors', async () => {
            try {
                await stubbedStore.getProjectsByUserId('userid', 'classid');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert(err);
            }
        });
    });


    describe('deleteTextTraining', () => {

        it('should handle errors', async () => {
            try {
                await stubbedStore.deleteTraining('text', 'projectid', 'warningtrainingid');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Failed to delete training');
            }
        });

        it('should handle weird errors', async () => {
            try {
                await stubbedStore.deleteTraining('text', 'projectid', 'trainingid');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Some technical SQL error from deleting training data rows');
            }
        });
    });




    describe('deleteNumberTraining', () => {

        it('should handle weird errors', async () => {
            try {
                await stubbedStore.deleteTraining('numbers', 'projectid', 'trainingid');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Some technical SQL error from deleting training data rows');
            }
        });
    });


    describe('deleteTextTrainingByProjectId', () => {

        it('should handle errors', async () => {
            try {
                await stubbedStore.deleteTrainingByProjectId('text', 'ODDFAIL');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Failed to delete training');
            }
        });

        it('should handle weird errors', async () => {
            try {
                await stubbedStore.deleteTrainingByProjectId('text', 'FAIL');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Some technical sounding SQL error from deleting all the training data rows');
            }
        });
    });


    describe('deleteNumberTrainingByProjectId', () => {

        it('should handle weird errors', async () => {
            try {
                await stubbedStore.deleteTrainingByProjectId('numbers', 'FAIL');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Some technical sounding SQL error from deleting all the training data rows');
            }
        });
    });

    describe('updateLabels', () => {

        it('should handle weird errors', async () => {
            try {
                await stubbedStore.addLabelToProject('userid', 'classid', 'projectid', 'labeltoadd');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'We could not update the labels list in the project');
            }
        });

        it('should handle failures', async () => {
            try {
                await stubbedStore.addLabelToProject('userid', 'classid', 'projectid', 'BANG');
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Project not updated');
            }
        });

    });

});
