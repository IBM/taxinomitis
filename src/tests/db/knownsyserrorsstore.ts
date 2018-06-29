/*eslint-env mocha */
import * as assert from 'assert';
import * as store from '../../lib/db/store';
import * as Types from '../../lib/training/training-types';
import * as uuid from 'uuid/v1';


describe('DB store - known sys errors', () => {


    before(() => {
        return store.init()
            .then(() => {
                return store.deleteAllKnownErrors();
            });
    });
    after(() => {
        return store.disconnect();
    });



    it('should store a new credentials error', async () => {
        const allErrorsBefore = await store.getAllKnownErrors();

        const objid = uuid();
        const knownError = await store.storeNewKnownError(
            Types.KnownErrorCondition.BadBluemixCredentials,
            'conv',
            objid);

        assert(knownError.id);

        const allErrorsAfter: Types.KnownError[] = await store.getAllKnownErrors();

        assert.strictEqual(allErrorsAfter.length, allErrorsBefore.length + 1);

        assert(allErrorsAfter.some((err) => {
            return err.id === knownError.id &&
                   err.objid === knownError.objid &&
                   err.servicetype === knownError.servicetype &&
                   err.type === knownError.type;
        }));
    });





    it('should store a new classifier error', async () => {
        const allErrorsBefore = await store.getAllKnownErrors();

        const objid = uuid();
        const knownError = await store.storeNewKnownError(
            Types.KnownErrorCondition.UnmanagedBluemixClassifier,
            'visrec',
            objid);

        assert(knownError.id);

        const allErrorsAfter: Types.KnownError[] = await store.getAllKnownErrors();

        assert.strictEqual(allErrorsAfter.length, allErrorsBefore.length + 1);

        assert(allErrorsAfter.some((err) => {
            return err.id === knownError.id &&
                   err.objid === knownError.objid &&
                   err.servicetype === knownError.servicetype &&
                   err.type === knownError.type;
        }));
    });


    it('should protect against object ids that wont fit in the DB table', async () => {
        try {
            await store.storeNewKnownError(
                Types.KnownErrorCondition.UnmanagedBluemixClassifier,
                'conv',
                uuid() + uuid() + uuid());
            assert.fail('should not have reached here');
        }
        catch (err) {
            assert(err);
            assert.strictEqual(err.message, 'Bad object id');
        }
    });



    it('should protect against missing object ids', async () => {
        try {
            await store.storeNewKnownError(
                Types.KnownErrorCondition.BadBluemixCredentials,
                'visrec',
                '');
            assert.fail('should not have reached here');
        }
        catch (err) {
            assert(err);
            assert.strictEqual(err.message, 'Bad object id');
        }
    });

});
