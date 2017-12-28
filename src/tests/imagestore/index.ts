/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as randomstring from 'randomstring';
import * as IBMCosSDK from 'ibm-cos-sdk';

import * as imagestore from '../../lib/imagestore';
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
        imagestore.init();
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
                imageid : 'MISSINGMETADATA',
            };
            const retrieved = await imagestore.getImage(spec);
            assert.strictEqual(retrieved.filetype, '');
        });

        it('handle empty metadata', async () => {
            const spec = {
                classid : 'INVALIDCLASS',
                userid : 'INVALIDUSER',
                projectid : 'INVALIDPROJECT',
                imageid : 'INVALIDMETADATA',
            };
            const retrieved = await imagestore.getImage(spec);
            assert.strictEqual(retrieved.filetype, '');
        });

        it('handle invalid metadata', async () => {
            const spec = {
                classid : 'INVALIDCLASS',
                userid : 'INVALIDUSER',
                projectid : 'INVALIDPROJECT',
                imageid : 'INVALIDIMAGETYPE',
            };
            const retrieved = await imagestore.getImage(spec);
            assert.strictEqual(retrieved.filetype, '');
        });
    });


    describe('store and retrieve individual images', () => {

        it('store and retrieve png images', async () => {
            const spec = {
                classid : 'MYCLASS',
                userid : 'MYUSER',
                projectid : 'MYPROJECT',
                imageid : 'MYPNGIMAGE',
            };
            const image = new Buffer('ABCDEF');
            const imageType = 'image/png';

            const stored = await imagestore.storeImage(spec, imageType, image);

            const retrieved = await imagestore.getImage(spec);

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
                imageid : 'MYJPEGIMAGE',
            };
            const image = new Buffer('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
            const imageType = 'image/jpeg';

            const stored = await imagestore.storeImage(spec, imageType, image);

            const retrieved = await imagestore.getImage(spec);

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
                imageid : 'MYPNGIMAGE',
            };
            const image = new Buffer('ABCDEFGHIJK');
            const imageType = 'image/png';

            const stored = await imagestore.storeImage(spec, imageType, image);

            const retrieved = await imagestore.getImage(spec);

            assert.deepStrictEqual(retrieved, {
                size : image.byteLength,
                body : image,
                modified : 'Fri, 22 Dec 2017 21:34:59 GMT',
                etag : stored,
                filetype : imageType,
            });

            await imagestore.deleteImage(spec);

            try {
                await imagestore.getImage(spec);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.equal(err.message, 'The specified key does not exist.');
                assert.equal(err.code, 'NoSuchKey');
                assert.equal(err.statusCode, 404);
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
                    imageid : 'MYTESTPNGIMAGE' + i,
                };
                const image = new Buffer(randomstring.generate({ length : 100 }));
                const imageType = 'image/png';

                await imagestore.storeImage(spec, imageType, image);
            }

            await imagestore.getImage({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
                projectid : 'MYTESTPROJECT',
                imageid : 'MYTESTPNGIMAGE7',
            });

            await imagestore.deleteProject({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
                projectid : 'MYTESTPROJECT',
            });

            try {
                await imagestore.getImage({
                    classid : 'MYTESTCLASS',
                    userid : 'MYTESTUSER',
                    projectid : 'MYTESTPROJECT',
                    imageid : 'MYTESTPNGIMAGE7',
                });
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.equal(err.message, 'The specified key does not exist.');
                assert.equal(err.code, 'NoSuchKey');
                assert.equal(err.statusCode, 404);
            }
        });

        it('delete unknown projects', async () => {
            await imagestore.deleteProject({
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
                        imageid : 'MYTESTJPGIMAGE' + img,
                    };
                    const image = new Buffer(randomstring.generate({ length : 100 }));
                    const imageType = 'image/jpeg';

                    await imagestore.storeImage(spec, imageType, image);
                }
            }

            await imagestore.getImage({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
                projectid : 'MYTESTPROJECT3',
                imageid : 'MYTESTJPGIMAGE6',
            });

            await imagestore.deleteUser({
                classid : 'MYTESTCLASS',
                userid : 'MYTESTUSER',
            });

            try {
                await imagestore.getImage({
                    classid : 'MYTESTCLASS',
                    userid : 'MYTESTUSER',
                    projectid : 'MYTESTPROJECT3',
                    imageid : 'MYTESTJPGIMAGE6',
                });
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.equal(err.message, 'The specified key does not exist.');
                assert.equal(err.code, 'NoSuchKey');
                assert.equal(err.statusCode, 404);
            }
        });

        it('delete unknown users', async () => {
            await imagestore.deleteUser({
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
                            imageid : 'ATESTPNGIMAGE' + img,
                        };
                        const image = new Buffer(randomstring.generate({ length : 100 }));
                        const imageType = 'image/png';

                        await imagestore.storeImage(spec, imageType, image);
                    }
                }
            }

            await imagestore.getImage({
                classid : 'ATESTCLASS',
                userid : 'ATESTUSER11',
                projectid : 'ATESTPROJECT3',
                imageid : 'ATESTPNGIMAGE6',
            });

            await imagestore.deleteClass({
                classid : 'ATESTCLASS',
            });

            try {
                await imagestore.getImage({
                    classid : 'ATESTCLASS',
                    userid : 'ATESTUSER11',
                    projectid : 'ATESTPROJECT3',
                    imageid : 'ATESTPNGIMAGE6',
                });
                assert.fail('should not reach here');
            }
            catch (err) {
                assert.equal(err.message, 'The specified key does not exist.');
                assert.equal(err.code, 'NoSuchKey');
                assert.equal(err.statusCode, 404);
            }
        });

        it('delete unknown classes', async () => {
            await imagestore.deleteClass({
                classid : 'SOMEVERYUNKNOWNTESTCLASS',
            });
        });
    });

});
