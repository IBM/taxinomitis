/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';

import * as dbobjects from '../../lib/db/objects';
import * as Objects from '../../lib/db/db-types';



describe('DB objects - sound', () => {

    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_STRING: string = undefined;

    const EXPECTED_KEYS = ['id', 'label', 'audiodataid', 'projectid'].sort();


    describe('getSoundTrainingFromDbRow', () => {

        it('should process DB contents that include a project id', () => {
            const dbrow: Objects.SoundTrainingDbRow = {
                id : uuid(),
                label : randomstring.generate(),
                audiodataid : uuid(),
                projectid : uuid(),
            };
            const obj = dbobjects.getSoundTrainingFromDbRow(dbrow);
            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(obj).sort());
            assert.strictEqual(obj.id, dbrow.id);
            assert.strictEqual(obj.label, dbrow.label);
            assert.strictEqual(obj.projectid, dbrow.projectid);
            assert.deepStrictEqual(obj.audiodataid, dbrow.audiodataid);
        });

        it('should process DB contents', () => {
            const dbrow: Objects.SoundTrainingDbRow = {
                id : uuid(),
                label : randomstring.generate(),
                projectid : uuid(),
                audiodataid : uuid(),
            };
            const obj = dbobjects.getSoundTrainingFromDbRow(dbrow);
            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(obj).sort());
            assert.strictEqual(obj.id, dbrow.id);
            assert.strictEqual(obj.label, dbrow.label);
            assert.deepStrictEqual(obj.audiodataid, dbrow.audiodataid);
        });
    });


    describe('createSoundTrainingDbRow', () => {

        it('should prepare an object for inserting into the DB', () => {
            const obj: Objects.SoundTraining = {
                id : uuid(),
                label : randomstring.generate(),
                audiodataid : uuid(),
                projectid : uuid(),
            };
            const row = dbobjects.createSoundTrainingDbRow(obj);
            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(row).sort());
            assert.strictEqual(row.id, obj.id);
            assert.strictEqual(row.label, obj.label);
            assert.strictEqual(row.projectid, obj.projectid);
            assert.strictEqual(row.audiodataid, obj.audiodataid);
        });
    });


    describe('createSoundTraining', () => {

        it('should create an object given valid input', () => {
            const projectid = uuid();
            const data = uuid();
            const label = randomstring.generate();

            const obj = dbobjects.createSoundTraining(projectid, label, data);

            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(obj).sort());
            assert(obj.id);
            assert.strictEqual(typeof obj.id, 'string');
            assert.strictEqual(obj.id.length, 36);
            assert.strictEqual(obj.projectid, projectid);
            assert.strictEqual(obj.label, label);
            assert.deepStrictEqual(obj.audiodataid, data);
        });

        it('should handle missing project IDs', () => {
            try {
                dbobjects.createSoundTraining(UNDEFINED_STRING, 'audiodataid', 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty project IDs', () => {
            try {
                dbobjects.createSoundTraining('', 'label', '');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle missing labels', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiodataid', UNDEFINED_STRING);
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty labels', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiodataid', '');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should handle missing data', () => {
            try {
                dbobjects.createSoundTraining('projectid', UNDEFINED_STRING, 'label');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
    });
});
