/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';

import * as Objects from '../../lib/db/db-types';
import * as store from '../../lib/db/store';


describe('DB store - numbers models', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    describe('getNumbersClassifiers', () => {
        it('should handle requests for non-existent models', () => {
            const projectid = uuid();
            return store.getNumbersClassifiers(projectid)
                .then((output) => {
                    assert.deepStrictEqual(output, []);
                });
        });
    });

    describe('storeNumbersClassifier', () => {
        it('should store model info', () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            return store.storeNumbersClassifier(userid, classid, projectid, url)
                .then((output) => {
                    assert.deepStrictEqual(output, { projectid, userid, classid, url });
                    return store.getNumbersClassifiers(projectid);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, [{ projectid, userid, classid, url }]);
                    return store.deleteNumberClassifier(userid, projectid);
                });
        });

        it('should update model info', () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url1 = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';
            const url2 = 'https://mlforkids-newnumbers.different-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            return store.storeNumbersClassifier(userid, classid, projectid, url1)
                .then((output) => {
                    assert.deepStrictEqual(output, { projectid, userid, classid, url : url1 });
                    return store.getNumbersClassifiers(projectid);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, [{ projectid, userid, classid, url : url1 }]);
                    return store.storeNumbersClassifier(userid, classid, projectid, url2);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, { projectid, userid, classid, url : url2 });
                    return store.getNumbersClassifiers(projectid);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, [{ projectid, userid, classid, url : url2 }]);
                    return store.deleteNumberClassifier(userid, projectid);
                });
        });

        it('should require all attributes', async () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';

            try {
                await store.storeNumbersClassifier(userid, classid, projectid, '');
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
            try {
                await store.storeNumbersClassifier(userid, classid, '', url);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
            try {
                await store.storeNumbersClassifier(userid, '', projectid, url);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
            try {
                await store.storeNumbersClassifier('', classid, projectid, url);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
            try {
                await store.storeNumbersClassifier(userid, classid, projectid, 'hello');
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected model URL');
            }
            try {
                await store.storeNumbersClassifier(userid, classid, projectid, 'https://google.com');
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected model URL');
            }
        });
    });


    describe('deleteNumberClassifier', () => {

        it('should handle requests for non-existent models', () => {
            const projectid = uuid();
            const userid = uuid();
            return store.deleteNumberClassifier(userid, projectid);
        });

        it('should delete a stored model URL', () => {
            const projectid = uuid();
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/' + projectid + '/status';
            return store.storeNumbersClassifier(userid, classid, projectid, url)
                .then((output) => {
                    assert.deepStrictEqual(output, { projectid, userid, classid, url });
                    return store.getNumbersClassifiers(projectid);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, [{ projectid, userid, classid, url }]);
                    return store.deleteNumberClassifier(userid, projectid);
                })
                .then(() => {
                    return store.getNumbersClassifiers(projectid);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, []);
                });
        });
    });

    describe('deleteEntireProject', () => {

        it('should remove model info', () => {
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/741120a0-f38a-11ee-872d-a10721b23614/status';
            let project: Objects.Project;
            return store.storeProject(userid, classid, 'numbers', 'test', 'en', [{ name : 'num', type : 'number' }], false)
                .then((p) => {
                    project = p;
                    return store.storeNumbersClassifier(userid, classid, project.id, url);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, { projectid : project.id, userid, classid, url });
                    return store.getNumbersClassifiers(project.id);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, [{ projectid : project.id, userid, classid, url }]);
                    return store.deleteEntireProject(userid, classid, project);
                })
                .then(() => {
                    return store.getNumbersClassifiers(project.id);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, []);
                });
        });
    });

    describe('deleteEntireUser', () => {

        it('should remove model info', () => {
            const userid = uuid();
            const classid = uuid();
            const url = 'https://mlforkids-newnumbers.not-a-real-region.cloud-region.codeengine.appdomain.cloud/saved-models/741120a0-f38a-11ee-872d-a10721b23614/status';
            let project: Objects.Project;
            return store.storeProject(userid, classid, 'numbers', 'test', 'en', [{ name : 'num', type : 'number' }], false)
                .then((p) => {
                    project = p;
                    return store.storeNumbersClassifier(userid, classid, project.id, url);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, { projectid : project.id, userid, classid, url });
                    return store.getNumbersClassifiers(project.id);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, [{ projectid : project.id, userid, classid, url }]);
                    return store.deleteEntireUser(userid, classid);
                })
                .then(() => {
                    return store.getNumbersClassifiers(project.id);
                })
                .then((output) => {
                    assert.deepStrictEqual(output, []);
                });
        });
    });
});
