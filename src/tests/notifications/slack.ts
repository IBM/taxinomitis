/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';

import * as slackClient from '@slack/client';
import * as slack from '../../lib/notifications/slack';



describe('Notifications - Slack', () => {

    let slackEnv: string | undefined;

    const expectedMessage = 'This is my message';
    const unsendableMessage = 'This message cannot be sent';

    let slackClientStub: sinon.SinonStub;

    before(() => {
        slackEnv = process.env.SLACK_WEBHOOK_URL;

        slackClientStub = sinon.stub(slackClient.IncomingWebhook.prototype, 'send')
            .callsFake((msg: string | slackClient.IncomingWebhookSendArguments,
                        callback: slackClient.IncomingWebhookResultCallback) =>
            {
                if (typeof msg === 'string' && msg === expectedMessage) {
                    const confirm: slackClient.IncomingWebhookResult = {
                        text: msg,
                    };
                    callback(undefined, confirm);
                }
                else if (msg === unsendableMessage) {
                    const error = new Error('Message cannot be sent');

                    const codedError: any = error;
                    codedError.code = slackClient.ErrorCode.IncomingWebhookRequestError;
                    codedError.original = error;

                    callback(codedError, undefined);
                }
                else {
                    assert.strictEqual(msg, expectedMessage);
                }
            });
    });
    after(() => {
        process.env.SLACK_WEBHOOK_URL = slackEnv;

        slack.close();

        slackClientStub.restore();
    });


    it('init without env var', () => {
        delete process.env.SLACK_WEBHOOK_URL;

        slackClientStub.resetHistory();

        slack.init();

        slack.notify('This is my message which will not be sent');

        assert.strictEqual(slackClientStub.called, false);
    });

    it('Send message before init', () => {
        slackClientStub.resetHistory();

        slack.notify('This is my message which will not be sent');

        assert.strictEqual(slackClientStub.called, false);
    });

    it('Send message after init', () => {
        slackClientStub.resetHistory();

        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This is my message');

        assert(slackClientStub.called);
    });

    it('Send unsendable message', () => {
        slackClientStub.resetHistory();

        process.env.SLACK_WEBHOOK_URL = 'https://fake.com';
        slack.init();

        slack.notify('This message cannot be sent');

        assert(slackClientStub.called);
    });
});
