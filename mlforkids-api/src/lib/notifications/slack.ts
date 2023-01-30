// external dependencies
import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook';
// local dependencies
import * as env from '../utils/env';
import { FIFTEEN_MINUTES } from '../utils/constants';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


const lastMessage = {
    text: '',
    channel: '',
    duplicateCount: 0,
    firstSeen: Date.now(),
};


let webhook: IncomingWebhook | undefined;

export function init() {
    const slackUrl: string | undefined = process.env[env.SLACK_WEBHOOK_URL];
    if (slackUrl) {
        webhook = new IncomingWebhook(slackUrl);
    }

    lastMessage.text = '';
    lastMessage.channel = '';
    lastMessage.duplicateCount = 0;
    lastMessage.firstSeen = Date.now();
}


// to avoid hitting Slack API limits, we want to avoid
//  sending large numbers of identical messages in a short
//  time period
function isDuplicateMessage(text: string, channel: string): boolean {
    return text === lastMessage.text &&
           channel === lastMessage.channel;
}

function alreadySentRecently(): boolean {
    return Date.now() < (lastMessage.firstSeen + FIFTEEN_MINUTES);
}


function sendMessage(message: string, channel: string, count: number): void {
    if (webhook) {
        // prefix the message with the count of how many times we've seen it
        const prefix = (count > 1) ? '(x ' + count + ') ' : '';
        const text = prefix + message;

        webhook.send({ text, channel })
            .then((res: IncomingWebhookResult) => {
                log.debug({ res }, 'Sent notification');
            })
            .catch((err) => {
                log.error({ err }, 'Failed to send notification');
            });
    }
}


export function notify(text: string, channel: string): void {
    if (webhook) {
        if (isDuplicateMessage(text, channel)) {
            lastMessage.duplicateCount += 1;

            if (alreadySentRecently()) {
                // swallow this message as we've sent an identical
                //  message recently, but we've kept a count that
                //  it was emitted
            }
            else {
                // send the duplicate message now as it has been
                //  a while since we first sent it
                sendMessage(text, channel, lastMessage.duplicateCount);

                // reset duplicates count as we've sent it
                lastMessage.duplicateCount = 0;
                lastMessage.firstSeen = Date.now();
            }
        }
        else {
            // this is different to the message we've seen last

            if (lastMessage.duplicateCount > 0) {
                // send the one that we've been holding back first
                sendMessage(lastMessage.text, lastMessage.channel, lastMessage.duplicateCount);
            }

            // new message
            sendMessage(text, channel, 0);

            // remember that we've sent the new message
            //  in case we see subsequent duplicates
            lastMessage.text = text;
            lastMessage.channel = channel;
            lastMessage.duplicateCount = 0;
            lastMessage.firstSeen = Date.now();
        }
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
