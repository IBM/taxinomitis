/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as randomstring from 'randomstring';
import * as uuid from 'uuid/v1';

import * as store from '../../lib/db/store';
import * as Types from '../../lib/training/training-types';



describe('DB store', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    describe('Bluemix credentials', () => {

        it('should store and retrieve Bluemix credentials', async () => {
            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'nlc',
                url : 'http://nlc.service/api/classifiers',
            };
            const classid = uuid();

            await store.storeBluemixCredentials(classid, creds);

            const retrieved = await store.getBluemixCredentials(classid, 'nlc');
            assert.deepEqual(retrieved, creds);

            await store.deleteBluemixCredentials(creds.id);
        });

        it('should throw an error when fetching non-existent credentials', async () => {
            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'nlc',
                url : 'http://nlc.service/api/classifiers',
            };
            const classid = uuid();

            await store.storeBluemixCredentials(classid, creds);

            const retrieved = await store.getBluemixCredentials(classid, 'nlc');
            assert.deepEqual(retrieved, creds);

            await store.deleteBluemixCredentials(creds.id);

            return store.getBluemixCredentials(classid, 'nlc')
                .then(() => {
                    assert.fail(1, 0, 'Should not reach here', '');
                })
                .catch((err) => {
                    assert.equal(err.message, 'Unexpected response when retrieving service credentials');
                });
        });

        it('should retrieve credentials for a classifier', async () => {
            const classid = uuid();
            const projectid = uuid();
            const userid = uuid();

            const creds: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'nlc',
                url : 'http://nlc.service/api/classifiers',
            };

            await store.storeBluemixCredentials(classid, creds);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.NLCClassifier = {
                classifierid : randomstring.generate({ length : 8 }),
                created,
                language : 'en',
                name : randomstring.generate({ length : 12 }),
                url : uuid(),
            };

            await store.storeNLCClassifier(
                creds, userid, classid, projectid,
                classifierInfo,
            );

            const retrievedCreds = await store.getServiceCredentials(
                projectid, classid, userid, 'nlc', classifierInfo.classifierid,
            );
            assert.deepEqual(retrievedCreds, creds);

            await store.deleteBluemixCredentials(creds.id);
            await store.deleteNLCClassifiersByProjectId(projectid);
        });

    });


    describe('NLC classifiers', () => {


        it('should return 0 for unknown users', async () => {
            const unknownClass = uuid();
            const count = await store.countNLCClassifiers(unknownClass);
            assert.equal(count, 0);
        });



        it('should store and retrieve NLC classifiers', async () => {
            const classid = uuid();
            const projectid = uuid();

            const before = await store.getNLCClassifiers(projectid);
            assert.equal(before.length, 0);

            const countBefore = await store.countNLCClassifiers(classid);
            assert.equal(countBefore, 0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'nlc',
                url : uuid(),
            };
            const userid = uuid();

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.NLCClassifier = {
                classifierid : randomstring.generate({ length : 9 }),
                created,
                language : 'en',
                name : 'DUMMY',
                url : uuid(),
            };

            await store.storeNLCClassifier(
                credentials, userid, classid, projectid,
                classifierInfo,
            );

            const after = await store.getNLCClassifiers(projectid);
            assert.equal(after.length, 1);

            const countAfter = await store.countNLCClassifiers(classid);
            assert.equal(countAfter, 1);


            const retrieved = after[0];

            assert.deepEqual(retrieved, classifierInfo);

            await store.deleteNLCClassifier(projectid, userid, classid, classifierInfo.classifierid);

            const empty = await store.getNLCClassifiers(projectid);
            assert.equal(empty.length, 0);

            const countEmpty = await store.countNLCClassifiers(classid);
            assert.equal(countEmpty, 0);
        });

    });

});
