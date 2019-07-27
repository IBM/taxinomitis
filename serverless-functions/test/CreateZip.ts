/*eslint-env mocha */
import * as assert from 'assert';
import CreateZip from '../src/CreateZip';
import { CreateZipParams } from '../src/Requests';
import { HttpResponse } from '../src/Responses';



describe('Create image training zip function', () => {

    describe('Create zip', () => {

        describe('Cloud object storage', () => {

            it('should handle failure to access COS', () => {
                const params: CreateZipParams = {
                    locations : [
                        { type : 'retrieve', spec : {
                            classid : 'myclass',
                            imageid : 'myimage',
                            projectid : 'myproject',
                            userid : 'myuser',
                        }},
                    ],
                    imagestore : {
                        bucketid : 'a',
                        credentials : {
                            apiKeyId : 'a',
                            endpoint : 'b',
                            ibmAuthEndpoint : 'c',
                            serviceInstanceId : 'd',
                        },
                    },
                };
                return CreateZip(params)
                    .then((resp) => {
                        assert.strictEqual(resp.statusCode, 500);
                        assert.strictEqual(resp.body.error, 'Unable to download image from store (auth)');
                    });
            });
        });



        describe('Input parameter checking', () => {

            const INVALID_INPUTS = [
                undefined,
                null,
                [],
                'hello',
                { },
                {
                    locations : [
                        { imageid : '1', type : 'download', url : 'hello' },
                    ],
                },
                {
                    imagestore : {
                        bucketid : 'a',
                        credentials : {
                            apiKeyId : 'a',
                            endpoint : 'b',
                            ibmAuthEndpoint : 'c',
                            serviceInstanceId : 'd',
                        },
                    },
                },
                {
                    locations : [],
                    imagestore : {
                        bucketid : 'a',
                        credentials : {
                            apiKeyId : 'a',
                            endpoint : 'b',
                            ibmAuthEndpoint : 'c',
                            serviceInstanceId : 'd',
                        },
                    },
                },
                {
                    locations : [
                        { imageid : '1', type : 'invalid', url : 'hello' },
                    ],
                    imagestore : {
                        bucketid : 'a',
                        credentials : {
                            apiKeyId : 'a',
                            endpoint : 'b',
                            ibmAuthEndpoint : 'c',
                            serviceInstanceId : 'd',
                        },
                    },
                },
                {
                    locations : [
                        { imageid : '1', type : 'download' },
                    ],
                    imagestore : {
                        bucketid : 'a',
                        credentials : {
                            apiKeyId : 'a',
                            endpoint : 'b',
                            ibmAuthEndpoint : 'c',
                            serviceInstanceId : 'd',
                        },
                    },
                },
                {
                    locations : [
                        { imageid : '1', type : 'retrieve', projectid : 'a' },
                    ],
                    imagestore : {
                        bucketid : 'a',
                        credentials : {
                            apiKeyId : 'a',
                            endpoint : 'b',
                            ibmAuthEndpoint : 'c',
                            serviceInstanceId : 'd',
                        },
                    },
                },
            ] as unknown as CreateZipParams[];

            function isExpectedResponse(resp: HttpResponse) : boolean {
                return resp.body.error === 'Invalid request payload' &&
                       resp.statusCode === 400;
            }



            it('should reject missing or invalid input', () => {
                const promises = INVALID_INPUTS.map((input) => {
                    return CreateZip(input);
                });

                return Promise.all(promises)
                    .then((resp: HttpResponse[]) => {
                        assert(resp.every(isExpectedResponse));
                    });
            });
        });
    });
});
