/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as randomstring from 'randomstring';

import * as dbobjects from '../../lib/db/objects';
import * as Objects from '../../lib/db/db-types';
import * as constants from '../../lib/utils/constants';
import * as TrainingObjects from '../../lib/training/training-types';



describe('DB objects', () => {

    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_STRING: string = undefined;
    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_NUMBERS: number[] = undefined;
    // @ts-ignore need to check for values that might be undefined at runtime
    const UNDEFINED_LANG: Objects.TextProjectLanguage = undefined;


    describe('getProjectFromDbRow()', () => {
        it('should return labels for ids from DB', () => {
            const userid = 'testuser';
            const classid = 'testclass';
            const projectid = uuid();

            const testRow: Objects.ProjectDbRow = {
                id : projectid,
                userid, classid,
                language : 'ar',
                typeid : 2,
                name : 'testproject',
                labels : '',
                numfields : 2,
                fields : [
                    { id : uuid(), userid, classid, projectid, name : 'first', fieldtype : 1, choices : undefined },
                    { id : uuid(), userid, classid, projectid, name : 'second', fieldtype : 1, choices : undefined },
                ],
                iscrowdsourced : false,
            };

            const testProject: Objects.Project = dbobjects.getProjectFromDbRow(testRow);

            assert.strictEqual(testProject.isCrowdSourced, false);
            assert.strictEqual(testProject.type, 'numbers');
            assert.deepStrictEqual(testProject.fields, [
                { type : 'number', name : 'first', choices : [] },
                { type : 'number', name : 'second', choices : [] },
            ]);
        });

        it('should default language to English if unspecified', () => {
            const userid = 'testuser';
            const classid = 'testclass';
            const projectid = uuid();

            const testRow: Objects.ProjectDbRow = {
                id : projectid,
                userid, classid,
                typeid : 1,
                language : UNDEFINED_LANG,
                name : 'testproject',
                labels : '',
                numfields : 0,
                fields : [],
                iscrowdsourced : false,
            };

            const testProject: Objects.Project = dbobjects.getProjectFromDbRow(testRow);

            assert.strictEqual(testProject.type, 'text');
            assert.strictEqual(testProject.language, 'en');
            assert.strictEqual(testProject.isCrowdSourced, false);
        });
    });

    describe('createLabel', () => {

        it('should remove spaces', () => {
            assert.strictEqual(dbobjects.createLabel('One Two Three'),
                         'One_Two_Three');
        });

        it('should remove special characters', () => {
            assert.strictEqual(dbobjects.createLabel('It\'s over here?'),
                         'It_s_over_here_');
        });

        it('should remove hyphens', () => {
            assert.strictEqual(dbobjects.createLabel('Science-Fiction'),
                         'Science_Fiction');
        });

        it('should remove slashes', () => {
            assert.strictEqual(dbobjects.createLabel('Forward/Backward\\Pipe|'),
                         'Forward_Backward_Pipe_');
        });

        it('should remove quotes', () => {
            assert.strictEqual(dbobjects.createLabel('Single\'s "doubles" and `ticks`'),
                         'Single_s__doubles__and__ticks_');
        });

        it('should remove brackets', () => {
            assert.strictEqual(dbobjects.createLabel('This (and) [the] other'),
                         'This__and___the__other');
        });

        it('should remove wildcard characters', () => {
            assert.strictEqual(dbobjects.createLabel('$2 * $3'),
                         '_2____3');
        });


    });


    describe('getClassFromDbRow()', () => {
        const testRow: Objects.ClassDbRow = {
            id : uuid(),
            projecttypes : 'text,numbers',
            ismanaged : 0,
            maxusers : 3,
            maxprojectsperuser : 4,
            textclassifiersexpiry : 9,
        };
        const expectedPolicy: Objects.ClassTenant = {
            id : testRow.id,
            supportedProjectTypes : ['text', 'numbers'],
            tenantType : Objects.ClassTenantType.UnManaged,
            maxUsers : 3,
            maxProjectsPerUser : 4,
            textClassifierExpiry : 9,
        };

        it('should return tenant policy info', () => {
            assert.deepStrictEqual(dbobjects.getClassFromDbRow(testRow),
                                   expectedPolicy);
            assert.deepStrictEqual(dbobjects.getClassFromDbRow({ ...testRow, ismanaged : 1 }),
                                   { ...expectedPolicy, tenantType : Objects.ClassTenantType.Managed });
            assert.deepStrictEqual(dbobjects.getClassFromDbRow({ ...testRow, ismanaged : 2 }),
                                   { ...expectedPolicy, tenantType : Objects.ClassTenantType.ManagedPool });

        });

        it('should get tenant data as DB row', () => {
            assert.deepStrictEqual(testRow, dbobjects.getClassDbRow(expectedPolicy));
            assert.deepStrictEqual({ ...testRow, ismanaged : 1 },
                                     dbobjects.getClassDbRow({ ...expectedPolicy, tenantType : Objects.ClassTenantType.Managed }));
            assert.deepStrictEqual({ ...testRow, ismanaged : 2 },
                                     dbobjects.getClassDbRow({ ...expectedPolicy, tenantType : Objects.ClassTenantType.ManagedPool }));
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

            assert.deepStrictEqual(dbobjects.getTextTrainingFromDbRow(testRow), expectedTraining);
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

            assert.deepStrictEqual(dbobjects.getNumberTrainingFromDbRow(testRow), expectedTraining);
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

            assert.deepStrictEqual(dbobjects.getNumberTrainingFromDbRow(testRow), expectedTraining);
        });
    });


    describe('getImageTrainingFromDbRow()', () => {
        it('should return training data', () => {
            const testRow: Objects.ImageTrainingDbRow = {
                id : uuid(),
                imageurl : 'http://images.com/example/image1.jpg',
                projectid : 'testproject',
                isstored : 0,
            };
            const expectedTraining: Objects.ImageTraining = {
                id : testRow.id,
                imageurl : testRow.imageurl,
                projectid : 'testproject',
                isstored : false,
            };

            assert.deepStrictEqual(dbobjects.getImageTrainingFromDbRow(testRow), expectedTraining);
        });

        it('should return stored training data', () => {
            const testRow: Objects.ImageTrainingDbRow = {
                id : uuid(),
                imageurl : '/api/classes/1234564c-d9b7-840c-31fa-9482e1d22f79/students/auth0|2a1bbf3ab125e11dcfd65d52/projects/123bc7d2-f14a-22e9-9a84-c911211cd225/images/11223344-24e1-8844-2c24-1232711a93a9',
                projectid : 'testproject',
                isstored : 1,
            };
            const expectedTraining: Objects.ImageTraining = {
                id : testRow.id,
                imageurl : testRow.imageurl,
                projectid : 'testproject',
                isstored : true,
                userid : 'auth0|2a1bbf3ab125e11dcfd65d52',
            };

            assert.deepStrictEqual(dbobjects.getImageTrainingFromDbRow(testRow), expectedTraining);
        });
    });



    describe('getLabelListFromArray()', () => {

        it('should protect against long lists', () => {
            const labelsList = [];
            for (let i = 0; i < 50; i++) {
                labelsList.push(randomstring.generate({ length : 12 }));
            }
            try {
                dbobjects.getLabelListFromArray(labelsList);
                assert.fail('Should not have reached here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'No room for the label');
            }
        });

    });


    describe('getLabelsFromList()', () => {
        it('should handle empty lists', () => {
            assert.deepStrictEqual(dbobjects.getLabelsFromList(''), [ ]);
        });
        it('should remove empty items', () => {
            assert.deepStrictEqual(dbobjects.getLabelsFromList('apple,,banana'), [ 'apple', 'banana' ]);
        });
        it('should trim items', () => {
            assert.deepStrictEqual(dbobjects.getLabelsFromList('apple,  ,banana , cabbage'),
                             [ 'apple', 'banana', 'cabbage' ]);
        });
    });


    describe('createProject()', () => {
        it('should reject invalid project types', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'invalidtype', 'projectname', 'en', [], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid project type invalidtype');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should require user id', (done) => {
            try {
                dbobjects.createProject('', 'myclass', 'text', 'projectname', 'en', [], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should require class id', (done) => {
            try {
                dbobjects.createProject('bob', '', 'text', 'projectname', 'en', [], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should require project name', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'text', UNDEFINED_STRING, 'en', [], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should require a language', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'text', 'project', UNDEFINED_LANG, [], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Language not supported');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should require a valid language', (done) => {
            try {
                dbobjects.createProject('bob', 'bobclass', 'text', 'project',
                                        'xxx' as Objects.TextProjectLanguage,
                                        [], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Language not supported');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should create a project object', () => {
            const project = dbobjects.createProject('testuser', 'testclass', 'text', 'testproject', 'de', [], false);
            assert(project.id);
            assert.strictEqual(project.name, 'testproject');
            assert.strictEqual(project.classid, 'testclass');
            assert.strictEqual(project.typeid, 1);
            assert.strictEqual(project.userid, 'testuser');
            assert.strictEqual(project.language, 'de');
            assert.strictEqual(project.iscrowdsourced, false);
        });

        it('should create a crowdsourced project object', () => {
            const project = dbobjects.createProject('testuser', 'testclass', 'text', 'testproject', 'de', [], true);
            assert(project.id);
            assert.strictEqual(project.name, 'testproject');
            assert.strictEqual(project.classid, 'testclass');
            assert.strictEqual(project.typeid, 1);
            assert.strictEqual(project.userid, 'testuser');
            assert.strictEqual(project.language, 'de');
            assert.strictEqual(project.iscrowdsourced, true);
        });

        it('should need options for multichoice fields in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = { name : 'a', type : 'multichoice' };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Not enough choices provided');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should need enough options for multichoice fields in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = {
                    name : 'a', type : 'multichoice', choices : [ 'onlyone' ],
                };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Not enough choices provided');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should prevent duplicate fields in numbers projects', (done) => {
            try {
                const fields: Objects.NumbersProjectFieldSummary[] = [
                    { name : 'a', type : 'multichoice', choices : [ 'onlyone' ] },
                    { name : 'b', type : 'number', choices : [] },
                    { name : 'a', type : 'number', choices : [] },
                    { name : 'c', type : 'multichoice', choices : [ 'yes', 'no' ] },
                ];
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', fields, false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Fields all need different names');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should prevent too many options for multichoice fields in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = {
                    name : 'a', type : 'multichoice',
                    choices : [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm' ],
                };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Too many choices specified');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should prevent empty options for multichoice fields in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = {
                    name : 'a', type : 'multichoice',
                    choices : [ 'a', '', 'c' ],
                };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid choice value');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should prevent choices that start with numbers in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = {
                    name : 'a', type : 'multichoice',
                    choices : [ 'a', '1Boo' ],
                };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid choice value');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should prevent commas in choices in multichoice fields in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = {
                    name : 'a', type : 'multichoice',
                    choices : [ 'a', 'This , Should', 'c' ],
                };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid choice value');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should prevent over long options for multichoice fields in numbers projects', (done) => {
            try {
                const field: Objects.NumbersProjectFieldSummary = {
                    name : 'a', type : 'multichoice',
                    choices : [ 'a', 'This Is A Stupidly Long Option To Include', 'c' ],
                };
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [ field ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid choice value');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should limit the number of fields for numbers projects', (done) => {
            try {
                dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en',
                    [
                        { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                        { name : 'c', type : 'number' }, { name : 'd', type : 'number' },
                        { name : 'e', type : 'number' }, { name : 'f', type : 'number' },
                        { name : 'g', type : 'number' }, { name : 'h', type : 'number' },
                        { name : 'i', type : 'number' }, { name : 'j', type : 'number' },
                        { name : 'k', type : 'number' }, { name : 'l', type : 'number' },
                        { name : 'm', type : 'number' }, { name : 'n', type : 'number' },
                    ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Too many fields specified');
                return done();
            }
            assert.fail('Failed to reject project');
        });

        it('should restrict fields to numbers projects', (done) => {
            try {
                dbobjects.createProject('testuser', 'testclass', 'text', 'testproject', 'en', [
                    { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                    { name : 'c', type : 'number' },
                ], false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Fields not supported for non-numbers projects');
                return done();
            }
            assert.fail('Failed to reject project');
        });


        it('should prepare numbers projects', () => {
            const project = dbobjects.createProject('testuser', 'testclass', 'numbers', 'testproject', 'en', [
                { name : 'a', type : 'number' }, { name : 'b', type : 'number' },
                { name : 'c', type : 'number' },
                { name : 'd', type : 'multichoice', choices : [ 'left', 'right' ] },
            ], false);

            assert(project.id);
            assert.strictEqual(project.classid, 'testclass');
            assert.strictEqual(project.labels, '');
            assert.strictEqual(project.name, 'testproject');
            assert.strictEqual(project.numfields, 4);
            assert.strictEqual(project.fields.length, 4);
            assert.strictEqual(project.typeid, 2);
            assert.strictEqual(project.userid, 'testuser');
            assert.strictEqual(project.iscrowdsourced, false);
            project.fields.forEach((field) => {
                assert(field.id);
                assert.strictEqual(field.classid, 'testclass');
                assert.strictEqual(field.userid, 'testuser');
                assert.strictEqual(field.projectid, project.id);
            });
            assert.strictEqual(project.fields[0].fieldtype, 1);
            assert.strictEqual(project.fields[1].fieldtype, 1);
            assert.strictEqual(project.fields[2].fieldtype, 1);
            assert.strictEqual(project.fields[3].fieldtype, 2);
            assert.strictEqual(project.fields[3].choices, 'left,right');
        });
    });


    describe('createTextTraining()', () => {
        it('should require project id', (done) => {
            try {
                dbobjects.createTextTraining('', 'text', 'label');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should require text data', (done) => {
            try {
                dbobjects.createTextTraining('testproject', UNDEFINED_STRING, UNDEFINED_STRING);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should remove tabs from text data', () => {
            const training = dbobjects.createTextTraining('testproject',
                'This should	include a tab. Do not remove	it.', 'mylabel');
            assert.strictEqual(training.textdata, 'This should include a tab. Do not remove it.');
        });

        it('should remove new lines from text data', () => {
            const training = dbobjects.createTextTraining('testproject',
                'This should include a new line.\nDo not remove it.', 'mylabel');
            assert.strictEqual(training.textdata, 'This should include a new line. Do not remove it.');
        });

        it('should allow training data without labels', () => {
            const training = dbobjects.createTextTraining('testproject', 'mytext', UNDEFINED_STRING);
            assert(training.id);
            assert.strictEqual(training.projectid, 'testproject');
            assert.strictEqual(training.textdata, 'mytext');
        });

        it('should create training data objects', () => {
            const training = dbobjects.createTextTraining('testproject', 'mytext', 'mylabel');
            assert(training.id);
            assert.strictEqual(training.projectid, 'testproject');
            assert.strictEqual(training.textdata, 'mytext');
            assert.strictEqual(training.label, 'mylabel');
        });
    });


    describe('createNumberTraining()', () => {
        it('should require project id', (done) => {
            try {
                dbobjects.createNumberTraining('', [1], 'label');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should require number data', (done) => {
            try {
                dbobjects.createNumberTraining('testproject', UNDEFINED_NUMBERS, UNDEFINED_STRING);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should require at least one number data item', (done) => {
            try {
                dbobjects.createNumberTraining('testproject', [], UNDEFINED_STRING);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should require valid number data', (done) => {
            try {
                dbobjects.createNumberTraining('testproject', [10, 'HELLO', 34] as any, UNDEFINED_STRING);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Data contains non-numeric items');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should allow training data without labels', () => {
            const training = dbobjects.createNumberTraining('testproject', [123, 456], UNDEFINED_STRING);
            assert(training.id);
            assert.strictEqual(training.projectid, 'testproject');
            assert.deepStrictEqual(training.numberdata, [123, 456]);
        });

        it('should limit the number of training data objects', (done) => {
            try {
                dbobjects.createNumberTraining(
                    'testproject',
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
                    'mylabel');
                assert.fail('Should not have allowed this');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Number of data items exceeded maximum');
                return done();
            }
            assert.fail('Failed to reject training');
        });


        it('should create training data objects', () => {
            const training = dbobjects.createNumberTraining('testproject', [0.1, 200, -999.888], 'mylabel');
            assert(training.id);
            assert.strictEqual(training.projectid, 'testproject');
            assert.deepStrictEqual(training.numberdata, [0.1, 200, -999.888]);
            assert.strictEqual(training.label, 'mylabel');
        });
    });


    describe('createImageTraining()', () => {
        it('should require project id', (done) => {
            try {
                dbobjects.createImageTraining('', 'myimageurl', 'label', false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should not require an image label', () => {
            const training = dbobjects.createImageTraining('projectid', 'trainingurl', UNDEFINED_STRING, false);
            assert(training.id);
            assert.strictEqual(training.projectid, 'projectid');
            assert.strictEqual(training.imageurl, 'trainingurl');
        });

        it('should allow ID to be provided', () => {
            const testImageId = 'TESTIMAGEID';
            const training = dbobjects.createImageTraining('projectid', 'trainingurl', 'testlabel', true, testImageId);
            assert.strictEqual(training.label, 'testlabel');
            assert.strictEqual(training.projectid, 'projectid');
            assert.strictEqual(training.imageurl, 'trainingurl');
            assert.strictEqual(training.id, testImageId);
        });


        it('should require an image url', (done) => {
            try {
                dbobjects.createImageTraining('projectid', UNDEFINED_STRING, UNDEFINED_STRING, false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject training');
        });

        it('should require a storable image url', (done) => {
            try {
                dbobjects.createImageTraining('projectid', randomstring.generate({ length : 1500 }), 'label', false);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Image URL exceeds maximum allowed length (1024 characters)');
                return done();
            }
            assert.fail('Failed to reject training');
        });
    });


    describe('getCredentialsAsDbRow', () => {

        it('should handle missing credentials types', () => {
            const creds: TrainingObjects.BluemixCredentials = {
                id : 'theid',
                classid : 'theclassid',
                username : 'theusername',
                password : 'thepassword',
                servicetype : 'conv',
                url : 'theurl',
            } as TrainingObjects.BluemixCredentials;
            const result = dbobjects.getCredentialsAsDbRow(creds);
            assert.strictEqual(result.credstypeid, 0);
        });

        it('should translate conv credentials types to an id', () => {
            const creds: TrainingObjects.BluemixCredentials = {
                id : 'theid',
                classid : 'theclassid',
                username : 'theusername',
                password : 'thepassword',
                servicetype : 'conv',
                url : 'theurl',
                credstype : 'conv_lite',
            };
            const result = dbobjects.getCredentialsAsDbRow(creds);
            assert.strictEqual(result.credstypeid, 1);
        });
    });


    describe('createBluemixCredentials', () => {

        it('should require a service type', (done) => {
            try {
                dbobjects.createBluemixCredentials(UNDEFINED_STRING,
                    'class', 'apikey', UNDEFINED_STRING, UNDEFINED_STRING, 'unknown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a valid service type', (done) => {
            try {
                dbobjects.createBluemixCredentials('blah',
                    'class', 'apikey', UNDEFINED_STRING, UNDEFINED_STRING, 'unknown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid service type');
                return done();
            }
            assert.fail('Failed to reject request');
        });


        it('should require a username for conversation credentials', (done) => {
            try {
                dbobjects.createBluemixCredentials('conv', 'class', undefined, undefined, 'password', 'unknown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a password for conversation credentials', (done) => {
            try {
                dbobjects.createBluemixCredentials('conv', 'class', undefined, 'username', undefined, 'unknown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a valid username for conversation credentials', (done) => {
            try {
                dbobjects.createBluemixCredentials('conv', 'class', undefined, 'username', 'password', 'unknown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid credentials');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a valid password for conversation credentials', (done) => {
            try {
                dbobjects.createBluemixCredentials('conv', 'class', undefined,
                    'Mhtugfiuq6DNTMFRrwdMk2DUcvgAWj7W9jOL', 'password', 'unknown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid credentials');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require 44 char API keys for conversation credentials', () => {
            try {
                dbobjects.createBluemixCredentials('conv', 'class',
                    'xo1Nisc2iDTGNUfU9KzCxhxo1Nisc2iDTGNUfU9KzCxhn2mrxvA8_YVERYDl-kaBdW',
                    undefined, undefined, 'unknown');
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid API key');
            }
        });

        it('should support API keys for conversation credentials', () => {
            const creds = dbobjects.createBluemixCredentials('conv', 'class',
                'xo1Nisc2iDTGNUfU9KzCxhn2mrxvA8_YVERYDl-kaBdW', undefined, undefined, 'unknown');
            assert(creds.id);
            assert(creds.url);
            assert.strictEqual(creds.servicetype, 'conv');
            assert.strictEqual(creds.username, 'xo1Nisc2iDTGNUfU9KzCxh');
            assert.strictEqual(creds.password, 'n2mrxvA8_YVERYDl-kaBdW');
        });

        it('should create conversation credentials', () => {
            const VALID_TYPES = ['conv_lite', 'conv_standard', 'conv_plus', 'conv_plustrial', 'unknown'];

            for (const type of VALID_TYPES) {
                const creds = dbobjects.createBluemixCredentials('conv', 'class',
                    undefined, 'Mhtugfiuq6DNTMFRrwdMk2DUcvgAWj7W9jOL', 'THTBtUnNl5jT', type);
                assert(creds.id);
                assert(creds.url);
                assert.strictEqual(creds.servicetype, 'conv');
                assert.strictEqual(creds.username, 'Mhtugfiuq6DNTMFRrwdMk2DUcvgAWj7W9jOL');
                assert.strictEqual(creds.password, 'THTBtUnNl5jT');
                assert.strictEqual(creds.credstype, type);
            }
        });
    });



    describe('create pending job', () => {

        const classid = 'classid';
        const userid = 'userid';
        const projectid = 'projectid';
        const imageid = 'imageid';

        it('should require a class id for image jobs', (done) => {
            try {
                dbobjects.createDeleteObjectStoreJob({
                    classid : UNDEFINED_STRING,
                    userid, projectid, objectid: imageid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a userid id for image jobs', (done) => {
            try {
                dbobjects.createDeleteObjectStoreJob({
                    userid : UNDEFINED_STRING,
                    classid, projectid, objectid: imageid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required user id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a project id for image jobs', (done) => {
            try {
                dbobjects.createDeleteObjectStoreJob({
                    projectid : UNDEFINED_STRING,
                    classid, userid, objectid: imageid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required project id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a image id for image jobs', (done) => {
            try {
                dbobjects.createDeleteObjectStoreJob({
                    objectid : UNDEFINED_STRING,
                    classid, userid, projectid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required object id');
                return done();
            }
            assert.fail('Failed to reject request');
        });



        it('should require a class id for project jobs', (done) => {
            try {
                dbobjects.createDeleteProjectObjectsJob({
                    classid : UNDEFINED_STRING,
                    userid, projectid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a userid id for project jobs', (done) => {
            try {
                dbobjects.createDeleteProjectObjectsJob({
                    userid : UNDEFINED_STRING,
                    classid, projectid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required user id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a project id for project jobs', (done) => {
            try {
                dbobjects.createDeleteProjectObjectsJob({
                    projectid : UNDEFINED_STRING,
                    classid, userid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required project id');
                return done();
            }
            assert.fail('Failed to reject request');
        });


        it('should require a class id for user jobs', (done) => {
            try {
                dbobjects.createDeleteUserObjectsJob({
                    classid : UNDEFINED_STRING,
                    userid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a userid id for user jobs', (done) => {
            try {
                dbobjects.createDeleteUserObjectsJob({
                    userid : UNDEFINED_STRING,
                    classid,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required user id');
                return done();
            }
            assert.fail('Failed to reject request');
        });


        it('should require a class id for class jobs', (done) => {
            try {
                dbobjects.createDeleteClassObjectsJob({
                    classid : UNDEFINED_STRING,
                });
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });
    });



    describe('getKnownErrorFromDbRow', () => {

        it('should get data from DB records', () => {
            assert.deepStrictEqual(dbobjects.getKnownErrorFromDbRow({
                id : '001', type : 1, servicetype : 'conv', objid : 'abc',
            }), {
                id : '001', type : 1, servicetype : 'conv', objid : 'abc',
            });
        });

    });


    describe('createKnownError', () => {

        it('should reject invalid service types', () => {
            try {
                dbobjects.createKnownError(1, 'wrong' as TrainingObjects.BluemixServiceType, 'objid');
                assert.fail('should not have reached here');
            }
            catch (err) {
                assert(err);
                assert.strictEqual(err.message, 'Unexpected service type');
            }
        });

        it('should reject invalid error types', () => {
            try {
                dbobjects.createKnownError(9, 'conv', 'objid');
                assert.fail('should not have reached here');
            }
            catch (err) {
                assert(err);
                assert.strictEqual(err.message, 'Unexpected error type');
            }
        });

    });


    describe('setClassTenantExpiries', () => {

        const emptyUnknown: unknown = null;
        const emptyNum: number = emptyUnknown as number;
        const emptyTenant: Objects.ClassTenant = emptyUnknown as Objects.ClassTenant;
        const stringVal: unknown = 'hello';
        const stringNum: number = stringVal as number;
        const tenant = dbobjects.getDefaultClassTenant(uuid());

        const tests: [ Objects.ClassTenant, number, string ][] = [
            [ emptyTenant, 34, 'Missing tenant info to update' ],
            //
            [ tenant, emptyNum, 'Missing required expiry value' ],
            //
            [ tenant, stringNum, 'Expiry values should be an integer number of hours'],
            //
            [ tenant, 10.2, 'Expiry values should be an integer number of hours'],
            //
            [ tenant, -123, 'Expiry values should be a positive number of hours'],
            //
            [ tenant, 300, 'Expiry values should not be greater than 255 hours'],
        ];

        it('should handle invalid input', () => {
            for (const test of tests) {
                try {
                    dbobjects.setClassTenantExpiries(test[0], test[1]);
                    assert.fail('should not have reached here');
                }
                catch (err) {
                    assert(err);
                    assert.strictEqual(err.message, test[2]);
                }
            }
        });

        it('should update expiry numbers', () => {
            const updated = dbobjects.setClassTenantExpiries({ ... tenant }, 123);
            assert.strictEqual(tenant.id, updated.id);
            assert.strictEqual(tenant.maxUsers, updated.maxUsers);
            assert.strictEqual(tenant.maxProjectsPerUser, updated.maxProjectsPerUser);
            assert.strictEqual(tenant.tenantType, updated.tenantType);
            assert.strictEqual(123, updated.textClassifierExpiry);
        });
    });


    describe('createClassTenant', () => {

        it('should require a class id', (done) => {
            try {
                dbobjects.createClassTenant(UNDEFINED_STRING);
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a long enough class id', (done) => {
            try {
                dbobjects.createClassTenant('x');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Not a valid class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a short enough class id', (done) => {
            try {
                dbobjects.createClassTenant('abcdefghijklmnopqrstuvwxyzabcdefghijk');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Not a valid class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require lowercase class ids', (done) => {
            try {
                dbobjects.createClassTenant('HELLO');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Not a valid class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require only letters in class ids', (done) => {
            try {
                dbobjects.createClassTenant('hello world');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Not a valid class id');
                return done();
            }
            assert.fail('Failed to reject request');
        });

        it('should require a valid class id', () => {
            const created = dbobjects.createClassTenant('testing');
            assert.deepStrictEqual(created, {
                id : 'testing',
                projecttypes : 'text,imgtfjs,numbers,sounds',
                ismanaged : 0,
                maxusers : 30,
                maxprojectsperuser : 3,
                textclassifiersexpiry : 24,
            });
        });
    });


    describe('createSiteAlert', () => {

        it('should create an error ready for inserting into the DB', () => {
            const before = Date.now();
            const alert = dbobjects.createSiteAlert(
                'my message', 'http://go.here.com',
                'supervisor',
                'error',
                constants.ONE_HOUR);
            const after = Date.now();

            assert(alert.timestamp.getTime() >= before);
            assert(alert.timestamp.getTime() <= after);

            assert(alert.expiry.getTime() - constants.ONE_HOUR >= before);
            assert(alert.expiry.getTime() - constants.ONE_HOUR <= after);

            assert.strictEqual(alert.message, 'my message');
            assert.strictEqual(alert.url, 'http://go.here.com');
            assert.strictEqual(alert.severityid, 3, 'severity');
            assert.strictEqual(alert.audienceid, 3, 'audience');
        });

        it('should create a warning ready for inserting into the DB', () => {
            const before = Date.now();
            const alert = dbobjects.createSiteAlert(
                'my message', 'http://go.here.com',
                'public',
                'warning',
                constants.ONE_HOUR);
            const after = Date.now();

            assert(alert.timestamp.getTime() >= before);
            assert(alert.timestamp.getTime() <= after);

            assert(alert.expiry.getTime() - constants.ONE_HOUR >= before);
            assert(alert.expiry.getTime() - constants.ONE_HOUR <= after);

            assert.strictEqual(alert.message, 'my message');
            assert.strictEqual(alert.url, 'http://go.here.com');
            assert.strictEqual(alert.severityid, 2);
            assert.strictEqual(alert.audienceid, 1);
        });

        it('should create an info message ready for inserting into the DB', () => {
            const before = Date.now();
            const alert = dbobjects.createSiteAlert(
                'my message', 'http://go.here.com',
                'student',
                'info',
                constants.ONE_HOUR);
            const after = Date.now();

            assert(alert.timestamp.getTime() >= before);
            assert(alert.timestamp.getTime() <= after);

            assert(alert.expiry.getTime() - constants.ONE_HOUR >= before);
            assert(alert.expiry.getTime() - constants.ONE_HOUR <= after);

            assert.strictEqual(alert.message, 'my message');
            assert.strictEqual(alert.url, 'http://go.here.com');
            assert.strictEqual(alert.severityid, 1);
            assert.strictEqual(alert.audienceid, 2);
        });

        it('should reject messages that wont fit in the DB', () => {
            try {
                dbobjects.createSiteAlert(
                    'This is my message. It is very long. This is my message. It is very long. This is my message. ' +
                    'This is my message. It is very long. This is my message. It is very long. This is my message. ' +
                    'This is my message. It is very long. This is my message. It is very long. This is my message. ',
                    'http://go.here.com',
                    'student',
                    'info',
                    constants.ONE_HOUR);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid message');
            }
        });

        it('should reject empty messages', () => {
            try {
                dbobjects.createSiteAlert(
                    '',
                    'http://go.here.com',
                    'student',
                    'info',
                    constants.ONE_HOUR);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Missing required attributes');
            }
        });

        it('should reject URLs that wont fit in the DB', () => {
            try {
                dbobjects.createSiteAlert(
                    'This is my message.',
                    'https://www.thisisaverylongurl-soitwillberejected-asitisreallyverylong-' +
                        'sothevalidationcodeshouldrejectit-andnotallowittocontinue-messages-' +
                        'will-go-in-here-validatingthelengthofthewebaddress-using-stringlen-' +
                        'sothevalidationcodeshouldrejectit-andnotallowittocontinue-messages-' +
                        'will-go-in-here-validatingthelengthofthewebaddress-using-stringlen-' +
                        'sothevalidationcodeshouldrejectit-andnotallowittocontinue-messages-' +
                        'will-go-in-here-validatingthelengthofthewebaddress-using-stringlength' +
                        '.com',
                    'supervisor',
                    'error',
                    constants.ONE_HOUR);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid URL');
            }
        });

        it('should reject invalid audiences', () => {
            try {
                dbobjects.createSiteAlert(
                    'This is my message.',
                    'https://alert.com',
                    'mystery',
                    'error',
                    constants.ONE_HOUR);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid audience type mystery');
            }
        });

        it('should reject invalid severities', () => {
            try {
                dbobjects.createSiteAlert(
                    'This is my message.',
                    'https://alert.com',
                    'public',
                    'invalid',
                    constants.ONE_HOUR);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid severity type invalid');
            }
        });

        it('should reject non-numeric expiry times', () => {
            try {
                const expiry = 'hello' as unknown;
                const expiryNum = expiry as number;
                dbobjects.createSiteAlert(
                    'This is my message.',
                    'https://alert.com',
                    'public',
                    'error',
                    expiryNum);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid expiry');
            }
        });

        it('should reject negative expiry times', () => {
            try {
                dbobjects.createSiteAlert(
                    'This is my message.',
                    'https://alert.com',
                    'public',
                    'error',
                    - 100);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid expiry');
            }
        });

        it('should reject zero expiry times', () => {
            try {
                dbobjects.createSiteAlert(
                    'This is my message.',
                    'https://alert.com',
                    'public',
                    'error',
                    0);
                assert.fail('should not get here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Invalid expiry');
            }
        });
    });
});
