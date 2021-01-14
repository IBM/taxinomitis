/*eslint-env mocha */
import * as assert from 'assert';
import * as request from 'supertest';
import * as httpstatus from 'http-status';
import * as express from 'express';
import testapiserver from './testserver';


let testServer: express.Express;


describe('REST API - pretrained TensorFlow model support', () => {

    before(() => {
        testServer = testapiserver();
    });

    const SAMPLE_SCRATCH_EXTENSION_URL = '/api/scratch' +
        '/%7B%22modelurl%22%3A%22https%3A%2F%2Fteachablemachine.withgoogle.com%2Fmodels%2FZvFOSdrzb%2F%22%2C%22modeltypeid%22%3A10%7D' +
        '/extensiontfjs.js';

    it('should generate extension urls', () => {
        return request(testServer)
            .post('/api/scratchtfjs/extensions')
            .send({ modelurl : 'https://teachablemachine.withgoogle.com/models/ZvFOSdrzb/', modeltype : 'teachablemachineimage' })
            .expect('Content-Type', /json/)
            .expect(httpstatus.OK)
            .then((resp) => {
                assert.deepStrictEqual(resp.body, {
                    url : SAMPLE_SCRATCH_EXTENSION_URL,
                });
            });
    });

    it('should accept model.json urls', () => {
        return request(testServer)
            .post('/api/scratchtfjs/extensions')
            .send({ modelurl : 'https://teachablemachine.withgoogle.com/models/ZvFOSdrzb/model.json', modeltype : 'graphdefimage' })
            .expect('Content-Type', /json/)
            .expect(httpstatus.OK)
            .then((resp) => {
                assert.deepStrictEqual(resp.body, {
                    url : '/api/scratch/%7B%22modelurl%22%3A%22https%3A%2F%2Fteachablemachine.withgoogle.com%2Fmodels%2FZvFOSdrzb%2Fmodel.json%22%2C%22modeltypeid%22%3A11%7D/extensiontfjs.js',
                });
            });
    });

    it('should require a contactable model host', () => {
        return request(testServer)
            .post('/api/scratchtfjs/extensions')
            .send({ modelurl : 'https://external.model.host/mymodel', modeltype : 'teachablemachinepose' })
            .expect('Content-Type', /json/)
            .expect(httpstatus.INTERNAL_SERVER_ERROR)
            .then((resp) => {
                assert.deepStrictEqual(resp.body, {
                    error : 'Error: getaddrinfo ENOTFOUND external.model.host',
                });
            });
    });

    it('should require a web address', () => {
        return request(testServer)
            .post('/api/scratchtfjs/extensions')
            .send({ modelurl : 'not a web address', modeltype : 'teachablemachinepose' })
            .expect('Content-Type', /json/)
            .expect(httpstatus.INTERNAL_SERVER_ERROR)
            .then((resp) => {
                assert.deepStrictEqual(resp.body, {
                    error : 'Unexpected model info',
                });
            });
    });

    it('should dynamically generate a Scratch extension for a Teachable Machine model page', () => {
        return request(testServer)
            .get(SAMPLE_SCRATCH_EXTENSION_URL)
            .expect(httpstatus.OK)
            .then((resp) => {
                const body: string = resp.text;

                assert(body.startsWith('class MachineLearningTfjs {'));
                assert(body.includes('items : [  \'tennant\',  \'smith\',  \'none\',  ],'));
                assert(body.includes('name: \'tm-my-image-model\','));
                assert(body.includes('Scratch.extensions.register(new MachineLearningTfjs());'));
            });
    });

    it('should dynamically generate a Scratch extension for a Teachable Machine model.json file', () => {
        return request(testServer)
            .get('/api/scratch/%7B%22modelurl%22%3A%22https%3A%2F%2Fteachablemachine.withgoogle.com%2Fmodels%2FZvFOSdrzb%2Fmodel.json%22%2C%22modeltypeid%22%3A11%7D/extensiontfjs.js')
            .expect(httpstatus.OK)
            .then((resp) => {
                const body: string = resp.text;

                assert(body.startsWith('class MachineLearningTfjs {'));
                assert(body.includes('items : [  \'tennant\',  \'smith\',  \'none\',  ],'));
                assert(body.includes('name: \'tm-my-image-model\','));
                assert(body.includes('Scratch.extensions.register(new MachineLearningTfjs());'));
            });
    });
});
