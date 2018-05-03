// core dependencies
import * as fs from 'fs';
// external dependencies
import * as request from 'request';
// local dependencies
import loggerSetup from '../utils/logger';
import * as notifications from '../notifications/slack';


const log = loggerSetup();


type IErrCallback = (err?: Error) => void;



/**
 * Downloads a file from the specified URL to the specified location on disk.
 *
 * @param url  - downloads from
 * @param targetFilePath  - writes to
 */
export function file(url: string, targetFilePath: string, callback: IErrCallback): void {
    let callbackCalled = false;

    // There have been very occasional crashes in production due to the callback
    //  function here being called multiple times.
    // I can't see why this might happen, so this function is a temporary way of
    //  1) preventing future crashes
    //  2) capturing what makes it happen - with a nudge via Slack so I don't miss it
    //
    // It is just a brute-force check to make sure we don't call callback twice.
    //  I hope that the next time this happens, the URL and/or file path gives me
    //  a clue as to why.
    //
    // Yeah, it's horrid. I know.
    function invokeCallbackSafely(reportFailure: boolean): void {
        if (callbackCalled) {
            log.error({ url, targetFilePath }, 'Attempt to call callbackfn multiple times');
            notifications.notify('imageCheck failure : ' + url);
        }
        else {
            callbackCalled = true;
            if (reportFailure) {
                callback(new Error('Unable to download image from ' + url));
            }
            else {
                callback();
            }
        }
    }


    try {
        request.get({ url, timeout : 10000 })
            .on('error', () => {
                invokeCallbackSafely(true);
            })
            .pipe(fs.createWriteStream(targetFilePath)
                    .on('finish', () => { invokeCallbackSafely(false); }));
    }
    catch (err) {
        invokeCallbackSafely(true);
    }
}
