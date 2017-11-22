/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';

import * as loggerSetup from '../utils/logger';

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
            .callsFake((msg, callback) => {
                if (msg === expectedMessage) {
                    callback(null, {
                        'content-type' : 'text/html',
                        'content-length' : 2,
                        'connection' : 'close',
                        'access-control-allow-origin' : '*',
                        'date' : 'Sun, 29 Oct 2017 01:07:33 GMT',
                        'referrer-policy' : 'no-referrer',
                        'server' : 'Apache',
                        'strict-transport-security' : 'max-age=31536000; includeSubDomains; preload',
                        'vary' : 'Accept-Encoding',
                        'x-frame-options' : 'SAMEORIGIN',
                        'x-slack-backend' : 'h',
                        'x-cache' : 'Miss from cloudfront',
                        'via' : '1.1 adc13b6f5827d04caa2efba65479257c.cloudfront.net (CloudFront)',
                        'x-amz-cf-id' : '2G814ezFiZa2nzquI5HICNNdnRnTgr0-dUx98HQ3A==',
                    });
                }
                else if (msg === unsendableMessage) {
                    callback(new Error('Message cannot be sent'));
                }
                else {
                    assert.equal(msg, expectedMessage);
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

        assert.equal(slackClientStub.called, false);
    });

    it('Send message before init', () => {
        slackClientStub.resetHistory();

        slack.notify('This is my message which will not be sent');

        assert.equal(slackClientStub.called, false);
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
