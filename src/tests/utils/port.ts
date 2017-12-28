/*eslint-env mocha */
import * as assert from 'assert';

import portNumber from '../../lib/utils/port';


describe('Utils - port number', () => {


    it('should handle missing port numbers', () => {
        assert.equal(portNumber(undefined, 1234), 1234);
    });

    it('should handle invalid port numbers', () => {
        assert.equal(portNumber('hello', 1234), 1234);
    });

    it('should handle valid port numbers', () => {
        assert.equal(portNumber('5678', 1234), 5678);
    });

});
