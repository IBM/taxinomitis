import { describe, it, before, after, beforeEach, afterEach } from 'node:test';

// tslint:disable:max-line-length

import * as assert from 'assert';
import * as sinon from 'sinon';

import * as textservice from '../../lib/training/textservice';
import * as textmodels from '../../lib/training/textmodels';
import * as slack from '../../lib/notifications/slack';
import * as TrainingTypes from '../../lib/training/training-types';
import * as requestUtil from '../../lib/utils/request';
import * as env from '../../lib/utils/env';



describe('Training - text service', () => {

    const TEXT_SERVICE = 'http://text-service.test';
    const TEXT_SERVICE_USER = 'testtextuser';
    const TEXT_SERVICE_PASS = 'testtextpass';

    const savedEnv: { [key: string]: string | undefined } = {};

    let postStub: sinon.SinonStub<any, any>;
    let slackStub: sinon.SinonStub<any, any>;

    before(() => {
        for (const key of [ env.TEXT_SERVICE, env.TEXT_SERVICE_USER, env.TEXT_SERVICE_PASS ]) {
            savedEnv[key] = process.env[key];
        }
        process.env[env.TEXT_SERVICE] = TEXT_SERVICE;
        process.env[env.TEXT_SERVICE_USER] = TEXT_SERVICE_USER;
        process.env[env.TEXT_SERVICE_PASS] = TEXT_SERVICE_PASS;
    });
    after(() => {
        for (const key of Object.keys(savedEnv)) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = savedEnv[key];
            }
        }
    });

    beforeEach(() => {
        postStub = sinon.stub(requestUtil, 'post');
        slackStub = sinon.stub(slack, 'notify');
    });
    afterEach(() => {
        postStub.restore();
        slackStub.restore();
    });


    function serviceError(statusCode: number, error: string): requestUtil.StatusCodeError {
        return new requestUtil.StatusCodeError(statusCode,
            { error, message : 'error from the text service' },
            {}, {} as Response);
    }


    function networkError(code: string): Error {
        // fetch failures are thrown with the cause from the socket
        const err: any = new Error('connect ' + code + ' 127.0.0.1:8020');
        err.code = code;
        return err;
    }

    // errors that request.ts wraps itself, such as timeouts,
    //  and network failures that don't have their own code
    function requestError(code: string): requestUtil.RequestError {
        const cause: any = new Error(code);
        cause.code = code;
        return new requestUtil.RequestError(cause, {});
    }

    function timeoutError(): requestUtil.RequestError {
        return requestError('ESOCKETTIMEDOUT');
    }

    async function assertFailure(promise: Promise<any>, expectedMessage: string, expectSlack: boolean) {
        try {
            await promise;
            assert.fail('should have failed');
        }
        catch (err) {
            assert.strictEqual(err.message, expectedMessage);
            // the thrown error must not carry the request, which
            //  includes the credentials, text and head
            assert.strictEqual(err.options, undefined);
            assert.strictEqual(err.cause, undefined);
        }
        assert.strictEqual(slackStub.called, expectSlack);
        if (expectSlack) {
            assert.strictEqual(slackStub.firstCall.args[1], slack.SLACK_CHANNELS.TRAINING_ERRORS);
        }
    }


    function trainingData(): TrainingTypes.ConversationTrainingData {
        return {
            name : 'my project',
            language : 'fr',
            intents : [
                { intent : 'happy', examples : [ { text : 'I love this' }, { text : 'what a great day' } ] },
                { intent : 'sad', examples : [ { text : 'I feel awful' } ] },
            ],
            entities : [],
            dialog_nodes : [],
            counterexamples : [],
            metadata : { createdby : 'machinelearningforkids' },
        };
    }


    describe('train', () => {

        it('should send the training to the service', async () => {
            postStub.resolves({
                modelid : '3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10',
                model : Buffer.from('model blob').toString('base64'),
                labels : [ 'happy', 'sad' ],
                calibration : 'q1',
            });

            await textservice.train(trainingData());

            assert(postStub.calledOnce);
            const [ url, opts, retry ] = postStub.firstCall.args;
            assert.strictEqual(url, 'http://text-service.test/models');
            assert.strictEqual(retry, false);
            assert.deepStrictEqual(opts.auth, { user : TEXT_SERVICE_USER, pass : TEXT_SERVICE_PASS });
            assert.strictEqual(opts.json, true);
            assert.deepStrictEqual(opts.body, {
                language : 'fr',
                labels : [
                    { label : 'happy', examples : [ 'I love this', 'what a great day' ] },
                    { label : 'sad', examples : [ 'I feel awful' ] },
                ],
            });
        });

        it('should return the model id and the decoded head', async () => {
            const head = Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x00, 0xff, 0x10 ]);
            postStub.resolves({
                modelid : '3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10',
                model : 'TUxGSwD/EA==',
                labels : [ 'happy', 'sad' ],
                calibration : 'q1',
            });

            const model = await textservice.train(trainingData());

            assert.strictEqual(model.modelid, '3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10');
            assert(Buffer.isBuffer(model.head));
            assert(model.head.equals(head));
        });

        it('should allow 90 seconds for training', async () => {
            postStub.resolves({ modelid : 'id', model : '', labels : [], calibration : 'q1' });

            await textservice.train(trainingData());

            assert.strictEqual(postStub.firstCall.args[1].timeout, 90000);
        });

        describe('errors', () => {

            const cases: { name: string, err: () => Error, message: string, slack: boolean }[] = [
                { name : 'invalid training', err : () => serviceError(400, 'invalid-training'), message : textmodels.ERROR_MESSAGES.UNKNOWN, slack : true },
                { name : 'training too large', err : () => serviceError(400, 'training-too-large'), message : textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE, slack : true },
                { name : 'request too large', err : () => serviceError(413, 'request-too-large'), message : textmodels.ERROR_MESSAGES.TRAINING_TOO_LARGE, slack : true },
                { name : 'busy', err : () => serviceError(503, 'busy'), message : textmodels.ERROR_MESSAGES.SERVICE_BUSY, slack : true },
                { name : 'starting', err : () => serviceError(503, 'starting'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'internal error', err : () => serviceError(500, 'internal-error'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'other 5xx', err : () => serviceError(502, 'bad-gateway'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'unauthorized', err : () => serviceError(401, 'unauthorized'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'other 4xx', err : () => serviceError(404, 'not-found'), message : textmodels.ERROR_MESSAGES.UNKNOWN, slack : true },
                { name : 'timeout', err : timeoutError, message : textmodels.ERROR_MESSAGES.UNKNOWN, slack : true },
                { name : 'connection refused', err : () => networkError('ECONNREFUSED'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'unknown host', err : () => networkError('ENOTFOUND'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'connection timed out', err : () => networkError('ETIMEDOUT'), message : textmodels.ERROR_MESSAGES.UNKNOWN, slack : true },
                { name : 'connection reset', err : () => networkError('ECONNRESET'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'unidentified network', err : () => requestError('ECONNRESET'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
            ];

            for (const testcase of cases) {
                it('should handle ' + testcase.name + ' errors', async () => {
                    postStub.rejects(testcase.err());
                    await assertFailure(textservice.train(trainingData()), testcase.message, testcase.slack);
                    assert(postStub.calledOnce);
                });
            }

        });

    });


    describe('classify', () => {

        const MODELID = '3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10';
        const HEAD = Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x00, 0xff, 0x10 ]);
        const HEAD_BASE64 = 'TUxGSwD/EA==';
        const TIMESTAMP = new Date(2026, 10, 1, 12, 30, 0);

        function classifyResponse() {
            return {
                modelid : MODELID,
                classes : [
                    { label : 'happy', confidence : 0.8312 },
                    { label : 'sad', confidence : 0.0421 },
                    { label : 'bored', confidence : 0.0049 },
                ],
            };
        }

        it('should classify text using the cached model', async () => {
            postStub.resolves(classifyResponse());
            const getHead = sinon.stub().resolves(HEAD);

            const classes = await textservice.classify(MODELID, TIMESTAMP, 'what a lovely surprise', getHead);

            assert.deepStrictEqual(classes, [
                { class_name : 'happy', confidence : 83, classifierTimestamp : TIMESTAMP },
                { class_name : 'sad', confidence : 4, classifierTimestamp : TIMESTAMP },
                { class_name : 'bored', confidence : 0, classifierTimestamp : TIMESTAMP },
            ]);

            assert(postStub.calledOnce);
            const [ url, opts ] = postStub.firstCall.args;
            assert.strictEqual(url, 'http://text-service.test/models/' + MODELID + '/classify');
            assert.deepStrictEqual(opts.auth, { user : TEXT_SERVICE_USER, pass : TEXT_SERVICE_PASS });
            assert.strictEqual(opts.json, true);
            assert.deepStrictEqual(opts.body, { text : 'what a lovely surprise' });

            assert(getHead.notCalled);
        });

        it('should send the head if the service does not have the model cached', async () => {
            postStub.onFirstCall().rejects(serviceError(404, 'model-not-cached'));
            postStub.onSecondCall().resolves(classifyResponse());
            const getHead = sinon.stub().resolves(HEAD);

            const classes = await textservice.classify(MODELID, TIMESTAMP, 'what a lovely surprise', getHead);

            assert.strictEqual(classes.length, 3);
            assert.deepStrictEqual(classes[0], { class_name : 'happy', confidence : 83, classifierTimestamp : TIMESTAMP });

            assert(getHead.calledOnce);
            assert(postStub.calledTwice);
            assert.deepStrictEqual(postStub.firstCall.args[1].body, { text : 'what a lovely surprise' });
            const [ url, opts ] = postStub.secondCall.args;
            assert.strictEqual(url, 'http://text-service.test/models/' + MODELID + '/classify');
            assert.deepStrictEqual(opts.auth, { user : TEXT_SERVICE_USER, pass : TEXT_SERVICE_PASS });
            assert.deepStrictEqual(opts.body, { text : 'what a lovely surprise', model : HEAD_BASE64 });
        });

        describe('errors', () => {

            const cases: { name: string, err: () => Error, message: string, slack: boolean }[] = [
                { name : 'text too long', err : () => serviceError(400, 'text-too-long'), message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG, slack : true },
                { name : 'request too large', err : () => serviceError(413, 'request-too-large'), message : textmodels.ERROR_MESSAGES.TEXT_TOO_LONG, slack : true },
                { name : 'invalid model', err : () => serviceError(400, 'invalid-model'), message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND, slack : true },
                { name : 'needs retraining', err : () => serviceError(409, 'needs-retraining'), message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND, slack : false },
                { name : 'starting', err : () => serviceError(503, 'starting'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'internal error', err : () => serviceError(500, 'internal-error'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'other 5xx', err : () => serviceError(502, 'bad-gateway'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'unauthorized', err : () => serviceError(401, 'unauthorized'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'other 4xx', err : () => serviceError(400, 'invalid-text'), message : textmodels.ERROR_MESSAGES.UNKNOWN, slack : true },
                { name : 'timeout', err : timeoutError, message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
                { name : 'connection refused', err : () => networkError('ECONNREFUSED'), message : textmodels.ERROR_MESSAGES.SERVICE_ERROR, slack : true },
            ];

            for (const testcase of cases) {
                it('should handle ' + testcase.name + ' errors', async () => {
                    postStub.rejects(testcase.err());
                    const getHead = sinon.stub().resolves(HEAD);

                    await assertFailure(textservice.classify(MODELID, TIMESTAMP, 'hello', getHead), testcase.message, testcase.slack);

                    assert(postStub.calledOnce);
                    assert(getHead.notCalled);
                });

                it('should handle ' + testcase.name + ' errors when sending the head', async () => {
                    postStub.onFirstCall().rejects(serviceError(404, 'model-not-cached'));
                    postStub.onSecondCall().rejects(testcase.err());
                    const getHead = sinon.stub().resolves(HEAD);

                    await assertFailure(textservice.classify(MODELID, TIMESTAMP, 'hello', getHead), testcase.message, testcase.slack);

                    assert(postStub.calledTwice);
                    assert(getHead.calledOnce);
                });
            }

            it('should handle the model not being cached after sending the head', async () => {
                postStub.rejects(serviceError(404, 'model-not-cached'));
                const getHead = sinon.stub().resolves(HEAD);

                await assertFailure(textservice.classify(MODELID, TIMESTAMP, 'hello', getHead), textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND, true);

                assert(postStub.calledTwice);
                assert(getHead.calledOnce);
            });

            it('should return failures to get the head unchanged', async () => {
                postStub.rejects(serviceError(404, 'model-not-cached'));
                const headError = new Error('Failed to read head');
                const getHead = sinon.stub().rejects(headError);

                await assert.rejects(textservice.classify(MODELID, TIMESTAMP, 'hello', getHead), headError);

                assert(postStub.calledOnce);
                assert(slackStub.notCalled);
            });

        });

    });

});
