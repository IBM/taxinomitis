/*eslint-env mocha */
import * as assert from 'assert';

import loggerSetup from '../../lib/utils/logger';



describe('REST API - Bluemix', () => {

    it('should create a logger', () => {
        const logger = loggerSetup();
        assert(logger.info);
        assert(logger.debug);
        assert(logger.error);
    });

});


