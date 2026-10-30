import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as Express from 'express';
import * as country from '../../lib/cloudflare/country';


describe('Cloudflare - country', () => {

    function mockRequest(headers: { [name: string]: string }): Express.Request {
        return {
            header : (name: string) => headers[name.toLowerCase()],
        } as unknown as Express.Request;
    }


    it('should use the country from the edge worker', () => {
        assert.strictEqual(country.getCountry(mockRequest({
            'x-mlforkids-country' : 'SG',
            'cf-ipcountry' : 'US',
        })), 'SG');
    });

    it('should fall back to the Cloudflare header', () => {
        assert.strictEqual(country.getCountry(mockRequest({
            'cf-ipcountry' : 'GB',
        })), 'GB');
    });

    it('should handle requests without a country', () => {
        assert.strictEqual(country.getCountry(mockRequest({})), undefined);
    });
});
