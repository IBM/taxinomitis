// external dependencies
import * as ipaddr from 'ipaddr.js';


/**
 * Thrown when a request is refused because the resolved address it would
 *  connect to is not a public, globally-routable address.
 *
 * Protects against server-side request forgery (SSRF) - e.g. a
 *  user-supplied URL that resolves to an internal service, the cloud
 *  metadata endpoint, or loopback.
 */
export class UnsafeAddressError extends Error {
    name = 'UnsafeAddressError';

    constructor(host: string, address: string) {
        super('Refusing to connect to ' + host + ' (' + address + ') ' +
              'as it is not a public address');
        Object.setPrototypeOf(this, UnsafeAddressError.prototype);
    }
}


/**
 * Checks whether an IP address is a public, globally-routable unicast
 *  address.
 *
 * This is an allow-list (rather than a block-list of known-bad ranges),
 *  so anything that isn't recognised as ordinary public unicast space is
 *  treated as unsafe by default - including private/loopback/link-local
 *  ranges, IPv4-mapped IPv6 addresses wrapping a blocked IPv4 address,
 *  and anything ipaddr.js doesn't otherwise recognise.
 *
 * @param address - a literal IPv4 or IPv6 address (not a hostname)
 */
export function isPublicAddress(address: string): boolean {
    try {
        return ipaddr.process(address).range() === 'unicast';
    }
    catch (err) {
        return false;
    }
}


/**
 * Throws an UnsafeAddressError if the given address is not a public,
 *  globally-routable address.
 *
 * @param host - the hostname the request was made to (for the error message)
 * @param address - the literal IP address that host resolved to
 */
export function assertPublicAddress(host: string, address: string): void {
    if (!isPublicAddress(address)) {
        throw new UnsafeAddressError(host, address);
    }
}


/**
 * Checks a URL's hostname when it is a literal IP address, and throws if
 *  that address is not public.
 *
 * dnsLookup hooks (see wrapDnsLookup) are never invoked for a literal IP
 *  address - the underlying networking code connects to it directly,
 *  skipping DNS resolution entirely - so a literal-IP hostname has to be
 *  checked here instead. A hostname that isn't a literal IP address is
 *  left for DNS resolution (and wrapDnsLookup) to check once resolved.
 *
 * This is meant to be used as a got beforeRequest/beforeRedirect hook (or
 *  called directly with the target URL) so that literal-IP targets are
 *  caught both on the initial request and on every redirect hop.
 */
export function assertSafeUrl(url: URL): void {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (ipaddr.isValid(hostname)) {
        assertPublicAddress(hostname, hostname);
    }
}


interface LookupAddress {
    address: string;
    family: number;
}
type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
type LookupFunction = (hostname: string, options: any, callback: LookupCallback) => void;


/**
 * Wraps a dns.lookup-compatible function (e.g. dns.lookup itself, or a
 *  CacheableLookup instance's .lookup method) so that every address it
 *  resolves is checked with assertPublicAddress before being handed back.
 *
 * This is meant to be used as the dnsLookup option for an HTTP client
 *  (e.g. got) so that the *actual* address used to open each connection
 *  is validated - including on every redirect hop, since the client
 *  calls this again for each new connection it makes. Validating here,
 *  rather than with a separate up-front lookup, is what closes the
 *  DNS-rebinding gap: there's no window between "checked" and "connected"
 *  for the resolved address to change.
 *
 * @param lookup - the underlying resolver to wrap
 */
export function wrapDnsLookup(lookup: LookupFunction): LookupFunction {
    return (hostname: string, options: any, callback: LookupCallback) => {
        lookup(hostname, options, (err, address, family) => {
            if (err) {
                return callback(err);
            }

            if (Array.isArray(address)) {
                const unsafe = address.find((entry) => !isPublicAddress(entry.address));
                if (unsafe) {
                    return callback(new UnsafeAddressError(hostname, unsafe.address));
                }
                return callback(null, address, family);
            }

            if (address && !isPublicAddress(address)) {
                return callback(new UnsafeAddressError(hostname, address));
            }

            callback(null, address, family);
        });
    };
}
