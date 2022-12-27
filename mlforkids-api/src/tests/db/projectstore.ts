/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';

import * as store from '../../lib/db/store';
import * as Objects from '../../lib/db/db-types';
import * as numbers from '../../lib/training/numbers';


const TESTCLASS = 'UNIQUECLASSID';


describe('DB store', () => {

    let numbersStubDeleteClassifierStub: sinon.SinonStub<any, any>;

    before(() => {
        numbersStubDeleteClassifierStub = sinon.stub(numbers, 'deleteClassifier')
            .callsFake((user: string, classid: string, project: string) => {
                assert(user);
                assert(classid);
                assert(project);
                return Promise.resolve();
            });

        return store.init();
    });
    before(() => {
        return store.deleteProjectsByClassId(TESTCLASS);
    });

    after(async () => {
        await store.deleteProjectsByClassId(TESTCLASS);
        numbersStubDeleteClassifierStub.restore();
        return store.disconnect();
    });


    describe('init', () => {
        it('should cope with multiple init calls', () => {
            return store.init();
        });
    });

    describe('deleteProjects', () => {

        it('should delete projects by userid', async () => {
            const user = uuid();

            let projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 0);

            await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 1);

            await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 2);

            await store.storeProject(uuid(), TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 2);

            await store.deleteEntireUser(user, TESTCLASS);

            projects = await store.getProjectsByUserId(user, TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 0);
        });

        it('should not delete shared projects when a student is deleted', async () => {
            const classid = uuid();

            const student = uuid();
            const teacher = uuid();

            const studentproject1 = 'student proj 1';
            const studentproject2 = 'student proj 2';
            const teacherproject = 'class proj';

            await store.storeProject(student, classid, 'text', studentproject1, 'en', [], false);
            await store.storeProject(student, classid, 'text', studentproject2, 'en', [], false);
            await store.storeProject(teacher, classid, 'text', teacherproject, 'en', [], true);

            let projects = await store.getProjectsByClassId(classid);
            assert.strictEqual(projects.length, 3);
            assert.deepStrictEqual(projects.map(p => p.name).sort(), [teacherproject, studentproject1, studentproject2]);

            await store.deleteEntireUser(student, classid);

            projects = await store.getProjectsByClassId(classid);
            assert.strictEqual(projects.length, 1);
            assert.deepStrictEqual(projects.map(p => p.name), [teacherproject]);

            await store.deleteProjectsByClassId(classid);
        });

    });


    describe('getProject', () => {
        it('should return nothing for a non-existent project', async () => {
            const retrieved = await store.getProject(uuid());
            assert(!retrieved);
        });

        it('should retrieve a crowd-sourced project', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'images';

            const project = await store.storeProject(userid, classid, typelabel, name, 'en', [], true);

            let retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.id, project.id);
                assert.strictEqual(retrieved.name, name);
                assert.strictEqual(retrieved.classid, classid);
                assert.strictEqual(retrieved.type, typelabel);
                assert.strictEqual(retrieved.userid, userid);
                assert.strictEqual(retrieved.isCrowdSourced, true);

                await store.deleteEntireProject(userid, classid, project);
            }

            retrieved = await store.getProject(project.id);
            assert(!retrieved);
        });

        it('should retrieve a project', async () => {
            const userid = uuid();
            const classid = uuid();
            const name = uuid();
            const typelabel = 'images';

            const project = await store.storeProject(userid, classid, typelabel, name, 'en', [], false);

            let retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.id, project.id);
                assert.strictEqual(retrieved.name, name);
                assert.strictEqual(retrieved.classid, classid);
                assert.strictEqual(retrieved.type, typelabel);
                assert.strictEqual(retrieved.userid, userid);
                assert.strictEqual(retrieved.isCrowdSourced, false);

                await store.deleteEntireProject(userid, classid, project);
            }

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

            const project = await store.storeProject(userid, classid, typelabel, name, 'en', numberfields, false);

            const fields = await store.getNumberProjectFields(userid, classid, project.id);
            assert.strictEqual(fields.length, 9);

            assert.strictEqual(fields[0].name, 'first');
            assert.strictEqual(fields[1].name, 'second');
            assert.strictEqual(fields[2].name, 'third');
            assert.strictEqual(fields[3].name, 'fourth');
            assert.strictEqual(fields[4].name, 'fifth');
            assert.strictEqual(fields[5].name, 'sixth');
            assert.strictEqual(fields[6].name, 'seventh');
            assert.strictEqual(fields[7].name, 'eighth');
            assert.strictEqual(fields[8].name, 'ninth');

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

            const project = await store.storeProject(userid, classid,
                                                     typelabel, name, 'en',
                                                     [ numField, chcField ],
                                                     false);

            let retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.strictEqual(retrieved.id, project.id);
                assert.strictEqual(retrieved.name, name);
                assert.strictEqual(retrieved.classid, classid);
                assert.strictEqual(retrieved.type, typelabel);
                assert.strictEqual(retrieved.userid, userid);
                assert.strictEqual(retrieved.numfields, 2);
            }

            const fields = await store.getNumberProjectFields(userid, classid, project.id);
            assert.strictEqual(fields.length, 2);
            fields.forEach((field) => {
                assert(field.id);
                assert.strictEqual(field.userid, userid);
                assert.strictEqual(field.classid, classid);
                assert.strictEqual(field.projectid, project.id);
            });

            assert.strictEqual(fields[0].name, 'mynumber');
            assert.strictEqual(fields[1].name, 'myoption');

            assert.strictEqual(fields[0].type, 'number');
            assert.strictEqual(fields[1].type, 'multichoice');

            assert.deepStrictEqual(fields[0].choices, []);
            assert.deepStrictEqual(fields[1].choices, [ 'male', 'female' ]);

            await store.deleteEntireProject(userid, classid, project);

            retrieved = await store.getProject(project.id);
            assert(!retrieved);

            const noFields = await store.getNumberProjectFields(userid, classid, project.id);
            assert.deepStrictEqual(noFields, []);
        });
    });


    describe('countProjects', () => {

        it('should return 0 for unknown users', async () => {
            const unknownUser = uuid();
            const unknownClass = uuid();

            const count = await store.countProjectsByUserId(unknownUser, unknownClass);

            assert.strictEqual(count, 0);
        });

    });


    describe('storeProject', () => {

        it.skip('should recognise SQL errors about unsupported characters', () => {
            return store.storeProject('USERID', 'CLASSID', 'text',
                                      'ğooğle', 'en', [], false)
                        .then(() => {
                            assert.fail('Should not have stored a project with this name');
                        })
                        .catch((err) => {
                            assert.strictEqual(err.message,
                                'Sorry, some of those letters can\'t be used in project names');
                        });
        });

        it('should return an empty list for unknown users', async () => {
            const unknownClass = uuid();

            const projects = await store.getProjectsByClassId(unknownClass);

            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 0);
        });


        it('should return projects for a classid', async () => {
            const firstUser = uuid();
            const secondUser = uuid();

            await store.deleteProjectsByClassId(TESTCLASS);

            let projects = await store.getProjectsByClassId(TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 0);

            await store.storeProject(firstUser, TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 1);

            await store.storeProject(secondUser, TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, 2);
        });


        it('should return projects for a user', async () => {
            const firstUser = uuid();
            const secondUser = uuid();

            let projects = await store.getProjectsByClassId(TESTCLASS);
            assert(Array.isArray(projects));
            const numProjects = projects.length;

            await store.storeProject(firstUser, TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, numProjects + 1);

            await store.storeProject(secondUser, TESTCLASS, 'text', uuid(), 'en', [], false);

            projects = await store.getProjectsByClassId(TESTCLASS);
            assert(Array.isArray(projects));
            assert.strictEqual(projects.length, numProjects + 2);

            projects = await store.getProjectsByUserId(firstUser, TESTCLASS);
            assert.strictEqual(projects.length, 1);
            projects = await store.getProjectsByUserId(secondUser, TESTCLASS);
            assert.strictEqual(projects.length, 1);
        });

    });


    describe('getProjectsByUserId', () => {

        const CLASSID = uuid();

        after(() => {
            return store.deleteProjectsByClassId(CLASSID);
        });

        function getNumProjects(userid: string, classid: string): Promise<number> {
            return store.getProjectsByUserId(userid, classid)
                .then((projects) => {
                    assert(Array.isArray(projects));
                    return projects.length;
                });
        }

        interface ProjsCount {
            readonly userid: string;
            readonly classid: string;
            readonly expected: number;
        }

        async function verifyProjectCounts(expecteds: ProjsCount[]): Promise<void> {
            for (const expected of expecteds) {
                const count = await getNumProjects(expected.userid, expected.classid);
                assert.strictEqual(count, expected.expected);
            }
        }

        it('should return projects the user has access to', async () => {

            const userA = uuid();
            const userB = uuid();
            const userC = uuid();

            await verifyProjectCounts([
                { userid : userA, classid : CLASSID, expected : 0 },
                { userid : userB, classid : CLASSID, expected : 0 },
                { userid : userC, classid : CLASSID, expected : 0 },
            ]);

            await store.storeProject(userA, CLASSID, 'text', uuid(), 'en', [], false);

            await verifyProjectCounts([
                { userid : userA, classid : CLASSID, expected : 1 },
                { userid : userB, classid : CLASSID, expected : 0 },
                { userid : userC, classid : CLASSID, expected : 0 },
            ]);

            await store.storeProject(userA, CLASSID, 'text', uuid(), 'en', [], false);
            await store.storeProject(userB, CLASSID, 'text', uuid(), 'en', [], false);

            await verifyProjectCounts([
                { userid : userA, classid : CLASSID, expected : 2 },
                { userid : userB, classid : CLASSID, expected : 1 },
                { userid : userC, classid : CLASSID, expected : 0 },
            ]);

            await store.storeProject(uuid(), CLASSID, 'text', uuid(), 'en', [], true);

            await verifyProjectCounts([
                { userid : userA, classid : CLASSID, expected : 3 },
                { userid : userB, classid : CLASSID, expected : 2 },
                { userid : userC, classid : CLASSID, expected : 1 },
            ]);

            await store.storeProject(userA, TESTCLASS, 'text', uuid(), 'en', [], true);
            await store.storeProject(userA, TESTCLASS, 'text', uuid(), 'en', [], false);

            await verifyProjectCounts([
                { userid : userA, classid : CLASSID, expected : 3 },
                { userid : userB, classid : CLASSID, expected : 2 },
                { userid : userC, classid : CLASSID, expected : 1 },
            ]);
        });

    });


    describe('addLabelToProject', () => {

        it('should handle non-existent projects', (done) => {
            store.addLabelToProject(uuid(), TESTCLASS, 'text', 'MYNEWLABEL')
                .then(() => {
                    assert.fail('should not have let this happen');
                })
                .catch((err) => {
                    assert.strictEqual(err.message, 'Project not found');
                    done();
                });
        });

        it('should ignore (case-insensitive) duplicate labels', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);

            let labels = await store.addLabelToProject(userid, TESTCLASS, project.id, 'NEW_LABEL');
            assert.deepStrictEqual(labels, [ 'NEW_LABEL' ]);

            labels = await store.addLabelToProject(userid, TESTCLASS, project.id, 'second');
            assert.deepStrictEqual(labels, [ 'NEW_LABEL', 'second' ]);

            labels = await store.addLabelToProject(userid, TESTCLASS, project.id, 'new_label');
            assert.deepStrictEqual(labels, [ 'NEW_LABEL', 'second' ]);

            labels = await store.addLabelToProject(userid, TESTCLASS, project.id, 'New_Label');
            assert.deepStrictEqual(labels, [ 'NEW_LABEL', 'second' ]);

            await store.deleteEntireProject(userid, TESTCLASS, project);
        });

        it('should add a label to a project', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);

            let retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, []);
            }

            const label1 = randomstring.generate({ length : 16 });
            let newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepStrictEqual(newlabels, [ label1 ]);

            retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, [ label1 ]);
            }

            const label2 = randomstring.generate({ length : 16 });
            newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label2);
            assert.deepStrictEqual(newlabels, [ label1, label2 ]);

            retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, [ label1, label2 ]);
            }
        });

        it('should not store duplicate labels', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);

            let retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, []);
            }

            const label1 = randomstring.generate({ length : 16 });
            let newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepStrictEqual(newlabels, [ label1 ]);

            retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, [ label1 ]);
            }

            newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepStrictEqual(newlabels, [ label1 ]);

            retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, [ label1 ]);
            }
        });


        it('should not store empty labels', async () => {
            const userid = uuid();
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);

            let retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, []);
            }

            const label1 = '';
            const newlabels = await store.addLabelToProject(userid, TESTCLASS, project.id, label1);
            assert.deepStrictEqual(newlabels, [ '' ]);

            retrieved = await store.getProject(project.id);
            assert(retrieved);
            if (retrieved) {
                assert.deepStrictEqual(retrieved.labels, [  ]);
            }
        });

    });


    describe('removeLabelFromProject', () => {

        async function createProjectWithLabels(userid: string, labels: string[]) {
            const project = await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);
            for (const label of labels) {
                await store.addLabelToProject(userid, TESTCLASS, project.id, label);
            }
            return project;
        }


        it('should handle non-existent projects', (done) => {
            store.removeLabelFromProject(uuid(), TESTCLASS, 'text', 'MYOLDLABEL')
                .then(() => {
                    assert.fail('should not have let this happen');
                })
                .catch((err) => {
                    assert.strictEqual(err.message, 'Project not found');
                    done();
                });
        });

        it('should remove a label from a text project', async () => {
            const userid = uuid();
            const labels = [ 'america', 'belgium', 'canada', 'denmark' ];
            let project: Objects.Project | undefined = await createProjectWithLabels(userid, labels);

            await store.storeTextTraining(project.id, 'aalborg', 'denmark');
            await store.storeTextTraining(project.id, 'kolding', 'denmark');
            await store.storeTextTraining(project.id, 'montreal', 'canada');
            await store.storeTextTraining(project.id, 'mons', 'belgium');
            await store.storeTextTraining(project.id, 'ostend', 'belgium');
            await store.storeTextTraining(project.id, 'brussels', 'belgium');

            const countBefore = await store.countTrainingByLabel(project);
            assert.deepStrictEqual(countBefore, {
                belgium : 3, canada : 1, denmark : 2,
            });

            const newLabels = await store.removeLabelFromProject(userid, TESTCLASS, project.id, 'belgium');
            assert.deepStrictEqual(newLabels, [ 'america', 'canada', 'denmark' ]);

            project = await store.getProject(project.id);
            assert(project);
            if (!project) {
                return assert.fail('fail');
            }
            assert.deepStrictEqual(project.labels, [ 'america', 'canada', 'denmark' ]);

            const countAfter = await store.countTrainingByLabel(project);
            assert.deepStrictEqual(countAfter, {
                canada : 1, denmark : 2,
            });
        });


        it('should not remove a label not in a project', async () => {
            const userid = uuid();
            const labels = [ 'hampshire', 'berkshire', 'wiltshire', 'sussex' ];
            const project = await createProjectWithLabels(userid, labels);

            const newLabels = await store.removeLabelFromProject(userid, TESTCLASS, project.id, 'london');
            assert.deepStrictEqual(newLabels, labels);

            const fetched = await store.getProject(project.id);
            assert(fetched);
            if (fetched) {
                assert.deepStrictEqual(fetched.labels, labels);
            }
        });


        it('should not remove an empty label', async () => {
            const userid = uuid();
            const labels = [ 'hampshire', 'berkshire', 'wiltshire', 'sussex' ];
            const project = await createProjectWithLabels(userid, labels);

            const newLabels = await store.removeLabelFromProject(userid, TESTCLASS, project.id, '');
            assert.deepStrictEqual(newLabels, labels);

            const fetched = await store.getProject(project.id);
            assert(fetched);
            if (fetched) {
                assert.deepStrictEqual(fetched.labels, labels);
            }
        });

        it('should remove all labels from a project', async () => {
            const userid = uuid();
            const labels = [ 'one', 'two' ];
            const project = await createProjectWithLabels(userid, labels);

            let newLabels = await store.removeLabelFromProject(userid, TESTCLASS, project.id, 'one');
            assert.deepStrictEqual(newLabels, [ 'two' ]);

            newLabels = await store.removeLabelFromProject(userid, TESTCLASS, project.id, 'two');
            assert.deepStrictEqual(newLabels, [ ]);
        });

    });


    describe('updateProjectCrowdSourced', () => {

        it('should handle updates to known projects', () => {
            return store.updateProjectCrowdSourced(uuid(), uuid(), uuid(), false)
                .then(() => {
                    assert.fail('should have reported an error');
                })
                .catch((err) => {
                    assert.strictEqual(err.message, 'Project not found');
                });
        });
    });


    describe('deleteEntireUser()', () => {

        it('should remove user projects', async () => {
            const userid = uuid();

            await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);
            await store.storeProject(userid, TESTCLASS, 'text', uuid(), 'en', [], false);

            const count = await store.countProjectsByUserId(userid, TESTCLASS);
            assert.strictEqual(count, 2);

            await store.deleteEntireUser(userid, TESTCLASS);

            const countAfter = await store.countProjectsByUserId(userid, TESTCLASS);
            assert.strictEqual(countAfter, 0);
        });

    });
});
