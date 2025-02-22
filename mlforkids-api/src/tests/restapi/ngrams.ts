/*eslint-env mocha */
import * as assert from 'assert';
import { TEST_INPUT_FILES, getTestStrings } from '../utils/ngrams';
import { readJson } from '../../lib/utils/fileutils';
import * as httpstatus from 'http-status';
import * as express from 'express';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';



let testServer: express.Express;



describe('REST API - ngrams', () => {

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;

    let nextAuth0UserId = 'userid';
    let nextAuth0UserTenant = 'tenant';
    let nextAuth0UserRole: 'student' = 'student';

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        const reqWithUser = req as auth.RequestWithUser;
        reqWithUser.user = {
            sub : nextAuth0UserId,
            app_metadata : {
                tenant : nextAuth0UserTenant,
                role : nextAuth0UserRole,
            },
        };
        next();
    }

    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);

        testServer = testapiserver();
    });

    after(() => {
        authStub.restore();
        checkUserStub.restore();
    });



    describe('invalid input', () => {

        it('should require a request payload', () => {
            return request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });

        it('should reject unexpected object payloads', () => {
            return request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ invalid : 'hello' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });

        it('should reject unexpected input payloads', () => {
            return request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ input : 'hello' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Missing data' });
                });
        });
    });


    describe('submit text', () => {

        it('should return output for a single file', () => {
            let expected: any;
            return Promise.all([
                    readJson('./src/tests/utils/resources/ngrams/bohemia-bigram.json'),
                    readJson('./src/tests/utils/resources/ngrams/bohemia-trigram.json'),
                    readJson('./src/tests/utils/resources/ngrams/bohemia-tetragram.json'),
                ])
                .then((expectedBits) => {
                    expected = {
                        bigrams    : expectedBits[0],
                        trigrams   : expectedBits[1],
                        tetragrams : expectedBits[2],
                    };
                    return getTestStrings([ TEST_INPUT_FILES.BOHEMIA ]);
                })
                .then((input) => {
                    return request(testServer)
                        .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                        .send({ input })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const output = res.body;
                    assert.deepStrictEqual(output, expected);
                });
        });

        it('should return output for multiple files', () => {
            return getTestStrings([
                    TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE,
                    TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                ])
                .then((input) => {
                    return request(testServer)
                        .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                        .send({ input })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const output = res.body;
                    assert(output.bigrams);
                    assert(output.trigrams);
                    assert(output.tetragrams);

                    const tokensToVerify = [ 'I', 'do', 'not', 'know' ];

                    assert.strictEqual(
                        output.tetragrams.lookup[tokensToVerify[0]]
                            .next[tokensToVerify[1]]
                            .next[tokensToVerify[2]]
                            .next[tokensToVerify[3]]
                            .count,
                        4);

                    for (const ngramResults of [ output.trigrams, output.tetragrams ]) {
                        assert.strictEqual(
                            ngramResults.lookup[tokensToVerify[0]]
                                .next[tokensToVerify[1]]
                                .next[tokensToVerify[2]]
                                .count,
                            11);
                    }

                    for (const ngramResults of [ output.bigrams, output.trigrams, output.tetragrams ]) {
                        assert.strictEqual(
                            ngramResults.lookup[tokensToVerify[0]]
                                .next[tokensToVerify[1]]
                                .count,
                            16);

                        assert.strictEqual(
                            ngramResults.lookup[tokensToVerify[0]]
                                .count,
                            935);
                    }
                });
        });


        it('should return output for very large requests', () => {
            return getTestStrings([
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
            ])
                .then((input) => {
                    return request(testServer)
                        .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                        .send({ input })
                        .expect('Content-Type', /json/)
                        .expect(httpstatus.OK);
                })
                .then((res) => {
                    const output = res.body;
                    assert(output.bigrams);
                    assert(output.trigrams);
                    assert(output.tetragrams);
                });
        });
    });
});
