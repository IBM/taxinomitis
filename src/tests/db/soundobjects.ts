/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';

import * as dbobjects from '../../lib/db/objects';
import * as Objects from '../../lib/db/db-types';



describe('DB objects - sound', () => {

    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_STRING: string = undefined;
    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_NUMBERS: number[] = undefined;
    // @ts-ignore need to check for values that might be undefined at runtime
    const INVALID_NUMBERS: number[] = 'pretend';
    // @ts-ignore need to check for values that might be undefined at runtime
    const NONARRAY_NUMBERS: number[] = 123;
    // @ts-ignore need to check for values that might be undefined at runtime
    const OBJ_NUMBERS: number[] = { hello : 'world' };


    describe('round trip', () => {
        const numbers: number[] = [];
        for (let i = 0; i < 9650; i++) {
            numbers.push(Math.random());
        }
        const projectid = uuid();
        const label = randomstring.generate();

        const obj = dbobjects.createSoundTraining(projectid, numbers, label);

        const row = dbobjects.createSoundTrainingDbRow(obj);

        const restoredObj = dbobjects.getSoundTrainingFromDbRow(row);

        assert.deepStrictEqual(obj, restoredObj);
        assert.strictEqual(numbers.join(','), row.audiodata);

        assert.strictEqual(restoredObj.label, label);
        assert.strictEqual(restoredObj.projectid, projectid);
    });


    describe('getSoundTrainingFromDbRow', () => {

        it('should process DB contents that include a project id', () => {
            const dbrow: Objects.SoundTrainingDbRow = {
                id : uuid(),
                label : randomstring.generate(),
                audiodata : '1.0130,-1.23124,0.2143245,1,0,0.141241,-0.4325',
                projectid : uuid(),
            };
            const obj = dbobjects.getSoundTrainingFromDbRow(dbrow);
            assert.deepStrictEqual(['id', 'audiodata', 'label', 'projectid'], Object.keys(obj));
            assert.strictEqual(obj.id, dbrow.id);
            assert.strictEqual(obj.label, dbrow.label);
            assert.strictEqual(obj.projectid, dbrow.projectid);
            assert.deepStrictEqual(obj.audiodata,
                [1.0130, -1.23124, 0.2143245, 1, 0, 0.141241, -0.4325]);
        });

        it('should process DB contents', () => {
            const dbrow: Objects.SoundTrainingDbRow = {
                id : uuid(),
                label : randomstring.generate(),
                audiodata : '1,0,-1,1.0123,0.1231,-0.141,1.23100,1.1321400',
            };
            const obj = dbobjects.getSoundTrainingFromDbRow(dbrow);
            assert.deepStrictEqual(['id', 'audiodata', 'label'], Object.keys(obj));
            assert.strictEqual(obj.id, dbrow.id);
            assert.strictEqual(obj.label, dbrow.label);
            assert.deepStrictEqual(obj.audiodata,
                [1, 0, -1, 1.0123, 0.1231, -0.141, 1.231, 1.13214]);
        });
    });


    describe('createSoundTrainingDbRow', () => {

        it('should prepare an object for inserting into the DB', () => {
            const obj: Objects.SoundTraining = {
                id : uuid(),
                label : randomstring.generate(),
                audiodata : [1, 2.0123, -0.1241, 1.124],
                projectid : uuid(),
            };
            const row = dbobjects.createSoundTrainingDbRow(obj);
            assert.deepStrictEqual(['id', 'audiodata', 'label', 'projectid'], Object.keys(row));
            assert.strictEqual(row.id, obj.id);
            assert.strictEqual(row.label, obj.label);
            assert.strictEqual(row.projectid, obj.projectid);
            assert.strictEqual(row.audiodata, '1,2.0123,-0.1241,1.124');
        });
    });


    describe('createSoundTraining', () => {

        it('should create an object given valid input', () => {
            const projectid = uuid();
            const data = [1.0123, 0.184284, -1.2314252, 1.242000001, 2.214235];
            const label = randomstring.generate();

            const obj = dbobjects.createSoundTraining(projectid, data, label);

            assert.deepStrictEqual(['id', 'projectid', 'audiodata', 'label'], Object.keys(obj));
            assert(obj.id);
            assert.strictEqual(typeof obj.id, 'string');
            assert.strictEqual(obj.id.length, 36);
            assert.strictEqual(obj.projectid, projectid);
            assert.strictEqual(obj.label, label);
            assert.deepStrictEqual(obj.audiodata, data);
        });

        it('should handle missing project IDs', () => {
            try {
                dbobjects.createSoundTraining(UNDEFINED_STRING, [1.01, 0, -12.3124], 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty project IDs', () => {
            try {
                dbobjects.createSoundTraining('', [1.01, 0, -12.3124], 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle missing labels', () => {
            try {
                dbobjects.createSoundTraining('projectid', [1.01, 0, -12.3124], UNDEFINED_STRING);
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty labels', () => {
            try {
                dbobjects.createSoundTraining('projectid', [1.01, 0, -12.3124], '');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should handle missing data', () => {
            try {
                dbobjects.createSoundTraining('projectid', UNDEFINED_NUMBERS, 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle invalid data', () => {
            try {
                dbobjects.createSoundTraining('projectid', INVALID_NUMBERS, 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle object data', () => {
            try {
                dbobjects.createSoundTraining('projectid', OBJ_NUMBERS, 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle non-array data', () => {
            try {
                dbobjects.createSoundTraining('projectid', NONARRAY_NUMBERS, 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should handle empty data', () => {
            try {
                dbobjects.createSoundTraining('projectid', [], 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Empty audio is not allowed');
            }
        });

        it('should handle too much data', () => {
            const numbers: number[] = [];
            for (let i = 0; i < 25000; i++) {
                numbers.push(Math.random());
            }

            try {
                dbobjects.createSoundTraining('projectid', numbers, 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Audio exceeds maximum allowed length');
            }
        });

        it('should handle non-numeric data', () => {
            try {
                dbobjects.createSoundTraining('projectid', [
                    1.23, -0.35345, 'naughty', 1.024, 0,
                ], 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid audio input');
            }
        });
    });
});
