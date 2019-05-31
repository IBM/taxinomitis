/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as sinon from 'sinon';
import * as conversation from '../../lib/training/conversation';
import * as visualrecog from '../../lib/training/visualrecognition';
import * as status from '../../lib/scratchx/status';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';


describe('Scratchx - status', () => {

    const credstype = 'unknown';

    describe('text projects', () => {

        const testStatus: TrainingTypes.ConversationWorkspace = {
            id : uuid(),
            name : 'TEST PROJECT',
            status : 'Available',
            workspace_id : uuid(),
            credentialsid : '123',
            created : new Date(),
            expiry : new Date(),
            language : 'en',
            url : 'conversation.url',
        };
        let getStatusStub: sinon.SinonStub<[TrainingTypes.BluemixCredentials, TrainingTypes.ConversationWorkspace],
                                           Promise<TrainingTypes.ConversationWorkspace>>;

        before(() => {
            getStatusStub = sinon.stub(conversation, 'getStatus').resolves(testStatus);
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
                updated : new Date(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
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
                classifierid : testStatus.workspace_id,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    classid : '',
                    credstype,
                },
                updated : new Date(),
            };

            testStatus.status = 'Non Existent';

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 0,
                msg : 'Model Non Existent',
            });
        });



        it('should return status 1 for projects that are still training', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                classifierid : testStatus.workspace_id,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    classid : '',
                    credstype,
                },
                updated : new Date(),
            };

            testStatus.status = 'Training';

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
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
                classifierid : testStatus.workspace_id,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    classid : '',
                    credstype,
                },
                updated : new Date(),
            };

            testStatus.status = 'Available';

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 2,
                msg : 'Ready',
            });
        });
    });


    describe('numbers projects', () => {

        it('should return status 2 for untrained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
                updated : new Date(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 2,
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
                updated : new Date(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 2,
                msg : 'Status for TEST',
            });
        });


    });


    describe('images projects', () => {

        const testStatus: TrainingTypes.VisualClassifier = {
            id : uuid(),
            name : 'TEST PROJECT',
            status : 'ready',
            classifierid : uuid(),
            credentialsid : '123',
            created : new Date(),
            expiry : new Date(),
            url : 'conversation.url',
        };
        let getStatusStub: sinon.SinonStub<[TrainingTypes.BluemixCredentials, TrainingTypes.VisualClassifier],
                                           Promise<TrainingTypes.VisualClassifier>>;

        before(() => {
            getStatusStub = sinon.stub(visualrecog, 'getStatus').resolves(testStatus);
        });
        after(() => {
            getStatusStub.restore();
        });


        it('should return status 0 for untrained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                updated : new Date(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 0,
                msg : 'No models trained yet - only random answers can be chosen',
            });
        });



        it('should return status 0 for classifiers that have been deleted', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : testStatus.classifierid,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    classid : '',
                    credstype,
                },
                updated : new Date(),
            };

            testStatus.status = 'Non Existent';

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 0,
                msg : 'Model Non Existent',
            });
        });



        it('should return status 1 for projects that are still training', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : testStatus.classifierid,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    classid : '',
                    credstype,
                },
                updated : new Date(),
            };

            testStatus.status = 'training';

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 1,
                msg : 'Model not ready yet',
            });
        });


        it('should return status 2 for trained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : testStatus.classifierid,
                credentials : {
                    url : 'http',
                    id : uuid(),
                    username : 'user',
                    password : 'pass',
                    servicetype : 'conv',
                    classid : '',
                    credstype,
                },
                updated : new Date(),
            };

            testStatus.status = 'ready';

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 2,
                msg : 'Ready',
            });
        });

        it('should return status 0 for untrained projects', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                updated : new Date(),
            };

            const statusObj = await status.getStatus(key);
            assert.deepStrictEqual(statusObj, {
                status : 0,
                msg : 'No models trained yet - only random answers can be chosen',
            });
        });

    });
});
