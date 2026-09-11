import { describe, it, before } from 'node:test';
import * as assert from 'assert';

import * as download from '../../lib/utils/download';
import * as urlsafety from '../../lib/utils/urlsafety';


describe('Utils - download', () => {

    // mlforkids-got loads 'got' via a dynamic import(), which resolves
    //  asynchronously after this module is first required - give it a
    //  moment to finish before making any requests
    before(() => {
        return new Promise((resolve) => { setTimeout(resolve, 1000); });
    });

    // these target private/loopback literal IP addresses, so no listener
    //  is needed on the other end - the SSRF guard must refuse to connect
    //  before any socket is opened, based on the address alone
    const UNSAFE_URLS = [
        'http://127.0.0.1:1/image.jpg',
        'http://[::1]:1/image.jpg',
        'http://10.255.255.1:1/image.jpg',
        'http://169.254.169.254/latest/meta-data/',
    ];

    describe('file()', () => {

        for (const unsafeUrl of UNSAFE_URLS) {
            it('should refuse to download from ' + unsafeUrl, async () => {
                await new Promise<void>((resolve, reject) => {
                    download.file(unsafeUrl, '/tmp/should-not-be-created.jpg', (err) => {
                        try {
                            assert(err, 'expected an error');
                            assert(err && err.cause instanceof urlsafety.UnsafeAddressError,
                                   'expected the failure to be caused by the SSRF guard');
                            resolve();
                        }
                        catch (assertionErr) {
                            reject(assertionErr);
                        }
                    });
                });
            });
        }

    });

    describe('resizeUrl()', () => {

        for (const unsafeUrl of UNSAFE_URLS) {
            it('should refuse to download from ' + unsafeUrl, async () => {
                await assert.rejects(
                    () => download.resizeUrl(unsafeUrl, 100, 100),
                    (err: any) => {
                        assert(err.cause instanceof urlsafety.UnsafeAddressError,
                               'expected the failure to be caused by the SSRF guard');
                        return true;
                    }
                );
            });
        }

    });

});
