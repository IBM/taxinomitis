import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';


describe('DB store - numbers models', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    describe('getNumbersClassifiers', () => {
        it('should handle requests for non-existent models', async () => {
            const projectid = uuid();
            const output = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(output, []);
        });
    });

    describe('storeNumbersClassifier', () => {
        it('should store model info', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            const storeOutput = await store.storeNumbersClassifier(userid, classid, projectid, url);
            assert.deepStrictEqual(storeOutput, { projectid, userid, classid, url });

            const getOutput = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(getOutput, [{ projectid, userid, classid, url }]);

            await store.deleteNumberClassifier(userid, projectid);
        });

        it('should update model info', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url1 = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';
            const url2 = 'https://mlforkids-newnumbers.different-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            const storeOutput1 = await store.storeNumbersClassifier(userid, classid, projectid, url1);
            assert.deepStrictEqual(storeOutput1, { projectid, userid, classid, url : url1 });

            const getOutput1 = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(getOutput1, [{ projectid, userid, classid, url : url1 }]);

            const storeOutput2 = await store.storeNumbersClassifier(userid, classid, projectid, url2);
            assert.deepStrictEqual(storeOutput2, { projectid, userid, classid, url : url2 });

            const getOutput2 = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(getOutput2, [{ projectid, userid, classid, url : url2 }]);

            await store.deleteNumberClassifier(userid, projectid);
        });

        it('should require all attributes', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            await assert.rejects(
                () => store.storeNumbersClassifier(userid, classid, projectid, ''),
                { message: 'Missing required attributes' }
            );
            await assert.rejects(
                () => store.storeNumbersClassifier(userid, classid, '', url),
                { message: 'Missing required attributes' }
            );
            await assert.rejects(
                () => store.storeNumbersClassifier(userid, '', projectid, url),
                { message: 'Missing required attributes' }
            );
            await assert.rejects(
                () => store.storeNumbersClassifier('', classid, projectid, url),
                { message: 'Missing required attributes' }
            );
            await assert.rejects(
                () => store.storeNumbersClassifier(userid, classid, projectid, 'hello'),
                { message: 'Unexpected model URL' }
            );
            await assert.rejects(
                () => store.storeNumbersClassifier(userid, classid, projectid, 'https://google.com'),
                { message: 'Unexpected model URL' }
            );
        });
    });


    describe('deleteNumberClassifier', () => {

        it('should handle requests for non-existent models', async () => {
            const projectid = uuid();
            const userid = uuid();
            await store.deleteNumberClassifier(userid, projectid);
        });

        it('should delete a stored model URL', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            const storeOutput = await store.storeNumbersClassifier(userid, classid, projectid, url);
            assert.deepStrictEqual(storeOutput, { projectid, userid, classid, url });

            const getOutput1 = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(getOutput1, [{ projectid, userid, classid, url }]);

            await store.deleteNumberClassifier(userid, projectid);

            const getOutput2 = await store.getNumbersClassifiers(projectid);
            assert.deepStrictEqual(getOutput2, []);
        });
    });

    describe('deleteEntireProject', () => {

        it('should remove model info', async () => {
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/741120a0-f38a-11ee-872d-a10721b23614/status';

            const project = await store.storeProject(userid, classid, 'numbers', 'test', 'en', [{ name : 'num', type : 'number' }], false);

            const storeOutput = await store.storeNumbersClassifier(userid, classid, project.id, url);
            assert.deepStrictEqual(storeOutput, { projectid : project.id, userid, classid, url });

            const getOutput1 = await store.getNumbersClassifiers(project.id);
            assert.deepStrictEqual(getOutput1, [{ projectid : project.id, userid, classid, url }]);

            await store.deleteEntireProject(userid, classid, project);

            const getOutput2 = await store.getNumbersClassifiers(project.id);
            assert.deepStrictEqual(getOutput2, []);
        });
    });

    describe('deleteEntireUser', () => {

        it('should remove model info', async () => {
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/741120a0-f38a-11ee-872d-a10721b23614/status';

            const project = await store.storeProject(userid, classid, 'numbers', 'test', 'en', [{ name : 'num', type : 'number' }], false);

            const storeOutput = await store.storeNumbersClassifier(userid, classid, project.id, url);
            assert.deepStrictEqual(storeOutput, { projectid : project.id, userid, classid, url });

            const getOutput1 = await store.getNumbersClassifiers(project.id);
            assert.deepStrictEqual(getOutput1, [{ projectid : project.id, userid, classid, url }]);

            await store.deleteEntireUser(userid, classid);

            const getOutput2 = await store.getNumbersClassifiers(project.id);
            assert.deepStrictEqual(getOutput2, []);
        });
    });
});
