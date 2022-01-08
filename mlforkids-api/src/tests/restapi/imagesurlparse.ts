/*eslint-env mocha */

import * as assert from 'assert';
import { mockReq } from 'sinon-express-mock';
import * as urlparse from '../../lib/restapi/images/urlparse';

describe('REST API - image urlparse', () => {

    it('projectUrl', () => {
        const req = mockReq({
            params : {
                classid : 'testclass',
                studentid : 'testuser',
                projectid : 'testproject',
            },
        });
        assert.deepStrictEqual(urlparse.projectUrl(req), {
            classid : 'testclass',
            userid : 'testuser',
            projectid : 'testproject',
        });
    });

    it('userUrl', () => {
        const req = mockReq({
            params : {
                classid : 'testclass',
                studentid : 'testuser',
            },
        });
        assert.deepStrictEqual(urlparse.userUrl(req), {
            classid : 'testclass',
            userid : 'testuser',
        });
    });


    it('classUrl', () => {
        const req = mockReq({
            params : {
                classid : 'testclass',
            },
        });
        assert.deepStrictEqual(urlparse.classUrl(req), {
            classid : 'testclass',
        });
    });
});
