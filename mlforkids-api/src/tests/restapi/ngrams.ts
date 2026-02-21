import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import { TEST_INPUT_FILES, getTestStrings } from '../utils/ngrams';
import { NgramLookupTable } from '../../lib/utils/ngrams';
import { readJson } from '../../lib/utils/fileutils';
import { status as httpstatus } from 'http-status';
import * as express from 'express';
import * as sinon from 'sinon';
import * as request from 'supertest';
import * as auth from '../../lib/restapi/auth';
import testapiserver from './testserver';



let testServer: express.Express;



describe('REST API - ngrams', () => {

    let authStub: sinon.SinonStub<any, any>;
    let checkUserStub: sinon.SinonStub<any, any>;

    const nextAuth0UserId = 'userid';
    const nextAuth0UserTenant = 'tenant';
    const nextAuth0UserRole = 'student';

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

    function lookupCount(input: NgramLookupTable, tokens: string[]): number {
        let node = input;
        for (let tokenIdx = 0; tokenIdx < tokens.length - 1; tokenIdx++) {
            const nxtToken = tokens[tokenIdx]
            node = node[nxtToken].next as NgramLookupTable;
        }
        const token = tokens[tokens.length - 1];
        let entry;
        if (Array.isArray(node)) {
            const allNgrams = node;
            entry = allNgrams.find((i) => i.token === token);
        }
        else {
            entry = node[token];
        }
        if (entry) {
            return entry.count;
        }
        throw new Error('lookup entry not found');
    }


    describe('invalid input', () => {

        it('should require a request payload', async () => {
            const res = await request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });
        });

        it('should reject unexpected object payloads', async () => {
            const res = await request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ invalid : 'hello' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });
        });

        it('should reject unexpected input payloads', async () => {
            const res = await request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ input : 'hello' })
                .expect('Content-Type', /json/)
                .expect(httpstatus.BAD_REQUEST);

            assert.deepStrictEqual(res.body, { error : 'Missing data' });
        });
    });


    describe('submit text', () => {

        it('should return output for a single file', async () => {
            const expectedBits = await Promise.all([
                readJson('./src/tests/utils/resources/ngrams/bohemia-bigram.json'),
                readJson('./src/tests/utils/resources/ngrams/bohemia-trigram.json'),
                readJson('./src/tests/utils/resources/ngrams/bohemia-tetragram.json'),
            ]);

            const expected = {
                bigrams    : expectedBits[0],
                trigrams   : expectedBits[1],
                tetragrams : expectedBits[2],
            };

            const input = await getTestStrings([ TEST_INPUT_FILES.BOHEMIA ]);

            const res = await request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ input })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const output = res.body;
            assert.deepStrictEqual(output, expected);
        });

        it('should return output for multiple files', async () => {
            const input = await getTestStrings([
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE,
                TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
            ]);

            const res = await request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ input })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const output = res.body;
            assert(output.bigrams);
            assert(output.trigrams);
            assert(output.tetragrams);

            const tokensToVerify = [ 'I', 'do', 'not', 'know' ];

            assert.strictEqual(
                lookupCount(output.tetragrams.lookup, [ tokensToVerify[0], tokensToVerify[1], tokensToVerify[2], tokensToVerify[3] ]),
                4);

            for (const ngramResults of [ output.trigrams, output.tetragrams ]) {
                assert.strictEqual(
                    lookupCount(ngramResults.lookup, [ tokensToVerify[0], tokensToVerify[1], tokensToVerify[2] ]),
                    11);
            }

            for (const ngramResults of [ output.bigrams, output.trigrams, output.tetragrams ]) {
                assert.strictEqual(
                    lookupCount(ngramResults.lookup, [ tokensToVerify[0], tokensToVerify[1] ]),
                    16);

                assert.strictEqual(
                    ngramResults.lookup[tokensToVerify[0]].count,
                    935);
            }
        });


        it('should return output for very large requests', async () => {
            const input = await getTestStrings([
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
                TEST_INPUT_FILES.BOHEMIA,  TEST_INPUT_FILES.BOSCOMBE, TEST_INPUT_FILES.IDENTITY, TEST_INPUT_FILES.TWISTEDLIP,
            ]);

            const res = await request(testServer)
                .post('/api/classes/' + nextAuth0UserTenant + '/students/' + nextAuth0UserId + '/training/ngrams')
                .send({ input })
                .expect('Content-Type', /json/)
                .expect(httpstatus.OK);

            const output = res.body;
            assert(output.bigrams);
            assert(output.trigrams);
            assert(output.tetragrams);
        });
    });
});
