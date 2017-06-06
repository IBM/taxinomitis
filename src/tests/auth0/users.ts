/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as randomstring from 'randomstring';

import * as users from '../../lib/auth0/users';
import * as auth0 from '../../lib/auth0/requests';
import * as mocks from './requestmocks';


describe('auth0 users', () => {

    const TESTTENANT: string = 'TESTTENANT';

    describe('getStudents()', () => {

        it('should return an empty list', () => {
            const stubs = {
                getOauthToken : sinon.stub(auth0, 'getOauthToken').callsFake(mocks.getOauthToken.good),
                getUsers : sinon.stub(auth0, 'getUsers').callsFake(mocks.getUsers.empty),
            };

            proxyquire('../../lib/auth0/users', {
                './requests' : stubs,
            });

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

            proxyquire('../../lib/auth0/users', {
                './requests' : stubs,
            });

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

    describe('createStudent()', () => {

        it('should create a student', async () => {
            const newStudent = await users.createStudent(TESTTENANT, randomstring.generate({ length : 8 }));
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
        }).timeout(6000);


        it('should reset password', async () => {
            const newStudent = await users.createStudent(TESTTENANT, randomstring.generate({ length : 8 }));
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
        }).timeout(6000);

    });

});
