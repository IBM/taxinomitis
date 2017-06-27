/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as nlc from '../../lib/training/nlc';
import * as status from '../../lib/scratchx/status';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';


describe('Scratchx - status', () => {

    describe('text projects', () => {

        const testStatus: TrainingTypes.NLCClassifier = {
            name : 'TEST NLC PROJECT',
            status : 'Available',
            classifierid : uuid(),
            created : new Date(),
            language : 'en',
            url : 'nlcurl',
        };
        let getStatusStub;

        before(() => {
            getStatusStub = sinon.stub(nlc, 'getStatus').resolves(testStatus);
            proxyquire('../../lib/scratchx/status', {
                '../training/nlc' : {
                    getStatus : getStatusStub,
                },
            });
        });
        after(() => {
            getStatusStub.restore();
        });


        it('should return status 0 for untrained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 0,
                msg : 'No models trained yet - only random answers can be chosen',
            });
        });



        it('should return status 0 for classifiers that have been deleted', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                classifierid : testStatus.classifierid,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'nlc',
                },
            };

            testStatus.status = 'Non Existent';
            testStatus.statusDescription = 'Classifier not found';

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 0,
                msg : 'Model Non Existent Classifier not found',
            });
        });



        it('should return status 1 for projects that are still training', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                classifierid : testStatus.classifierid,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'nlc',
                },
            };

            testStatus.status = 'Training';

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 1,
                msg : 'Model not ready yet',
            });
        });


        it('should return status 2 for trained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                classifierid : testStatus.classifierid,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'nlc',
                },
            };

            testStatus.status = 'Available';

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 2,
                msg : 'Ready',
            });
        });
    });


    describe('numbers projects', () => {

        it('should return status 0 for untrained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 0,
                msg : 'No models trained yet - only random answers can be chosen',
            });
        });


        it('should return a placeholder status', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
                classifierid : uuid(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 2,
                msg : 'PLACEHOLDER for TEST',
            });
        });


    });


    describe('images projects', () => {

        it('should return status 0 for untrained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 0,
                msg : 'No models trained yet - only random answers can be chosen',
            });
        });


        it('should return an error status', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : uuid(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepEqual(statusObj, {
                status : 0,
                msg : 'Not implemented yet',
            });
        });
    });


});
