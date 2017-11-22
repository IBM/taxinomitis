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

            return users.getStudents('empty')
                .then((students) => {
                    assert(Array.isArray(students));
                    assert.equal(students.length, 0);
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

            return users.getStudents('single')
                .then((students) => {
                    assert(Array.isArray(students));
                    assert.equal(students.length, 1);
                    assert.equal(Object.keys(students[0]).length, 3);
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
            return users.getStudents(TESTTENANT)
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
                    assert.equal(count, 5);

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
                assert.fail(1, 0, 'Failed to check student', '');
            }
            catch (err) {
                assert.equal(err.error, 'Not Found');
                assert.equal(err.statusCode, 404);
                assert.equal(err.errorCode, 'inexistent_user');
                assert.equal(err.message, 'Userid with this tenant not found');
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
                assert.fail(1, 0, 'Failed to check teacher role', '');
            }
            catch (err) {
                assert.equal(err.error, 'Not Found');
                assert.equal(err.statusCode, 404);
                assert.equal(err.errorCode, 'inexistent_user');
                assert.equal(err.message, 'User with the specified userid and role not found');
            }
            await users.deleteTeacher(TESTTENANT, newTeacher.id);
        });
    });

    describe('createStudent()', () => {

        it('should create a student', async () => {
            const newStudent = await users.createStudent(TESTTENANT, '141' + randomstring.generate({ length : 6 }));
            assert(newStudent.password);
            const retrieved = await users.getStudent(TESTTENANT, newStudent.id);
            assert.equal(retrieved.username, newStudent.username);
            await users.deleteStudent(TESTTENANT, newStudent.id);

            try {
                await users.getStudent(TESTTENANT, newStudent.id);

                assert.fail(1, 0, 'Failed to delete student', '');
            }
            catch (err) {
                assert.equal(err.error, 'Not Found');
                assert.equal(err.statusCode, 404);
                assert.equal(err.errorCode, 'inexistent_user');
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

            assert.equal(after, before + 1);
            assert.equal(final, before);
        });


        it('should reset password', async () => {
            const newStudent = await users.createStudent(TESTTENANT, '184' + randomstring.generate({ length : 6 }));
            assert(newStudent.password);

            const modified = await users.resetStudentPassword(TESTTENANT, newStudent.id);
            assert(modified.password);
            assert.notEqual(modified.password, newStudent.password);

            assert.equal(modified.username, newStudent.username);

            await users.deleteStudent(TESTTENANT, newStudent.id);

            try {
                await users.getStudent(TESTTENANT, newStudent.id);

                assert.fail(1, 0, 'Failed to delete student', '');
            }
            catch (err) {
                assert.equal(err.error, 'Not Found');
                assert.equal(err.statusCode, 404);
                assert.equal(err.errorCode, 'inexistent_user');
            }
        });

    });

});
