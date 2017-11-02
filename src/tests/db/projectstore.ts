/*eslint-env mocha */
import * as assert from 'assert';
import * as util from 'util';
import * as uuid from 'uuid/v1';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';


const TESTCLASS = 'UNIQUECLASSID';


describe('DB store', () => {

    before(() => {
        return store.init();
    });
    before(() => {
        return store.deleteProjectsByClassId(TESTCLASS);
    });

    after(async () => {
        await store.deleteProjectsByClassId(TESTCLASS);
        return store.disconnect();
    });


    describe('deleteProjects', () => {

        it('should delete projects by userid', async () => {
            const user = uuid();

            let projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 0);

            await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 1);

            await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 2);

            await store.storeProject(uuid(), TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 2);

            await store.deleteEntireUser(user, TESTCLASS);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 0);
        });

    });


    describe('getProject', () => {
        it('should return nothing for a non-existent project', async () => {
            const retrieved = await store.getProject(uuid());
            assert(!retrieved);
        });

        it('should retrieve a project', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'images';

            const project = await store.storeProject(userid, classid, typelabel, name, 'en', []);

            let retrieved = await store.getProject(project.id);
            assert.equal(retrieved.id, project.id);
            assert.equal(retrieved.name, name);
            assert.equal(retrieved.classid, classid);
            assert.equal(retrieved.type, typelabel);
            assert.equal(retrieved.userid, userid);

            await store.deleteEntireProject(userid, classid, project);

            retrieved = await store.getProject(project.id);
            assert(!retrieved);
        });
    });


    describe('getNumberProjectFields', () => {
        it('should maintain order of project fields', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'numbers';
            const numberfields: Objects.NumbersProjectFieldSummary[] = [
                { name : 'first', type : 'number' },
                { name : 'second', type : 'number' },
                { name : 'third', type : 'number' },
                { name : 'fourth', type : 'number' },
                { name : 'fifth', type : 'number' },
                { name : 'sixth', type : 'number' },
                { name : 'seventh', type : 'number' },
                { name : 'eighth', type : 'number' },
                { name : 'ninth', type : 'number' },
            ];

            const project = await store.storeProject(userid, classid, typelabel, name, 'en', numberfields);

            const fields = await store.getNumberProjectFields(userid, classid, project.id);
            assert.equal(fields.length, 9);

            assert.equal(fields[0].name, 'first');
            assert.equal(fields[1].name, 'second');
            assert.equal(fields[2].name, 'third');
            assert.equal(fields[3].name, 'fourth');
            assert.equal(fields[4].name, 'fifth');
            assert.equal(fields[5].name, 'sixth');
            assert.equal(fields[6].name, 'seventh');
            assert.equal(fields[7].name, 'eighth');
            assert.equal(fields[8].name, 'ninth');

            await store.deleteEntireProject(userid, classid, project);
        });

        it('should retrieve project fields', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'numbers';
            const numField: Objects.NumbersProjectFieldSummary = {
                name : 'mynumber', type : 'number',
            };
            const chcField: Objects.NumbersProjectFieldSummary = {
                name : 'myoption', type : 'multichoice', choices : [ 'male', 'female' ],
            };

            const project = await store.storeProject(userid, classid, typelabel, name, 'en', [ numField, chcField ]);

            let retrieved = await store.getProject(project.id);
            assert.equal(retrieved.id, project.id);
            assert.equal(retrieved.name, name);
            assert.equal(retrieved.classid, classid);
            assert.equal(retrieved.type, typelabel);
            assert.equal(retrieved.userid, userid);
            assert.equal(retrieved.numfields, 2);

            const fields = await store.getNumberProjectFields(userid, classid, project.id);
            assert.equal(fields.length, 2);
            fields.forEach((field) => {
                assert(field.id);
                assert.equal(field.userid, userid);
                assert.equal(field.classid, classid);
                assert.equal(field.projectid, project.id);
            });

            assert.equal(fields[0].name, 'mynumber');
            assert.equal(fields[1].name, 'myoption');

            assert.equal(fields[0].type, 'number');
            assert.equal(fields[1].type, 'multichoice');

            assert.deepEqual(fields[0].choices, []);
            assert.deepEqual(fields[1].choices, [ 'male', 'female' ]);

            await store.deleteEntireProject(userid, classid, project);

            retrieved = await store.getProject(project.id);
            assert(!retrieved);

            const noFields = await store.getNumberProjectFields(userid, classid, project.id);
            assert.deepEqual(noFields, []);
        });
    });


    describe('countProjects', () => {

        it('should return 0 for unknown users', async () => {
            const unknownUser = uuid();
            const unknownClass = uuid();

            const count = await store.countProjectsByUserId(unknownUser, unknownClass);

            assert.equal(count, 0);
        });

    });


    describe('storeProject', () => {

        it('should return an empty list for unknown users', async () => {
            const unknownClass = uuid();

            const projects = await store.getProjectsByClassId(unknownClass);

            assert(util.isArray(projects));
            assert.equal(projects.length, 0);
        });


        it('should return projects for a classid', async () => {
            const firstUser = uuid();
            const secondUser = uuid();

            await store.deleteProjectsByClassId(TESTCLASS);

            let projects = await store.getProjectsByClassId(TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 0);

            await store.storeProject(firstUser, TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 1);

            await store.storeProject(secondUser, TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, 2);
        });


        it('should return projects for a user', async () => {
            const firstUser = uuid();
            const secondUser = uuid();

            let projects = await store.getProjectsByClassId(TESTCLASS);
            assert(util.isArray(projects));
            const numProjects = projects.length;

            await store.storeProject(firstUser, TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, numProjects + 1);

            await store.storeProject(secondUser, TESTCLASS, 'text', uuid(), 'en', []);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(util.isArray(projects));
            assert.equal(projects.length, numProjects + 2);

            projects = await store.getProjectsByUserId(firstUser, TESTCLASS);
            assert.equal(projects.length, 1);
            projects = await store.getProjectsByUserId(secondUser, TESTCLASS);
            assert.equal(projects.length, 1);
        });

    });


    describe('addLabelToProject', () => {

        it('should add a label to a project', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', []);

            let retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, []);

            const label1 = randomstring.generate({ length : 16 });
            let newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepEqual(newlabels, [ label1 ]);

            retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, [ label1 ]);

            const label2 = randomstring.generate({ length : 16 });
            newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label2);
            assert.deepEqual(newlabels, [ label1, label2 ]);

            retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, [ label1, label2 ]);
        });

        it('should not store duplicate labels', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', []);

            let retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, []);

            const label1 = randomstring.generate({ length : 16 });
            let newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepEqual(newlabels, [ label1 ]);

            retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, [ label1 ]);

            newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepEqual(newlabels, [ label1 ]);

            retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, [ label1 ]);
        });


        it('should not store empty labels', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', []);

            let retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, []);

            const label1 = '';
            const newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepEqual(newlabels, [ '' ]);

            retrieved = await store.getProject(project.id);
            assert.deepEqual(retrieved.labels, [  ]);
        });

    });


    describe('removeLabelFromProject', () => {

        async function createProjectWithLabels(userid, labels) {
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', []);
            for (const label of labels) {
                await store.addLabelToProject(userid, TESTCLASS, project.id, label);
            }
            return project.id;
        }

        it('should remove a label from a text project', async () => {
            const userid = uuid();
            const labels = [ 'america', 'belgium', 'canada', 'denmark' ];
            const projectid = await createProjectWithLabels(userid, labels);

            await store.storeTextTraining(projectid, 'aalborg', 'denmark');
            await store.storeTextTraining(projectid, 'kolding', 'denmark');
            await store.storeTextTraining(projectid, 'montreal', 'canada');
            await store.storeTextTraining(projectid, 'mons', 'belgium');
            await store.storeTextTraining(projectid, 'ostend', 'belgium');
            await store.storeTextTraining(projectid, 'brussels', 'belgium');

            const countBefore = await store.countTrainingByLabel('text', projectid);
            assert.deepEqual(countBefore, {
                belgium : 3, canada : 1, denmark : 2,
            });

            const newLabels = await store.removeLabelFromProject(userid, TESTCLASS, projectid, 'belgium');
            assert.deepEqual(newLabels, [ 'america', 'canada', 'denmark' ]);

            const project = await store.getProject(projectid);
            assert.deepEqual(project.labels, [ 'america', 'canada', 'denmark' ]);

            const countAfter = await store.countTrainingByLabel('text', projectid);
            assert.deepEqual(countAfter, {
                canada : 1, denmark : 2,
            });
        });


        it('should not remove a label not in a project', async () => {
            const userid = uuid();
            const labels = [ 'hampshire', 'berkshire', 'wiltshire', 'sussex' ];
            const projectid = await createProjectWithLabels(userid, labels);

            const newLabels = await store.removeLabelFromProject(userid, TESTCLASS, projectid, 'london');
            assert.deepEqual(newLabels, labels);

            const project = await store.getProject(projectid);
            assert.deepEqual(project.labels, labels);
        });


        it('should not remove an empty label', async () => {
            const userid = uuid();
            const labels = [ 'hampshire', 'berkshire', 'wiltshire', 'sussex' ];
            const projectid = await createProjectWithLabels(userid, labels);

            const newLabels = await store.removeLabelFromProject(userid, TESTCLASS, projectid, '');
            assert.deepEqual(newLabels, labels);

            const project = await store.getProject(projectid);
            assert.deepEqual(project.labels, labels);
        });

        it('should remove all labels from a project', async () => {
            const userid = uuid();
            const labels = [ 'one', 'two' ];
            const projectid = await createProjectWithLabels(userid, labels);

            let newLabels = await store.removeLabelFromProject(userid, TESTCLASS, projectid, 'one');
            assert.deepEqual(newLabels, [ 'two' ]);

            newLabels = await store.removeLabelFromProject(userid, TESTCLASS, projectid, 'two');
            assert.deepEqual(newLabels, [ ]);
        });

    });



    describe('deleteEntireUser()', () => {

        it('should remove user projects', async () => {
            const userid = uuid();

            await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', []);
            await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', []);

            const count = await store.countProjectsByUserId(userid, TESTCLASS);
            assert.equal(count, 2);

            await store.deleteEntireUser(userid, TESTCLASS);

            const countAfter = await store.countProjectsByUserId(userid, TESTCLASS);
            assert.equal(countAfter, 0);
        });

    });

});
