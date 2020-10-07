/*eslint-env mocha */

import * as dbpool from '../../lib/db/postgresqldb';
import * as store from '../../lib/db/store';


describe('DB - connections', () => {

    it('should handle disconnecting pool first', () => {
        return dbpool.disconnect();
    });

    it('should handle disconnecting store first', () => {
        return store.disconnect();
    });

    it('should handle multiple connects', async () => {
        await dbpool.connect();
        await dbpool.connect();
        await dbpool.disconnect();
    });

});
