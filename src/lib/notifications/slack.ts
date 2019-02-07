// external dependencies
import { IncomingWebhook } from '@slack/client';
// local dependencies
import * as env from '../utils/env';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



let webhook: IncomingWebhook | undefined;

export function init() {
    const slackUrl: string | undefined = process.env[env.SLACK_WEBHOOK_URL];
    if (slackUrl) {
        webhook = new IncomingWebhook(slackUrl);
    }
}

export function notify(text: string, channel: string): void {
    if (webhook) {
        webhook.send({ text, channel }, (err?: Error, res?: object) => {
            if (err) {
                log.error({ err }, 'Failed to send notification');
            }
            else {
                log.debug({ res }, 'Sent notification');
            }
        });
    }
}

export function close() {
    if (webhook) {
        webhook = undefined;
    }
}

export const SLACK_CHANNELS = {
    ERRORS : 'errors',
    PASSWORD_RESET : 'password-resets',
    CREDENTIALS : 'credentials-check',
    CLASS_CREATE : 'new-classes',
    CLASS_DELETE : 'deleted-classes',
    CRITICAL_ERRORS : 'critical-errors',
    TRAINING_ERRORS : 'training-errors',
    UI_ERRORS : 'sentry',
    SESSION_USERS : 'session-users',
};
