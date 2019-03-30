/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';

import * as users from '../../lib/auth0/users';
import * as auth0 from '../../lib/auth0/requests';
import * as mocks from './requestmocks';


describe.skip('auth0 users', () => {

    const TESTTENANT: string = 'TESTTENANT';


    describe('getStudents()', () => {

        it('should return an empty list', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.empty),
            };

            return users.getAllStudents('empty')
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

            return users.getAllStudents('single')
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


        it('should fetch students', () => {
            return users.getAllStudents(TESTTENANT)
                .then((students) => {
                    assert(Array.isArray(students));
                    students.forEach((student) => {
                        assert(student.id);
                        assert(student.username);
                    });
                });
        });
    });


    describe('countStudents', () => {

        it('should fetch a count of students', () => {
            const stubs = {
                getUserCountsStub : sinon.stub(auth0, 'getUserCounts').callsFake(mocks.getUserCounts),
            };

            return users.countUsers(TESTTENANT)
                .then((count) => {
                    assert.strictEqual(count, 5);

                    stubs.getUserCountsStub.restore();
                });
        });
    });


    describe('getStudent()', () => {

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


    describe('getTeacher()', () => {

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


    describe('createStudent()', () => {

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

        function pause() {
            return new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }

        it.skip('should increase the number of students', async () => {
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
