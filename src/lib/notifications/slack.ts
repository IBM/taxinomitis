// external dependencies
import { IncomingWebhook } from '@slack/client';
// local dependencies
import loggerSetup from '../utils/logger';

const log = loggerSetup();



let webhook;

export function init() {
    if (process.env.SLACK_WEBHOOK_URL) {
        webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    }
}

export function notify(message: string): void {
    if (webhook) {
        webhook.send(message, (err?: Error, res?: object) => {
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
        webhook = null;
    }
}
