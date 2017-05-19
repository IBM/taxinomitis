/*eslint-env mocha */
import * as assert from 'assert';
import * as request from 'supertest-as-promised';
import * as httpstatus from 'http-status';

import testserverapi from './testserver';

const testServer = testserverapi();



describe('REST API - Auth', () => {

    describe('getStudents()', () => {

        it('should require auth', () => {
            return request(testServer)
                .get('/api/classes/testclassid/students')
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Not authorised' });
                });
        });

    });


    describe('createStudent()', () => {

        it('should require auth', () => {
            return request(testServer)
                .post('/api/classes/testclassid/students')
                .send({})
                .expect('Content-Type', /json/)
                .expect(httpstatus.UNAUTHORIZED)
                .then((res) => {
                    assert.deepEqual(res.body, { error : 'Not authorised' });
                });
        });

    });
});
