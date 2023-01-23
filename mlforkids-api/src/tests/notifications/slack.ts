/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';

import * as slackClient from '@slack/webhook';

import * as slack from '../../lib/notifications/slack';



describe('Notifications - Slack', () => {

    let slackEnv: string | undefined;

    let expectedMessage = 'This is my message';
    const unsendableMessage = 'This message cannot be sent';

    let slackClientStub: sinon.SinonStub<any, any>;
    let clock: sinon.SinonFakeTimers;

    before(() => {
        clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });

        slackEnv = process.env.SLACK_WEBHOOK_URL;

        slackClientStub = sinon.stub(slackClient.IncomingWebhook.prototype, 'send')
            .callsFake((msg: slackClient.IncomingWebhookSendArguments | string) => {
                if (typeof msg === 'string') {
                    return assert.fail('Missing channel name');
                }

                if (msg.text === expectedMessage) {
                    const confirm: slackClient.IncomingWebhookResult = {
                        text: msg.text,
                    };
                    return new Promise((resolve) => {
                        resolve(confirm);
                    });
                }
                else if (msg.text === unsendableMessage) {
                    const error = new Error('Message cannot be sent');

                    const codedError: any = error;
                    codedError.code = slackClient.ErrorCode.HTTPError;
                    codedError.original = error;

                    return new Promise((resolve, reject) => {
                        reject(codedError);
                    });
                }
                else {
                    assert.strictEqual(msg.text, expectedMessage);
                    assert.strictEqual(msg.channel, 'critical-errors');
                }

                const unexpError = new Error('Message cannot be sent');
                const unexpCodedError: any = unexpError;
                unexpCodedError.code = slackClient.ErrorCode.HTTPError;
                unexpCodedError.original = unexpError;

                return new Promise((resolve, reject) => {
                    reject(unexpCodedError);
                });
            });
    });
    after(() => {
        process.env.SLACK_WEBHOOK_URL = slackEnv;

        slack.close();

        slackClientStub.restore();

        clock.restore();
    });

    beforeEach(() => {
        expectedMessage = 'This is my message';
        slackClientStub.resetHistory();
    });


    it('init without env var', () => {
        delete process.env.SLACK_WEBHOOK_URL;

        slack.init();

        slack.notify('This is my message which will not be sent', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        assert.strictEqual(slackClientStub.called, false);
    });

    it('Send message before init', () => {
        slack.notify('This is my message which will not be sent', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        assert.strictEqual(slackClientStub.called, false);
    });

    it('Send message after init', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        assert(slackClientStub.called);
    });

    it('Avoids sending duplicate messages', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        assert(slackClientStub.calledOnce);
    });

    it('Avoids hiding different messages', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        expectedMessage = 'This is my different message';
        slack.notify('This is my different message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        assert(slackClientStub.calledTwice);
    });

    it('Avoids holding onto messages for too long', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        assert(slackClientStub.calledOnce);
        slackClientStub.resetHistory();

        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        assert(slackClientStub.notCalled);
        slackClientStub.resetHistory();

        clock.tick(1000 * 60 * 16);

        expectedMessage = '(x 5) This is my message';
        slack.notify('This is my message', slack.SLACK_CHANNELS.CRITICAL_ERRORS);
        assert(slackClientStub.calledOnce);
    });

    it('Send unsendable message', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This message cannot be sent', slack.SLACK_CHANNELS.CRITICAL_ERRORS);

        assert(slackClientStub.called);
    });
});
