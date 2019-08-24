/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';
import * as IBMCosSDK from 'ibm-cos-sdk';

import * as objectstore from '../../lib/objectstore';
import * as mock from './mockStore';


describe('Object Store', () => {

    let oldEnvCreds: string | undefined;
    let oldEnvBucket: string | undefined;

    before(() => {
        oldEnvCreds = process.env.OBJECT_STORE_CREDS;
        oldEnvBucket = process.env.OBJECT_STORE_BUCKET;

        process.env.OBJECT_STORE_CREDS = JSON.stringify({
            endpoint : 'localhost:9999',
            apiKeyId : 'myApiKey',
            ibmAuthEndpoint : 'https://iam.ng.bluemix.net/oidc/token',
            serviceInstanceId : 'uniqServInstanceId',
        });
        process.env.OBJECT_STORE_BUCKET = 'TESTBUCKET';
    });

    after(() => {
        process.env.OBJECT_STORE_CREDS = oldEnvCreds;
        process.env.OBJECT_STORE_BUCKET = oldEnvBucket;
    });


    let cosStub: sinon.SinonStub;

    beforeEach(() => {
        mock.reset();
        cosStub = sinon.stub(IBMCosSDK, 'S3');
        cosStub.returns(mock.mockS3);
        objectstore.init();
    });
    afterEach(() => {
        cosStub.restore();
    });



    describe('handle unexpected storage contents', () => {

        it('handle missing metadata', async () => {
            const spec = {
                classid : 'INVALIDCLASS',
                userid : 'INVALIDUSER',
                projectid : 'INVALIDPROJECT',
                objectid : 'MISSINGMETADATA',
            };
            const retrieved = await objectstore.getImage(spec);
            assert.strictEqual(retrieved.filetype, '');
        });

        it('handle empty metadata', async () => {
            const spec = {
                classid : 'INVALIDCLASS',
                userid : 'INVALIDUSER',
                projectid : 'INVALIDPROJECT',
                objectid : 'INVALIDMETADATA',
            };
            const retrieved = await objectstore.getImage(spec);
            assert.strictEqual(retrieved.filetype, '');
        });

        it('handle invalid metadata', async () => {
            const spec = {
                classid : 'INVALIDCLASS',
                userid : 'INVALIDUSER',
                projectid : 'INVALIDPROJECT',
                objectid : 'INVALIDIMAGETYPE',
            };
            const retrieved = await objectstore.getImage(spec);
            assert.strictEqual(retrieved.filetype, '');
        });
    });


    describe('store and retrieve individual images', () => {

        it('store and retrieve png images', async () => {
            const spec = {
                classid : 'MYCLASS',
                userid : 'MYUSER',
                projectid : 'MYPROJECT',
                objectid : 'MYPNGIMAGE',
            };
            const image = Buffer.from('ABCDEF');
            const imageType = 'image/png';

            const stored = await objectstore.storeImage(spec, imageType, image);

            const retrieved = await objectstore.getImage(spec);

            assert.deepStrictEqual(retrieved, {
                size : image.byteLength,
                body : image,
                modified : 'Fri, 22 Dec 2017 21:34:59 GMT',
                etag : stored,
                filetype : imageType,
            });
        });


        it('store and retrieve jpeg images', async () => {
            const spec = {
                classid : 'MYCLASS',
                userid : 'MYUSER',
                projectid : 'MYPROJECT',
                objectid : 'MYJPEGIMAGE',
            };
            const image = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
            const imageType = 'image/jpeg';

            const stored = await objectstore.storeImage(spec, imageType, image);

            const retrieved = await objectstore.getImage(spec);

            assert.deepStrictEqual(retrieved, {
                size : image.byteLength,
                body : image,
                modified : 'Fri, 22 Dec 2017 21:34:59 GMT',
                etag : stored,
                filetype : imageType,
            });
        });
    });


    describe('delete images', () => {

        it('delete png images', async () => {
            const spec = {
                classid : 'MYCLASS',
                userid : 'MYUSER',
                projectid : 'MYPROJECT',
                objectid : 'MYPNGIMAGE',
            };
            const image = Buffer.from('ABCDEFGHIJK');
            const imageType = 'image/png';

            const stored = await objectstore.storeImage(spec, imageType, image);

            const retrieved = await objectstore.getImage(spec);

            assert.deepStrictEqual(retrieved, {
                size : image.byteLength,
                body : image,
                modified : 'Fri, 22 Dec 2017 21:34:59 GMT',
                etag : stored,
                filetype : imageType,
            });

            await objectstore.deleteObject(spec);

            try {
                await objectstore.getImage(spec);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'The specified key does not exist.');
                assert.strictEqual(err.code, 'NoSuchKey');
                assert.strictEqual(err.statusCode, 404);
            }
        });
    });


    describe('delete projects', () => {

        it('delete png projects', async () => {
            for (let i = 0; i < 10; i++) {
                const spec = {
                    classid : 'MYTESTCLASS',
                    userid : 'MYTESTUSER',
                    projectid : 'MYTESTPROJECT',
                    objectid : 'MYTESTPNGIMAGE' + i,
                };
                const image = Buffer.from(randomstring.generate({ length : 100 }));
                const imageType = 'image/png';

                await objectstore.storeImage(spec, imageType, image);
            }

            await objectstore.getImage({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
                projectid : 'MYTESTPROJECT',
                objectid : 'MYTESTPNGIMAGE7',
            });

            await objectstore.deleteProject({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
                projectid : 'MYTESTPROJECT',
            });

            try {
                await objectstore.getImage({
                    classid : 'MYTESTCLASS',
                    userid : 'MYTESTUSER',
                    projectid : 'MYTESTPROJECT',
                    objectid : 'MYTESTPNGIMAGE7',
                });
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'The specified key does not exist.');
                assert.strictEqual(err.code, 'NoSuchKey');
                assert.strictEqual(err.statusCode, 404);
            }
        });

        it('delete unknown projects', async () => {
            await objectstore.deleteProject({
                classid : 'MYUNKNOWNTESTCLASS',
                userid : 'MYUNKNOWNTESTUSER',
                projectid : 'MYUNKNOWNTESTPROJECT',
            });
        });
    });


    describe('delete users', () => {

        it('delete jpg users', async () => {
            for (let proj = 0; proj < 5; proj++) {
                for (let img = 0; img < 10; img++) {
                    const spec = {
                        classid : 'MYTESTCLASS',
                        userid : 'MYTESTUSER',
                        projectid : 'MYTESTPROJECT' + proj,
                        objectid : 'MYTESTJPGIMAGE' + img,
                    };
                    const image = Buffer.from(randomstring.generate({ length : 100 }));
                    const imageType = 'image/jpeg';

                    await objectstore.storeImage(spec, imageType, image);
                }
            }

            await objectstore.getImage({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
                projectid : 'MYTESTPROJECT3',
                objectid : 'MYTESTJPGIMAGE6',
            });

            await objectstore.deleteUser({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
            });

            try {
                await objectstore.getImage({
                    classid : 'MYTESTCLASS',
                    userid : 'MYTESTUSER',
                    projectid : 'MYTESTPROJECT3',
                    objectid : 'MYTESTJPGIMAGE6',
                });
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'The specified key does not exist.');
                assert.strictEqual(err.code, 'NoSuchKey');
                assert.strictEqual(err.statusCode, 404);
            }
        });

        it('delete unknown users', async () => {
            await objectstore.deleteUser({
                classid : 'MYVERYUNKNOWNTESTCLASS',
                userid : 'MYVERYUNKNOWNTESTUSER',
            });
        });
    });


    describe('delete classes', () => {

        it('delete png classes', async () => {
            for (let user = 10; user < 18; user++) {
                for (let proj = 0; proj < 5; proj++) {
                    for (let img = 0; img < 10; img++) {
                        const spec = {
                            classid : 'ATESTCLASS',
                            userid : 'ATESTUSER' + user,
                            projectid : 'ATESTPROJECT' + proj,
                            objectid : 'ATESTPNGIMAGE' + img,
                        };
                        const image = Buffer.from(randomstring.generate({ length : 100 }));
                        const imageType = 'image/png';

                        await objectstore.storeImage(spec, imageType, image);
                    }
                }
            }

            await objectstore.getImage({
                classid : 'ATESTCLASS',
                userid : 'ATESTUSER11',
                projectid : 'ATESTPROJECT3',
                objectid : 'ATESTPNGIMAGE6',
            });

            await objectstore.deleteClass({
                classid : 'ATESTCLASS',
            });

            try {
                await objectstore.getImage({
                    classid : 'ATESTCLASS',
                    userid : 'ATESTUSER11',
                    projectid : 'ATESTPROJECT3',
                    objectid : 'ATESTPNGIMAGE6',
                });
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'The specified key does not exist.');
                assert.strictEqual(err.code, 'NoSuchKey');
                assert.strictEqual(err.statusCode, 404);
            }
        });

        it('delete unknown classes', async () => {
            await objectstore.deleteClass({
                classid : 'SOMEVERYUNKNOWNTESTCLASS',
            });
        });
    });

});
