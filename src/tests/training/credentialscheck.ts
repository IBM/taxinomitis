/*eslint-env mocha */

import { v1 as uuid } from 'uuid';
import * as assert from 'assert';

import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as checker from '../../lib/training/credentialscheck';


describe('Training - Watson credentials checker', () => {

    before(() => {
        checker.init();
        return store.init();
    });

    after(() => {
        return store.disconnect();
    });

    describe('try-it-now tenant', () => {

        const classid = 'session-users';

        it('should assume try-it-now is okay for text projects', async () => {
            const outcome = await checker.checkClass(classid, 'text');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-OK',
                message : 'ok',
            });
        });

        it('should assume try-it-now is okay for images projects', async () => {
            const outcome = await checker.checkClass(classid, 'images');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-OK',
                message : 'ok',
            });
        });
    });


    describe('managed tenants', () => {

        const classid = 'TESTTENANT';

        it('should no give any information about text credentials', async () => {
            const outcome = await checker.checkClass(classid, 'text');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-MANAGED',
                message : 'Managed classes do not need to verify credentials',
            });
        });

        it('should no give any information about images credentials', async () => {
            const outcome = await checker.checkClass(classid, 'images');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TYPEUNK',
                message : 'Unsupported project type',
            });
        });
    });


    describe('empty, unmanaged tenants', () => {

        const classid = uuid();

        it('should not check sounds model credentials', async () => {
            const outcome = await checker.checkClass(classid, 'sounds');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-SOUND',
                message : 'Watson API keys are not required for sounds projects',
            });
        });

        it('should not check numbers model credentials', async () => {
            const outcome = await checker.checkClass(classid, 'numbers');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-NUM',
                message : 'Watson API keys are not required for numbers projects',
            });
        });

        it('should handle unexpected model type requests', async () => {
            const outcome = await checker.checkClass(classid, 'fish' as DbTypes.ProjectTypeLabel);
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TYPEUNK',
                message : 'Unsupported project type',
            });
        });

        it('should recognize there are no text credentials', async () => {
            const outcome = await checker.checkClass(classid, 'text');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TEXT-NOKEYS',
                message : 'There are no Watson Assistant credentials in this class',
            });
        });

        it('should recognize there are no images credentials', async () => {
            const outcome = await checker.checkClass(classid, 'images');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TYPEUNK',
                message : 'Unsupported project type',
            });
        });
    });


    describe('unmanaged tenants with invalid credentials', () => {

        const classid = uuid();
        const convid = uuid();
        const visrecid = uuid();

        before(() => {
            return store.storeBluemixCredentials(classid, {
                id : convid,
                classid,
                username : 'fakeuser',
                password : 'fakepass',
                servicetype : 'conv',
                url : 'https://gateway.watsonplatform.net/assistant/api',
                credstypeid : 0,
            });
        });

        before(() => {
            return store.storeBluemixCredentials(classid, {
                id : visrecid,
                classid,
                username : 'fakeuser',
                password : 'fakepass',
                servicetype : 'visrec',
                url : 'https://gateway.watsonplatform.net/visual-recognition/api',
                credstypeid : 0,
            });
        });

        after(() => {
            return store.deleteBluemixCredentials(convid);
        });
        after(() => {
            return store.deleteBluemixCredentials(visrecid);
        });


        it('should not check sounds model credentials', async () => {
            const outcome = await checker.checkClass(classid, 'sounds');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-SOUND',
                message : 'Watson API keys are not required for sounds projects',
            });
        });

        it('should not check numbers model credentials', async () => {
            const outcome = await checker.checkClass(classid, 'numbers');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-NUM',
                message : 'Watson API keys are not required for numbers projects',
            });
        });

        it('should handle unexpected model type requests', async () => {
            const outcome = await checker.checkClass(classid, 'fish' as DbTypes.ProjectTypeLabel);
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TYPEUNK',
                message : 'Unsupported project type',
            });
        });

        it('should recognize there are no text credentials', async () => {
            const outcome = await checker.checkClass(classid, 'text');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TEXT-INVALID',
                message : 'No valid Watson Assistant credentials in this class',
            });
        });

        it('should recognize there are no images credentials', async () => {
            const outcome = await checker.checkClass(classid, 'images');
            assert.deepStrictEqual(outcome, {
                code : 'MLCRED-TYPEUNK',
                message : 'Unsupported project type',
            });
        });
    });
});
