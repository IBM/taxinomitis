/*eslint-env mocha */
import * as assert from 'assert';
import * as request from 'supertest';
import * as fs from 'fs';
import * as Express from 'express';
import * as httpstatus from 'http-status';
import * as unzip from 'unzipper';
import * as tmp from 'tmp';

import testapiserver from './testserver';



let testServer: Express.Express;



describe('REST API - App Inventor', () => {

    before(() => {
        testServer = testapiserver();
    });

    const binaryParser = (res: any, cb: any) => {
        res.setEncoding('binary');
        res.data = '';
        res.on('data', (chunk: any) => {
            res.data += chunk;
        });
        res.on('end', () => {
            cb(null, Buffer.from(res.data, 'binary'));
        });
    };


    it('should get a modified extension', (done) => {
        const apikey = 'This-is-an-API-key.Sort-of.';

        const zipfile = tmp.fileSync();
        const apifile = tmp.fileSync();

        request(testServer)
            .get('/api/appinventor/' + apikey + '/extension')
            .expect('Content-Disposition', 'attachment; filename=ml4k.aix;')
            .expect(httpstatus.OK)
            .buffer()
            .parse(binaryParser)
            .end((err, res) => {
                assert(!err);

                fs.writeFileSync(zipfile.name, res.body);

                fs.createReadStream(zipfile.name)
                    .pipe(unzip.Parse())
                    .on('entry', (entry) => {
                        if (entry.path === 'com.kylecorry.ml4k/assets/api.txt') {
                            entry.pipe(fs.createWriteStream(apifile.name))
                                .on('finish', () => {
                                    const contents = fs.readFileSync(apifile.name, 'utf8');
                                    assert.strictEqual(contents, apikey);
                                    done();
                                });
                        }
                        else {
                            entry.autodrain();
                        }
                    });
            });
    });

});
