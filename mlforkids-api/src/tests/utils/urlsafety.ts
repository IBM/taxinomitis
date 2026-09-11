import { describe, it } from 'node:test';
import * as assert from 'assert';

import * as urlsafety from '../../lib/utils/urlsafety';


describe('Utils - urlsafety', () => {

    describe('isPublicAddress()', () => {

        const BLOCKED_ADDRESSES = [
            // IPv4 loopback
            '127.0.0.1',
            '127.0.0.53',
            // IPv4 private ranges (RFC 1918)
            '10.0.0.1',
            '172.16.0.1',
            '172.31.255.255',
            '192.168.1.1',
            // IPv4 link-local, including the cloud metadata endpoint
            '169.254.169.254',
            '169.254.0.1',
            // IPv4 carrier-grade NAT
            '100.64.0.1',
            // IPv4 "this network"
            '0.0.0.0',
            // IPv6 loopback
            '::1',
            // IPv6 unique local (the IPv6 equivalent of RFC 1918)
            'fc00::1',
            'fd00::1',
            // IPv6 link-local
            'fe80::1',
            // IPv4-mapped IPv6 addresses - a common bypass technique -
            //  wrapping a blocked IPv4 address in IPv6 notation
            '::ffff:127.0.0.1',
            '::ffff:10.0.0.5',
            '::ffff:169.254.169.254',
        ];

        const ALLOWED_ADDRESSES = [
            '8.8.8.8',
            '1.1.1.1',
            '93.184.216.34',
            '2001:4860:4860::8888',
            '2606:4700:4700::1111',
        ];

        for (const address of BLOCKED_ADDRESSES) {
            it('should reject ' + address, () => {
                assert.strictEqual(urlsafety.isPublicAddress(address), false);
            });
        }

        for (const address of ALLOWED_ADDRESSES) {
            it('should allow ' + address, () => {
                assert.strictEqual(urlsafety.isPublicAddress(address), true);
            });
        }

        it('should reject addresses it cannot parse', () => {
            assert.strictEqual(urlsafety.isPublicAddress('not-an-ip-address'), false);
        });

    });


    describe('assertPublicAddress()', () => {

        it('should not throw for a public address', () => {
            assert.doesNotThrow(() => {
                urlsafety.assertPublicAddress('example.com', '93.184.216.34');
            });
        });

        it('should throw an UnsafeAddressError for a private address', () => {
            assert.throws(
                () => urlsafety.assertPublicAddress('internal.example.com', '10.0.0.1'),
                urlsafety.UnsafeAddressError
            );
        });

        it('should throw an UnsafeAddressError for the cloud metadata address', () => {
            assert.throws(
                () => urlsafety.assertPublicAddress('metadata.google.internal', '169.254.169.254'),
                urlsafety.UnsafeAddressError
            );
        });

        it('should include the host and address in the error message', () => {
            try {
                urlsafety.assertPublicAddress('internal.example.com', '10.0.0.1');
                assert.fail('should have thrown');
            }
            catch (err) {
                assert(err instanceof urlsafety.UnsafeAddressError);
                assert(err.message.includes('internal.example.com'));
                assert(err.message.includes('10.0.0.1'));
            }
        });

    });


    describe('wrapDnsLookup()', () => {

        // a fake "real" resolver, standing in for dns.lookup / a
        //  CacheableLookup instance, whose result we control - so
        //  none of these tests touch real DNS
        function fakeLookup(result: { address?: string | { address: string; family: number }[]; family?: number; err?: NodeJS.ErrnoException }) {
            return (hostname: string, options: any, callback: any) => {
                if (result.err) {
                    return callback(result.err);
                }
                callback(null, result.address, result.family);
            };
        }

        function callLookup(lookup: any, hostname: string, options: any): Promise<[any, any, any]> {
            return new Promise((resolve) => {
                lookup(hostname, options, (err: any, address: any, family: any) => {
                    resolve([ err, address, family ]);
                });
            });
        }

        it('should pass through a public single address', async () => {
            const safeLookup = urlsafety.wrapDnsLookup(fakeLookup({ address: '8.8.8.8', family: 4 }));
            const [ err, address, family ] = await callLookup(safeLookup, 'example.com', {});
            assert.strictEqual(err, null);
            assert.strictEqual(address, '8.8.8.8');
            assert.strictEqual(family, 4);
        });

        it('should block a private single address', async () => {
            const safeLookup = urlsafety.wrapDnsLookup(fakeLookup({ address: '10.0.0.1', family: 4 }));
            const [ err ] = await callLookup(safeLookup, 'internal.example.com', {});
            assert(err instanceof urlsafety.UnsafeAddressError);
        });

        it('should block the cloud metadata address', async () => {
            const safeLookup = urlsafety.wrapDnsLookup(fakeLookup({ address: '169.254.169.254', family: 4 }));
            const [ err ] = await callLookup(safeLookup, 'metadata.google.internal', {});
            assert(err instanceof urlsafety.UnsafeAddressError);
        });

        it('should pass through when every address in a multi-address result is public', async () => {
            const safeLookup = urlsafety.wrapDnsLookup(fakeLookup({
                address: [
                    { address: '8.8.8.8', family: 4 },
                    { address: '2001:4860:4860::8888', family: 6 },
                ],
            }));
            const [ err, addresses ] = await callLookup(safeLookup, 'example.com', { all: true });
            assert.strictEqual(err, null);
            assert.strictEqual(addresses.length, 2);
        });

        it('should block a multi-address result if any address is private', async () => {
            const safeLookup = urlsafety.wrapDnsLookup(fakeLookup({
                address: [
                    { address: '8.8.8.8', family: 4 },
                    { address: '127.0.0.1', family: 4 },
                ],
            }));
            const [ err ] = await callLookup(safeLookup, 'example.com', { all: true });
            assert(err instanceof urlsafety.UnsafeAddressError);
        });

        it('should pass through an error from the underlying resolver unchanged', async () => {
            const notFoundErr: any = new Error('not found');
            notFoundErr.code = 'ENOTFOUND';
            const safeLookup = urlsafety.wrapDnsLookup(fakeLookup({ err: notFoundErr }));
            const [ err ] = await callLookup(safeLookup, 'doesnotexist.example.com', {});
            assert.strictEqual(err, notFoundErr);
        });

        it('should re-validate on every call, blocking a later redirect target even after an earlier hop was public', async () => {
            // simulates the DNS lookup got performs on each hop of a redirect -
            //  the first hop resolves publicly, a later hop resolves to a
            //  private address, and that later hop must still be blocked
            const hopResults = [
                { address: '8.8.8.8', family: 4 },
                { address: '10.0.0.1', family: 4 },
            ];
            let call = 0;
            const safeLookup = urlsafety.wrapDnsLookup((hostname: string, options: any, callback: any) => {
                callback(null, hopResults[call++].address, hopResults[call - 1].family);
            });

            const [ firstErr ] = await callLookup(safeLookup, 'public-host.example.com', {});
            assert.strictEqual(firstErr, null);

            const [ secondErr ] = await callLookup(safeLookup, 'redirect-target.example.com', {});
            assert(secondErr instanceof urlsafety.UnsafeAddressError);
        });

    });


    describe('assertSafeUrl()', () => {

        // dnsLookup hooks are never invoked for a literal IP address - the
        //  underlying networking code connects to it directly - so a
        //  literal-IP hostname has to be checked separately, up front,
        //  rather than relying solely on wrapDnsLookup()

        it('should not throw for a hostname (not a literal IP)', () => {
            assert.doesNotThrow(() => {
                urlsafety.assertSafeUrl(new URL('https://example.com/path'));
            });
        });

        it('should not throw for a URL with a public literal IPv4 address', () => {
            assert.doesNotThrow(() => {
                urlsafety.assertSafeUrl(new URL('http://93.184.216.34/path'));
            });
        });

        it('should throw for a URL with a loopback literal IPv4 address', () => {
            assert.throws(
                () => urlsafety.assertSafeUrl(new URL('http://127.0.0.1/path')),
                urlsafety.UnsafeAddressError
            );
        });

        it('should throw for a URL with a private literal IPv4 address', () => {
            assert.throws(
                () => urlsafety.assertSafeUrl(new URL('http://10.0.0.1/path')),
                urlsafety.UnsafeAddressError
            );
        });

        it('should throw for a URL with the cloud metadata literal address', () => {
            assert.throws(
                () => urlsafety.assertSafeUrl(new URL('http://169.254.169.254/latest/meta-data/')),
                urlsafety.UnsafeAddressError
            );
        });

        it('should throw for a URL with a loopback literal IPv6 address', () => {
            assert.throws(
                () => urlsafety.assertSafeUrl(new URL('http://[::1]/path')),
                urlsafety.UnsafeAddressError
            );
        });

        it('should throw for a URL with a private literal IPv6 address', () => {
            assert.throws(
                () => urlsafety.assertSafeUrl(new URL('http://[fc00::1]/path')),
                urlsafety.UnsafeAddressError
            );
        });

    });

});
