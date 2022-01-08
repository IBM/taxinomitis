/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';

import * as authtypes from '../../lib/auth0/auth-types';
import * as users from '../../lib/auth0/users';
import * as auth0 from '../../lib/auth0/requests';
import * as mocks from './requestmocks';


describe('auth0 users', () => {

    const TESTTENANT: string = 'TESTTENANT';

    function pause() {
        return new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }



    describe('getStudents()', () => {

        it('should return an empty list', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.empty),
            };

            return users.getAllStudents('empty', authtypes.ALL_STUDENTS)
                .then((students) => {
                    assert(Array.isArray(students));
                    assert.strictEqual(students.length, 0);
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUsers.restore();
                });
        });


        it('should return student objects', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.single),
            };

            return users.getAllStudents('single', authtypes.ALL_STUDENTS)
                .then((students) => {
                    assert(Array.isArray(students));
                    assert.strictEqual(students.length, 1);
                    assert.strictEqual(Object.keys(students[0]).length, 3);
                    assert(students[0].id);
                    assert(students[0].username);
                    assert(students[0].last_login);
                })
                .then(function restore() {
                    stubs.getOauthToken.restore();
                    stubs.getUsers.restore();
                });
        });

        (process.env.TRAVIS ? it.skip : it)('should fetch students', () => {
            return users.getAllStudents(TESTTENANT, authtypes.ALL_STUDENTS)
                .then((students) => {
                    assert(Array.isArray(students));
                    students.forEach((student) => {
                        assert(student.id);
                        assert(student.username);
                    });
                });
        });

        async function createMultipleUsersWithWaits() {
            const output: authtypes.UserCreds[] = [];

            let user = await users.createStudent(TESTTENANT, 'notinagroup')
            output.push(user);
            await pause();

            user = await users.createStudent(TESTTENANT, 'apple', 'fruit');
            output.push(user);
            await pause();

            user = await users.createStudent(TESTTENANT, 'banana', 'fruit');
            output.push(user);
            await pause();

            user = await users.createStudent(TESTTENANT, 'orange', 'fruit');
            output.push(user);
            await pause();

            user = await users.createStudent(TESTTENANT, 'cow', 'animal');
            output.push(user);
            await pause();

            user = await users.createStudent(TESTTENANT, 'sheep', 'animal');
            output.push(user);
            await pause();

            return output;
        }

        async function deleteMultipleStudentsWithWaits(delusers: authtypes.UserCreds[]) {
            for (const user of delusers) {
                await users.deleteStudent(TESTTENANT, user.id);
                await pause();
            }
        }

        it.skip('should fetch students in a group', () => {
            let testusers: authtypes.UserCreds[];

            return createMultipleUsersWithWaits()
                .then((output) => {
                    testusers = output;

                    return users.getAllStudents(TESTTENANT, 'ALL');
                })
                .then((resp) => {
                    assert.strictEqual(resp.length, 6);
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, 'fruit');
                })
                .then((resp) => {
                    assert.strictEqual(resp.length, 3);
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, 'animal');
                })
                .then((resp) => {
                    assert.strictEqual(resp.length, 2);
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, '');
                })
                .then((resp) => {
                    assert.strictEqual(resp.length, 1);
                    assert.strictEqual(resp[0].username, 'notinagroup');
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, authtypes.UNGROUPED_STUDENTS);
                })
                .then((resp) => {
                    assert.strictEqual(resp.length, 1);
                    assert.strictEqual(resp[0].username, 'notinagroup');
                    return pause();
                })
                .then(() => {
                    return deleteMultipleStudentsWithWaits(testusers);
                });
        });
    });


    (process.env.TRAVIS ? describe.skip : describe)('addStudentToGroup', () => {

        it('should add a student to a group', () => {
            let testuser: authtypes.UserCreds;
            const MYGROUP = 'Friendly Students';
            return users.createStudent(TESTTENANT, 'mytestuser')
                .then((created) => {
                    testuser = created;
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, MYGROUP);
                })
                .then((fetched) => {
                    assert.strictEqual(fetched.length, 0);
                    return pause();
                })
                .then(() => {
                    return users.addStudentsToGroup(TESTTENANT, [ testuser.id ], MYGROUP);
                })
                .then((upd) => {
                    assert.strictEqual(upd.length, 1);
                    assert.deepStrictEqual(upd[0].app_metadata, {
                        tenant : TESTTENANT,
                        role : 'student',
                        group : MYGROUP,
                    });
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, MYGROUP);
                })
                .then((fetched) => {
                    assert.strictEqual(fetched.length, 1);
                    assert.strictEqual(fetched[0].id, testuser.id);
                    return pause();
                })
                .then(() => {
                    return users.deleteStudent(TESTTENANT, testuser.id);
                });
        });


        it('should remove a student from a group', () => {
            let testuser: authtypes.UserCreds;
            const MYGROUP = 'Unfriendly Students';
            return users.createStudent(TESTTENANT, 'myothertestuser', MYGROUP)
                .then((created) => {
                    testuser = created;
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, MYGROUP);
                })
                .then((fetched) => {
                    assert.strictEqual(fetched.length, 1);
                    assert.strictEqual(fetched[0].id, testuser.id);
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, authtypes.UNGROUPED_STUDENTS);
                })
                .then((fetched) => {
                    assert.strictEqual(fetched.length, 0);
                    return pause();
                })

                .then(() => {
                    return users.addStudentsToGroup(TESTTENANT, [ testuser.id ], authtypes.UNGROUPED_STUDENTS);
                })
                .then((upd) => {
                    assert.strictEqual(upd.length, 1);
                    assert.deepStrictEqual(upd[0].app_metadata, {
                        tenant : TESTTENANT,
                        role : 'student'
                    });
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, MYGROUP);
                })
                .then((fetched) => {
                    assert.strictEqual(fetched.length, 0);
                    return pause();
                })
                .then(() => {
                    return users.getAllStudents(TESTTENANT, authtypes.UNGROUPED_STUDENTS);
                })
                .then((fetched) => {
                    assert.strictEqual(fetched.length, 1);
                    assert.strictEqual(fetched[0].id, testuser.id);
                    return pause();
                })
                .then(() => {
                    return users.deleteStudent(TESTTENANT, testuser.id);
                });
        });
    });



    describe('countStudents', () => {

        it('should fetch a count of students', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUserCountsStub : sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts),
            };

            return users.countUsers(TESTTENANT)
                .then((count) => {
                    assert.strictEqual(count, 5);

                    stubs.getOauthToken.restore();
                    stubs.getUserCountsStub.restore();
                });
        });
    });


    (process.env.TRAVIS ? describe.skip : describe)('getStudent()', () => {

        it('should check the tenant is correct', async () => {
            const newStudent = await users.createStudent(TESTTENANT, '104' + randomstring.generate({ length : 6 }));
            assert(newStudent.password);
            try {
                await users.getStudent('DIFFERENT', newStudent.id);
                assert.fail('Failed to check student');
            }
            catch (err) {
                assert.strictEqual(err.error, 'Not Found');
                assert.strictEqual(err.statusCode, 404);
                assert.strictEqual(err.errorCode, 'inexistent_user');
                assert.strictEqual(err.message, 'Userid with this tenant not found');
            }
            await users.deleteStudent(TESTTENANT, newStudent.id);
        });

        it('should check the role is correct', async () => {
            const username = '120' + randomstring.generate({ length : 6 });
            const email = username + '@unittests.com';
            const newTeacher = await users.createTeacher(TESTTENANT, username, email);
            assert(newTeacher.password);
            try {
                await users.getStudent(TESTTENANT, newTeacher.id);
                assert.fail('Failed to check teacher role');
            }
            catch (err) {
                assert.strictEqual(err.error, 'Not Found');
                assert.strictEqual(err.statusCode, 404);
                assert.strictEqual(err.errorCode, 'inexistent_user');
                assert.strictEqual(err.message, 'User with the specified userid and role not found');
            }
            await users.deleteTeacher(TESTTENANT, newTeacher.id);
        });
    });


    (process.env.TRAVIS ? describe.skip : describe)('addGroupToClass', () => {

        it('should add a group to an empty class', async () => {
            const EMAIL = 'myteacher@testing.com';

            const teacher = await users.createTeacher(TESTTENANT, 'myteacher', EMAIL);

            let verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert.strictEqual('groups' in verify.app_metadata, false);

            await users.addGroupToClass(TESTTENANT, 'firstgroup'); await pause();

            verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert(verify.app_metadata.groups);
            assert.strictEqual(verify.app_metadata.groups.length, 1);
            assert.strictEqual(verify.app_metadata.groups[0], 'firstgroup');

            await users.deleteTeacher(TESTTENANT, teacher.id);
        });

        it('should add multiple groups to a teacher', async () => {
            const EMAIL = 'mynewteacher@testing.com';

            const teacher = await users.createTeacher(TESTTENANT, 'mynewteacher', EMAIL);

            await users.addGroupToClass(TESTTENANT, 'alpha'); await pause();
            await users.addGroupToClass(TESTTENANT, 'beta'); await pause();
            await users.addGroupToClass(TESTTENANT, 'gamma'); await pause();

            const verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert(verify.app_metadata.groups);
            assert.strictEqual(verify.app_metadata.groups.length, 3);
            assert.strictEqual(verify.app_metadata.groups[0], 'alpha');
            assert.strictEqual(verify.app_metadata.groups[1], 'beta');
            assert.strictEqual(verify.app_metadata.groups[2], 'gamma');

            await users.deleteTeacher(TESTTENANT, teacher.id);
        });

        it('should handle duplicate groups', async () => {
            const EMAIL = 'mynewteacher@testing.com';

            const teacher = await users.createTeacher(TESTTENANT, 'mynewteacher', EMAIL);

            await users.addGroupToClass(TESTTENANT, 'alpha'); await pause();
            await users.addGroupToClass(TESTTENANT, 'beta'); await pause();
            await users.addGroupToClass(TESTTENANT, 'gamma'); await pause();
            await users.addGroupToClass(TESTTENANT, 'beta'); await pause();
            await users.addGroupToClass(TESTTENANT, 'alpha'); await pause();

            const verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert(verify.app_metadata.groups);
            assert.strictEqual(verify.app_metadata.groups.length, 3);
            assert.strictEqual(verify.app_metadata.groups[0], 'alpha');
            assert.strictEqual(verify.app_metadata.groups[1], 'beta');
            assert.strictEqual(verify.app_metadata.groups[2], 'gamma');

            await users.deleteTeacher(TESTTENANT, teacher.id);
        });


        it('should handle groups from multiple teachers', async () => {
            const EMAIL1 = 'teacher10@testing.com';
            const EMAIL2 = 'teacher20@testing.com';
            const EMAIL3 = 'teacher30@testing.com';

            const teacher1 = await users.createTeacher(TESTTENANT, 'teacher10', EMAIL1);
            const teacher2 = await users.createTeacher(TESTTENANT, 'teacher20', EMAIL2);
            const teacher3 = await users.createTeacher(TESTTENANT, 'teacher30', EMAIL3);

            await pause();

            await users.addGroupToClass(TESTTENANT, 'apple'); await pause();
            await users.addGroupToClass(TESTTENANT, 'banana'); await pause();
            await users.addGroupToClass(TESTTENANT, 'fish'); await pause();
            await users.addGroupToClass(TESTTENANT, 'giraffe'); await pause();

            for (const email of [ EMAIL1, EMAIL2, EMAIL3 ]) {
                const verify = await users.getTeacherByEmail(email);
                assert(verify);
                assert(verify.app_metadata);
                assert(verify.app_metadata.groups);
                assert.strictEqual(verify.app_metadata.groups.length, 4);
                assert.deepStrictEqual(verify.app_metadata.groups, [
                    'apple', 'banana', 'fish', 'giraffe',
                ]);
            }

            await pause();

            await users.deleteTeacher(TESTTENANT, teacher1.id); await pause();
            await users.deleteTeacher(TESTTENANT, teacher2.id); await pause();
            await users.deleteTeacher(TESTTENANT, teacher3.id); await pause();
        });

        it('should remove groups from a class', async () => {
            const EMAIL1 = 'teacherx1@testing.com';
            const EMAIL2 = 'teacherx2@testing.com';
            const GROUPS = [ 'first', 'second', 'third' ];

            const teacher1 = await users.createTeacher(TESTTENANT, 'teacherx1', EMAIL1);
            const teacher2 = await users.createTeacher(TESTTENANT, 'teacherx2', EMAIL2);

            for (const group of GROUPS) {
                await users.addGroupToClass(TESTTENANT, group); await pause();
            }

            for (const email of [ EMAIL1, EMAIL2 ]) {
                const verify = await users.getTeacherByEmail(email);
                assert(verify);
                assert(verify.app_metadata);
                assert(verify.app_metadata.groups);
                assert.strictEqual(verify.app_metadata.groups.length, GROUPS.length);
                assert.deepStrictEqual(verify.app_metadata.groups, GROUPS);
            }

            await pause();

            await users.removeGroupFromClass(TESTTENANT, 'second'); await pause();

            for (const email of [ EMAIL1, EMAIL2 ]) {
                const verify = await users.getTeacherByEmail(email);
                assert(verify);
                assert(verify.app_metadata);
                assert(verify.app_metadata.groups);
                assert.strictEqual(verify.app_metadata.groups.length, 2);
                assert.deepStrictEqual(verify.app_metadata.groups, [ 'first', 'third' ]);
            }

            await users.removeGroupFromClass(TESTTENANT, 'first'); await pause();

            for (const email of [ EMAIL1, EMAIL2 ]) {
                const verify = await users.getTeacherByEmail(email);
                assert(verify);
                assert(verify.app_metadata);
                assert(verify.app_metadata.groups);
                assert.strictEqual(verify.app_metadata.groups.length, 1);
                assert.deepStrictEqual(verify.app_metadata.groups, [ 'third' ]);
            }

            await users.removeGroupFromClass(TESTTENANT, 'third'); await pause();

            for (const email of [ EMAIL1, EMAIL2 ]) {
                const verify = await users.getTeacherByEmail(email);
                assert(verify);
                assert(verify.app_metadata);
                assert(verify.app_metadata.groups);
                assert.strictEqual(verify.app_metadata.groups.length, 0);
            }

            await users.deleteTeacher(TESTTENANT, teacher1.id); await pause();
            await users.deleteTeacher(TESTTENANT, teacher2.id); await pause();
        });


        it('should handle removing non-existent groups', async () => {
            const EMAIL = 'mytestteacher@testing.com';

            const teacher = await users.createTeacher(TESTTENANT, 'mytestteacher', EMAIL);

            await users.removeGroupFromClass(TESTTENANT, 'doesnotexist'); await pause();

            const verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert(verify.app_metadata.groups);
            assert.strictEqual(verify.app_metadata.groups.length, 0);

            await users.deleteTeacher(TESTTENANT, teacher.id);
        });


        it('should not allow removing groups with students in', async () => {
            const EMAIL = 'badtest@testing.com';

            const teacher = await users.createTeacher(TESTTENANT, 'badtest', EMAIL);

            await users.addGroupToClass(TESTTENANT, 'nonempty'); await pause();

            const student = await users.createStudent(TESTTENANT, 'student', 'nonempty'); await pause();

            try {
                await users.removeGroupFromClass(TESTTENANT, 'nonempty');
                assert.fail('should not have allowed this');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Groups cannot be deleted while they still have students');
            }

            await pause();

            let verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert(verify.app_metadata.groups);
            assert.strictEqual(verify.app_metadata.groups.length, 1);
            assert.strictEqual(verify.app_metadata.groups[0], 'nonempty');

            await pause();

            await users.deleteStudent(TESTTENANT, student.id); await pause();

            await users.removeGroupFromClass(TESTTENANT, 'nonempty'); await pause();

            verify = await users.getTeacherByEmail(EMAIL);
            assert(verify);
            assert(verify.app_metadata);
            assert(verify.app_metadata.groups);
            assert.strictEqual(verify.app_metadata.groups.length, 0);

            await users.deleteTeacher(TESTTENANT, teacher.id);
        });

    });


    (process.env.TRAVIS ? describe.skip : describe)('getTeacher()', () => {

        it('should create and fetch a teacher', async () => {
            const tenant = randomstring.generate(10);
            const teachername = randomstring.generate(12);
            const teacheremail = randomstring.generate(6).toLowerCase() + '@unittests.com';

            const newTeacher = await users.createTeacher(tenant, teachername, teacheremail);

            const fetched = await users.getTeacherByClassId(tenant);
            assert(fetched);
            if (fetched) {
                assert.strictEqual(fetched.email, teacheremail);
            }
            await users.deleteTeacher(tenant, newTeacher.id);
        });

        it('should return nothing for non-existent classes', async () => {
            const tenant = randomstring.generate(12);
            const fetched = await users.getTeacherByClassId(tenant);
            assert(!fetched);
        });

    });


    (process.env.TRAVIS ? describe.skip : describe)('createStudent()', () => {

        it('should create a student', async () => {
            const newStudent = await users.createStudent(TESTTENANT, '141' + randomstring.generate({ length : 6 }));
            assert(newStudent.password);
            const retrieved = await users.getStudent(TESTTENANT, newStudent.id);
            assert.strictEqual(retrieved.username, newStudent.username);
            await users.deleteStudent(TESTTENANT, newStudent.id);

            try {
                await users.getStudent(TESTTENANT, newStudent.id);

                assert.fail('Failed to delete student');
            }
            catch (err) {
                assert.strictEqual(err.error, 'Not Found');
                assert.strictEqual(err.statusCode, 404);
                assert.strictEqual(err.errorCode, 'inexistent_user');
            }
        });

        it('should increase the number of students', async () => {
            const before = await users.countUsers(TESTTENANT);

            const newStudent = await users.createStudent(TESTTENANT, '168' + randomstring.generate({ length : 6 }));
            await pause();

            const after = await users.countUsers(TESTTENANT);

            await users.deleteStudent(TESTTENANT, newStudent.id);
            await pause();

            const final = await users.countUsers(TESTTENANT);

            assert.strictEqual(after, before + 1);
            assert.strictEqual(final, before);
        });


        it('should reset password', async () => {
            const newStudent = await users.createStudent(TESTTENANT, '184' + randomstring.generate({ length : 6 }));
            assert(newStudent.password);

            const modified = await users.resetStudentPassword(TESTTENANT, newStudent.id);
            assert(modified.password);
            assert.notStrictEqual(modified.password, newStudent.password);

            assert.strictEqual(modified.username, newStudent.username);

            await users.deleteStudent(TESTTENANT, newStudent.id);

            try {
                await users.getStudent(TESTTENANT, newStudent.id);

                assert.fail('Failed to delete student');
            }
            catch (err) {
                assert.strictEqual(err.error, 'Not Found');
                assert.strictEqual(err.statusCode, 404);
                assert.strictEqual(err.errorCode, 'inexistent_user');
            }
        });

    });

});
