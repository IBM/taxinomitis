/*eslint-env mocha */

import * as assert from 'assert';
import * as express from 'express';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';
import * as IBMCosSDK from 'ibm-cos-sdk';
import * as request from 'supertest';
import * as httpStatus from 'http-status';

import * as store from '../../lib/db/store';
import * as auth from '../../lib/restapi/auth';
import * as imagestore from '../../lib/imagestore';
import * as mock from '../imagestore/mockStore';
import testapiserver from './testserver';



let testServer: express.Express;

describe('REST API - image uploads', () => {

    let authStub: sinon.SinonStub;
    let checkUserStub: sinon.SinonStub;
    let requireSupervisorStub: sinon.SinonStub;

    function authNoOp(
        req: Express.Request, res: Express.Response,
        next: (err?: Error) => void)
    {
        next();
    }


    let oldEnvCreds: string | undefined;
    let oldEnvBucket: string | undefined;

    before(async () => {
        authStub = sinon.stub(auth, 'authenticate').callsFake(authNoOp);
        checkUserStub = sinon.stub(auth, 'checkValidUser').callsFake(authNoOp);
        requireSupervisorStub = sinon.stub(auth, 'requireSupervisor').callsFake(authNoOp);

        oldEnvCreds = process.env.OBJECT_STORE_CREDS;
        oldEnvBucket = process.env.OBJECT_STORE_BUCKET;

        process.env.OBJECT_STORE_CREDS = JSON.stringify({
            endpoint : 'localhost:9999',
            apiKeyId : 'myApiKey',
            ibmAuthEndpoint : 'https://iam.ng.bluemix.net/oidc/token',
            serviceInstanceId : 'uniqServInstanceId',
        });
        process.env.OBJECT_STORE_BUCKET = 'TESTBUCKET';

        await store.init();

        testServer = testapiserver();
    });


    after(() => {
        process.env.OBJECT_STORE_CREDS = oldEnvCreds;
        process.env.OBJECT_STORE_BUCKET = oldEnvBucket;

        authStub.restore();
        checkUserStub.restore();
        requireSupervisorStub.restore();

        return store.disconnect();
    });


    let cosStub: sinon.SinonStub;

    beforeEach(() => {
        mock.reset();
        cosStub = sinon.stub(IBMCosSDK, 'S3');
        cosStub.returns(mock.mockS3);
        imagestore.init();
    });
    afterEach(() => {
        cosStub.restore();
    });





    describe('invalid requests', () => {

        it('should require a file', () => {
            return request(testServer)
                .post('/api/classes/classid/students/studentid/projects/projectid/images')
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'File not provided' });
                });
        });

        it('should require an image file', () => {
            return request(testServer)
                .post('/api/classes/classid/students/studentid/projects/projectid/images')
                .attach('image', './package.json')
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Unsupported file type application/json' });
                });
        });

        it('should require a label', () => {
            return request(testServer)
                .post('/api/classes/classid/students/studentid/projects/projectid/images')
                .attach('image', './src/tests/utils/resources/test-02.jpg')
                .expect(httpStatus.BAD_REQUEST)
                .then((res) => {
                    assert.deepStrictEqual(res.body, { error : 'Image label not provided' });
                });
        });
    });


    describe('valid requests', () => {
        it('should upload a file', () => {
            return request(testServer)
                .post('/api/classes/TESTCLASS/students/TESTSTUDENT/projects/TESTPROJECT/images')
                .attach('image', './src/tests/utils/resources/test-01.jpg')
                .field('label', 'testlabel')
                .expect(httpStatus.CREATED)
                .then((res) => {
                    assert(res.body.id);

                    assert.strictEqual(res.body.isstored, true);
                    assert.strictEqual(res.body.label, 'testlabel');
                    assert.equal(res.body.projectid, 'TESTPROJECT');

                    // tslint:disable-next-line:max-line-length
                    assert(res.body.imageurl.startsWith('/api/classes/TESTCLASS/students/TESTSTUDENT/projects/TESTPROJECT/images/'));

                    assert(res.header.etag);

                    return store.deleteTraining('images', 'TESTPROJECT', res.body.id);
                });
        });
    });

});
