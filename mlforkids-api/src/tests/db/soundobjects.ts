/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as randomstring from 'randomstring';

import * as dbobjects from '../../lib/db/objects';
import * as Objects from '../../lib/db/db-types';



describe('DB objects - sound', () => {

    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_STRING: string = undefined;
    // @ts-ignore need to check for values that might be invalid at runtime
    const INVALID_STRING: string = 123;

    const EXPECTED_KEYS = ['id', 'label', 'audiourl', 'projectid'].sort();


    describe('getSoundTrainingFromDbRow', () => {

        it('should process DB contents that include a project id', () => {
            const dbrow: Objects.SoundTrainingDbRow = {
                id : uuid(),
                label : randomstring.generate(),
                audiourl : uuid(),
                projectid : uuid(),
            };
            const obj = dbobjects.getSoundTrainingFromDbRow(dbrow);
            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(obj).sort());
            assert.strictEqual(obj.id, dbrow.id);
            assert.strictEqual(obj.label, dbrow.label);
            assert.strictEqual(obj.projectid, dbrow.projectid);
            assert.deepStrictEqual(obj.audiourl, dbrow.audiourl);
        });

        it('should process DB contents', () => {
            const dbrow: Objects.SoundTrainingDbRow = {
                id : uuid(),
                label : randomstring.generate(),
                projectid : uuid(),
                audiourl : uuid(),
            };
            const obj = dbobjects.getSoundTrainingFromDbRow(dbrow);
            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(obj).sort());
            assert.strictEqual(obj.id, dbrow.id);
            assert.strictEqual(obj.label, dbrow.label);
            assert.deepStrictEqual(obj.audiourl, dbrow.audiourl);
        });
    });


    describe('createSoundTrainingDbRow', () => {

        it('should prepare an object for inserting into the DB', () => {
            const obj: Objects.SoundTraining = {
                id : uuid(),
                label : randomstring.generate(),
                audiourl : uuid(),
                projectid : uuid(),
            };
            const row = dbobjects.createSoundTrainingDbRow(obj);
            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(row).sort());
            assert.strictEqual(row.id, obj.id);
            assert.strictEqual(row.label, obj.label);
            assert.strictEqual(row.projectid, obj.projectid);
            assert.strictEqual(row.audiourl, obj.audiourl);
        });
    });


    describe('createSoundTraining', () => {

        it('should create an object given valid input', () => {
            const id = uuid();
            const projectid = uuid();
            const data = uuid();
            const label = randomstring.generate();

            const obj = dbobjects.createSoundTraining(projectid, data, label, id);

            assert.deepStrictEqual(EXPECTED_KEYS, Object.keys(obj).sort());
            assert(obj.id);
            assert.strictEqual(typeof obj.id, 'string');
            assert.strictEqual(obj.id.length, 36);
            assert.strictEqual(obj.projectid, projectid);
            assert.strictEqual(obj.label, label);
            assert.deepStrictEqual(obj.audiourl, data);
        });

        it('should handle missing project IDs', () => {
            try {
                dbobjects.createSoundTraining(UNDEFINED_STRING, 'audiourl', 'label', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle invalid project IDs', () => {
            try {
                dbobjects.createSoundTraining(INVALID_STRING, 'audiourl', 'label', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty project IDs', () => {
            try {
                dbobjects.createSoundTraining('', 'audiourl', 'label', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should handle missing audio data', () => {
            try {
                dbobjects.createSoundTraining('projectid', UNDEFINED_STRING, 'label', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle invalid audio data', () => {
            try {
                dbobjects.createSoundTraining('projectid', INVALID_STRING, 'label', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty audio data', () => {
            try {
                dbobjects.createSoundTraining('projectid', '', 'label', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should handle missing label', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiourl', UNDEFINED_STRING, 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle invalid label', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiourl', INVALID_STRING, 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty label', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiourl', '', 'id');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should handle missing id', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiourl', 'label', UNDEFINED_STRING);
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle invalid id', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiourl', 'label', INVALID_STRING);
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });
        it('should handle empty id', () => {
            try {
                dbobjects.createSoundTraining('projectid', 'audiourl', 'label', '');
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

    });
});
