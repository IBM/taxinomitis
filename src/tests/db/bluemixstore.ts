/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
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


    describe('NLC classifiers', () => {

        it('should store and retrieve NLC classifiers', async () => {
            const projectid = uuid();

            const before = await store.getNLCClassifiers(projectid);
            assert.equal(before.length, 0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : uuid(),
                password : uuid(),
                servicetype : 'nlc',
                url : uuid(),
            };
            const userid = uuid();
            const classid = uuid();

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.NLCClassifier = {
                classifierid : 'ABCDEFGHI',
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

            const retrieved = after[0];

            assert.deepEqual(retrieved, classifierInfo);

            await store.deleteNLCClassifiersByProjectId(projectid);

            const empty = await store.getNLCClassifiers(projectid);
            assert.equal(empty.length, 0);
        });

    });

});
