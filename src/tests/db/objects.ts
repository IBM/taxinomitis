/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';

import * as dbobjects from '../../lib/db/objects';
import * as Objects from '../../lib/db/db-types';



describe('DB objects', () => {

    describe('getProjectFromDbRow()', () => {
        it('should return labels for ids from DB', () => {
            const testRow: Objects.ProjectDbRow = {
                id : uuid(),
                userid : 'testuser',
                classid : 'testclass',
                typeid : 2,
                name : 'testproject',
                labels : '',
            };
            const testProject: Objects.Project = dbobjects.getProjectFromDbRow(testRow);

            assert.equal(testProject.type, 'numbers');
        });
    });


    describe('getLabelsFromList()', () => {
        it('should handle empty lists', () => {
            assert.deepEqual(dbobjects.getLabelsFromList(''), [ ]);
        });
        it('should remove empty items', () => {
            assert.deepEqual(dbobjects.getLabelsFromList('apple,,banana'), [ 'apple', 'banana' ]);
        });
        it('should trim items', () => {
            assert.deepEqual(dbobjects.getLabelsFromList('apple,  ,banana , cabbage'),
                             [ 'apple', 'banana', 'cabbage' ]);
        });
    });


    describe('createProject()', () => {
        it('should reject invalid project types', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'invalidtype', 'projectname');
            }
            catch (err) {
                assert.equal(err.message, 'Invalid project type invalidtype');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should require user id', (done) => {
            try {
                dbobjects.createProject('', 'myclass', 'text', 'projectname');
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should require class id', (done) => {
            try {
                dbobjects.createProject('bob', '', 'text', 'projectname');
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should require project name', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'text', undefined);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should create a project object', () => {
            const project = dbobjects.createProject('testuser', 'testclass', 'text', 'testproject');
            assert(project.id);
            assert.equal(project.name, 'testproject');
            assert.equal(project.classid, 'testclass');
            assert.equal(project.typeid, 1);
            assert.equal(project.userid, 'testuser');
        });
    });


    describe('createTextTraining()', () => {
        it('should require project id', (done) => {
            try {
                dbobjects.createTextTraining('', 'text', 'label');
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });

        it('should require text data', (done) => {
            try {
                dbobjects.createTextTraining('testproject', undefined, undefined);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });

        it('should allow training data without labels', () => {
            const training = dbobjects.createTextTraining('testproject', 'mytext', undefined);
            assert(training.id);
            assert.equal(training.projectid, 'testproject');
            assert.equal(training.textdata, 'mytext');
        });

        it('should create training data objects', () => {
            const training = dbobjects.createTextTraining('testproject', 'mytext', 'mylabel');
            assert(training.id);
            assert.equal(training.projectid, 'testproject');
            assert.equal(training.textdata, 'mytext');
            assert.equal(training.label, 'mylabel');
        });
    });
});
