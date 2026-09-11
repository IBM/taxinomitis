import { describe, it, before } from 'node:test';
import * as assert from 'assert';

import * as scratchtfjs from '../../lib/scratchx/scratchtfjs';
import * as urlsafety from '../../lib/utils/urlsafety';


describe('Scratchx - scratchtfjs', () => {

    // mlforkids-got loads 'got' via a dynamic import(), which resolves
    //  asynchronously after this module is first required - give it a
    //  moment to finish before making any requests
    before(() => {
        return new Promise((resolve) => { setTimeout(resolve, 1000); });
    });

    // these target private/loopback literal IP addresses, so no listener
    //  is needed on the other end - the SSRF guard must refuse to connect
    //  before any socket is opened, based on the address alone
    const UNSAFE_MODEL_URLS = [
        'http://127.0.0.1:1/model.json',
        'http://[::1]:1/model.json',
        'http://10.255.255.1:1/model.json',
        'http://169.254.169.254/latest/meta-data/model.json',
    ];

    describe('generateUrl()', () => {

        for (const unsafeUrl of UNSAFE_MODEL_URLS) {
            it('should refuse a model url pointing at ' + unsafeUrl, async () => {
                await assert.rejects(
                    () => scratchtfjs.generateUrl({ modelurl : unsafeUrl, modeltype : 'graphdefimage' }),
                    (err: any) => {
                        assert(err.cause instanceof urlsafety.UnsafeAddressError ||
                               err instanceof urlsafety.UnsafeAddressError,
                               'expected the failure to be caused by the SSRF guard');
                        return true;
                    }
                );
            });
        }

    });

});
