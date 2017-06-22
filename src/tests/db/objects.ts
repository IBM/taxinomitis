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
                fields : 'first,second',
            };
            const testProject: Objects.Project = dbobjects.getProjectFromDbRow(testRow);

            assert.equal(testProject.type, 'numbers');
            assert.deepEqual(testProject.fields, ['first', 'second']);
        });
    });


    describe('getClassFromDbRow()', () => {
        it('should return tenant policy info', () => {
            const testRow: Objects.ClassDbRow = {
                id : uuid(),
                projecttypes : 'text,numbers',
                maxusers : 3,
                maxprojectsperuser : 2,
                maxnlcclassifiers : 5,
                nlcexpirydays : 10,
            };
            const expectedPolicy: Objects.ClassTenant = {
                id : testRow.id,
                supportedProjectTypes : ['text', 'numbers'],
                maxUsers : 3,
                maxProjectsPerUser : 2,
                maxNLCClassifiers : 5,
                nlcExpiryDays : 10,
            };

            assert.deepEqual(dbobjects.getClassFromDbRow(testRow), expectedPolicy);
        });
    });


    describe('getTextTrainingFromDbRow()', () => {
        it('should return training info', () => {
            const testRow: Objects.TextTrainingDbRow = {
                id : uuid(),
                textdata : uuid(),
            };
            const expectedTraining: Objects.TextTraining = {
                id : testRow.id,
                textdata : testRow.textdata,
            };

            assert.deepEqual(dbobjects.getTextTrainingFromDbRow(testRow), expectedTraining);
        });
    });


    describe('getNumberTrainingFromDbRow()', () => {
        it('should return training data', () => {
            const testRow: Objects.NumberTrainingDbRow = {
                id : uuid(),
                numberdata : '1,3,4.3,-5.1,9.3214,0.1',
            };
            const expectedTraining: Objects.NumberTraining = {
                id : testRow.id,
                numberdata : [ 1, 3, 4.3, -5.1, 9.3214, 0.1 ],
            };

            assert.deepEqual(dbobjects.getNumberTrainingFromDbRow(testRow), expectedTraining);
        });

        it('should return training data with labels', () => {
            const testRow: Objects.NumberTrainingDbRow = {
                id : uuid(),
                numberdata : '1,11,0.9,80',
                label : 'mylabel',
                projectid : uuid(),
            };
            const expectedTraining: Objects.NumberTraining = {
                id : testRow.id,
                numberdata : [ 1, 11, 0.9, 80 ],
                label : 'mylabel',
                projectid : testRow.projectid,
            };

            assert.deepEqual(dbobjects.getNumberTrainingFromDbRow(testRow), expectedTraining);
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
                dbobjects.createProject('bob', 'bobclass', 'invalidtype', 'projectname', []);
            }
            catch (err) {
                assert.equal(err.message, 'Invalid project type invalidtype');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should require user id', (done) => {
            try {
                dbobjects.createProject('', 'myclass', 'text', 'projectname', []);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should require class id', (done) => {
            try {
                dbobjects.createProject('bob', '', 'text', 'projectname', []);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should require project name', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'text', undefined, []);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject project', '');
        });

        it('should create a project object', () => {
            const project = dbobjects.createProject('testuser', 'testclass', 'text', 'testproject', []);
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


    describe('createNumberTraining()', () => {
        it('should require project id', (done) => {
            try {
                dbobjects.createNumberTraining('', [1], 'label');
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });

        it('should require number data', (done) => {
            try {
                dbobjects.createNumberTraining('testproject', undefined, undefined);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });

        it('should require at least one number data item', (done) => {
            try {
                dbobjects.createNumberTraining('testproject', [], undefined);
            }
            catch (err) {
                assert.equal(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });

        it('should require valid number data', (done) => {
            try {
                dbobjects.createNumberTraining('testproject', [10, 'HELLO', 34] as any, undefined);
            }
            catch (err) {
                assert.equal(err.message, 'Data contains non-numeric items');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });

        it('should allow training data without labels', () => {
            const training = dbobjects.createNumberTraining('testproject', [123, 456], undefined);
            assert(training.id);
            assert.equal(training.projectid, 'testproject');
            assert.deepEqual(training.numberdata, [123, 456]);
        });

        it('should limit the number of training data objects', (done) => {
            try {
                dbobjects.createNumberTraining(
                    'testproject',
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
                    'mylabel');
                assert.fail(0, 1, 'Should not have allowed this', '');
            }
            catch (err) {
                assert.equal(err.message, 'Number of data items exceeded maximum');
                return done();
            }
            assert.fail(1, 0, 'Failed to reject training', '');
        });


        it('should create training data objects', () => {
            const training = dbobjects.createNumberTraining('testproject', [0.1, 200, -999.888], 'mylabel');
            assert(training.id);
            assert.equal(training.projectid, 'testproject');
            assert.deepEqual(training.numberdata, [0.1, 200, -999.888]);
            assert.equal(training.label, 'mylabel');
        });
    });
});
