const request = require('request-promise');
const assert = require('assert');
const uuid = require('uuid').v4;
const fs = require('fs');
const { DOMParser } = require('xmldom');
let ydf;
require('ydf-inference')()
    .then((mod) => {
        ydf = mod;
    });


const API = 'http://127.0.0.1:8000';
const NEW_MODEL_API = API + '/model-requests/';

const DEFAULT_REQUEST = {
    json: true,
    gzip: true
};

const DEV_CREDENTIALS = {
    auth : {
        user : 'testuser',
        pass : 'testpass',
    }
};

const TITANIC  = './data/titanic.csv';
const POKEMON  = './data/pokemon.csv';
const PHISHING = './data/phishing.csv';
const INVALID = './package.json';


const xmlParser = new DOMParser();



describe('verify new number service API', () => {

    function newScratchKey() {
        return uuid() + uuid();
    }
    function pause() {
        return new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }
    function waitForModel(statusUrl) {
        return pause()
            .then(() => {
                return request.get(statusUrl, { ...DEFAULT_REQUEST });
            })
            .then((resp) => {
                if (resp.status === 'Training') {
                    return waitForModel(statusUrl);
                }
                else {
                    return resp;
                }
            })
            .catch(() => {
                return waitForModel(statusUrl);
            });
    }

    describe('healthcheck', () => {

        it('should have an unauthenticated healthcheck API', () => {
            return request(API, DEFAULT_REQUEST)
                .then((resp) => {
                    assert.deepStrictEqual({ ok : true }, resp);
                });
        });

    });


    describe('new model request', () => {

        it('should require credentials', () => {
            const key = newScratchKey();
            const trainingRequest = { ...DEFAULT_REQUEST,
                formData : {
                    csvfile : fs.createReadStream(TITANIC)
                },
            };
            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then(() => {
                    assert.fail('should not have accepted the request');
                })
                .catch((err) => {
                    assert.strictEqual(err.statusCode, 401);
                    assert.deepStrictEqual(err.response.body, { detail : 'Not authenticated' });
                });
        });


        it('should require form data', () => {
            const key = newScratchKey();
            const trainingRequest = { ...DEFAULT_REQUEST, ...DEV_CREDENTIALS };
            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then(() => {
                    assert.fail('should not have accepted the request');
                })
                .catch((err) => {
                    assert.strictEqual(err.statusCode, 422);
                    assert.strictEqual(err.response.body.detail[0].msg, 'Field required');
                    assert.strictEqual(err.response.body.detail[0].type, 'missing');
                });
        });


        it('should require a CSV file', () => {
            const key = newScratchKey();
            const trainingRequest = { ...DEFAULT_REQUEST, ...DEV_CREDENTIALS, formData : { placeholder : 'hello' } };
            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then(() => {
                    assert.fail('should not have accepted the request');
                })
                .catch((err) => {
                    assert.strictEqual(err.statusCode, 422);
                    assert.strictEqual(err.response.body.detail[0].msg, 'Field required');
                    assert.strictEqual(err.response.body.detail[0].type, 'missing');
                });
        });

        it('should accept training using titanic data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(TITANIC)
                },
            };
            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    assert.strictEqual(typeof (new Date(resp.lastupdate)).getSeconds(), 'number');
                    delete resp.lastupdate;
                    assert.deepStrictEqual(resp, {
                        key,
                        status : 'Training',
                        urls : {
                            status : API + '/saved-models/' + key + '/status',
                            model : API + '/saved-models/' + key + '/download/model.zip',
                            tree : API + '/saved-models/' + key + '/download/tree.svg',
                            dot : API + '/saved-models/' + key + '/download/tree.dot',
                            vocab : API + '/saved-models/' + key + '/download/vocab.json',
                        },
                    });
                    return waitForModel(resp.urls.status);
                });
        });


        it('should accept re-training requests for a previous model project', () => {
            const key = newScratchKey();
            return request.post(NEW_MODEL_API + key, {
                    ...DEFAULT_REQUEST,
                    ...DEV_CREDENTIALS,
                    formData : {
                        csvfile : fs.createReadStream(TITANIC)
                    },
                })
                .then((resp) => {
                    return waitForModel(resp.urls.status);
                })
                .then((resp) => {
                    assert.strictEqual(resp.status, 'Available');
                    return request.post(NEW_MODEL_API + key, {
                        ...DEFAULT_REQUEST,
                        ...DEV_CREDENTIALS,
                        formData : {
                            csvfile : fs.createReadStream(TITANIC)
                        },
                    });
                })
                .then((resp) => {
                    return waitForModel(resp.urls.status);
                })
                .then((resp) => {
                    assert.strictEqual(resp.status, 'Available');
                });
        });

        it('should be possible to submit requests without a file', () => {
            const key = newScratchKey();
            const csvData = fs.readFileSync(PHISHING, { encoding: 'utf-8' });
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : {
                        value : csvData,
                        options : {
                            filename : 'training.csv',
                            contentType : 'text/csv'
                        }
                    }
                },
            };
            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    assert.strictEqual(typeof (new Date(resp.lastupdate)).getSeconds(), 'number');
                    delete resp.lastupdate;
                    assert.deepStrictEqual(resp, {
                        key,
                        status : 'Training',
                        urls : {
                            status : API + '/saved-models/' + key + '/status',
                            model : API + '/saved-models/' + key + '/download/model.zip',
                            tree : API + '/saved-models/' + key + '/download/tree.svg',
                            dot : API + '/saved-models/' + key + '/download/tree.dot',
                            vocab : API + '/saved-models/' + key + '/download/vocab.json',
                        }
                    });
                    return waitForModel(resp.urls.status);
                });
        });
    });



    describe('get model status', () => {

        it('should set status to error for invalid CSV files', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(INVALID)
                },
            };
            let statusUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    statusUrl = resp.urls.status;
                    return waitForModel(statusUrl);
                })
                .then(() => {
                    return request.get(statusUrl, { ...DEFAULT_REQUEST, ...DEV_CREDENTIALS });
                })
                .then((resp) => {
                    assert.strictEqual(resp.status, 'Failed');
                    assert(resp.error.message);
                    assert(resp.error.stack);
                    assert(resp.error.stack.startsWith('Traceback (most recent call'));
                });
        });

        function run(csv) {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(csv)
                },
            };
            let statusUrl;
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    statusUrl = resp.urls.status;
                    modelUrl = resp.urls.model;
                    return waitForModel(statusUrl);
                })
                .then(() => {
                    return request.get(statusUrl, { ...DEFAULT_REQUEST, ...DEV_CREDENTIALS });
                })
                .then((resp) => {
                    if (resp.status !== 'Available') {
                        console.trace(resp);
                    }
                    assert.strictEqual(resp.status, 'Available');
                    return request.get(modelUrl, { encoding : null });
                })
                .then((resp) => {
                    return ydf.loadModelFromZipBlob(resp);
                })
                .then((model) => {
                    return model.unload();
                });
        }

        it('should set the status to ready for valid models', () => {
            return run(PHISHING)
                .then(() => {
                    return run(POKEMON);
                })
                .then(() => {
                    return run(TITANIC);
                });
        });

        it('should handle running multiple models at once', () => {
            return Promise.all([run(PHISHING), run(POKEMON), run(TITANIC)]);
        });
    });



    describe('get visualisation', () => {

        it('should create an SVG visualisation of titanic data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(TITANIC)
                },
            };
            let treeUrl, dotUrl, vocabUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    treeUrl = resp.urls.tree;
                    dotUrl = resp.urls.dot;
                    vocabUrl = resp.urls.vocab;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(treeUrl);
                })
                .then((resp) => {
                    xmlParser.parseFromString(resp, 'text/xml');

                    return request.get(dotUrl);
                })
                .then((resp) => {
                    assert(resp.startsWith('digraph Tree {'));

                    return request.get(vocabUrl, { json : true });
                })
                .then((resp) => {
                    assert.deepStrictEqual(resp, [
                        "ticket class",
                        "gender=female",
                        "age",
                        "sibl. sp.",
                        "par. ch.",
                        "ticket fare",
                        "embarked=Cherbourg",
                        "gender=male",
                        "embarked=Queenstwn",
                        "embarked=Southampt",
                    ]);
                });
        });

        it('should create a visualisation for pokemon data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(POKEMON)
                },
            };
            let treeUrl, dotUrl, vocabUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    treeUrl = resp.urls.tree;
                    dotUrl = resp.urls.dot;
                    vocabUrl = resp.urls.vocab;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(treeUrl);
                })
                .then((resp) => {
                    xmlParser.parseFromString(resp, 'text/xml');

                    return request.get(dotUrl);
                })
                .then((resp) => {
                    assert(resp.startsWith('digraph Tree {'));

                    return request.get(vocabUrl, { json : true });
                })
                .then((resp) => {
                    assert.deepStrictEqual(resp, [
                        'height',
                        'weight',
                        'attack',
                        'defense',
                        'speed',
                        'hp',
                        'capture rate'
                    ]);
                });
        });
    });



    describe('model metadata', () => {

        it('should return metadata about titanic data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(TITANIC)
                },
            };
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    modelUrl = resp.urls.model;
                    return waitForModel(resp.urls.status);
                })
                .then((modelinfo) => {
                    assert.deepStrictEqual(modelinfo.labels, [ 'died', 'survived' ]);
                    assert.deepStrictEqual(modelinfo.features, {
                        "ticket class": {
                            "type": "int64",
                            "name": "ticket_class"
                        },
                        "gender": {
                            "type": "object",
                            "name": "gender"
                        },
                        "age": {
                            "type": "float64",
                            "name": "age"
                        },
                        "sibl. sp.": {
                            "type": "int64",
                            "name": "sibl__sp_"
                        },
                        "par. ch.": {
                            "type": "int64",
                            "name": "par__ch_"
                        },
                        "ticket fare": {
                            "type": "float64",
                            "name": "ticket_fare"
                        },
                        "embarked": {
                            "type": "object",
                            "name": "embarked"
                        },
                        "mlforkids_outcome_label": {
                            "type": "object",
                            "name": "mlforkids_outcome_label"
                        }
                    });
                });
        });

        it('should download a model from phishing data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(PHISHING)
                },
            };

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    return waitForModel(resp.urls.status);
                })
                .then((modelinfo) => {
                    assert.deepStrictEqual(modelinfo.labels, [ 'phishing', 'safe' ]);
                    assert.deepStrictEqual(modelinfo.features, {
                        "address type": {
                            "type": "object",
                            "name": "address_type"
                        },
                        "url length": {
                            "type": "object",
                            "name": "url_length"
                        },
                        "shortening": {
                            "type": "object",
                            "name": "shortening"
                        },
                        "includes @": {
                            "type": "object",
                            "name": "includes__"
                        },
                        "port number": {
                            "type": "object",
                            "name": "port_number"
                        },
                        "domain age": {
                            "type": "object",
                            "name": "domain_age"
                        },
                        "redirects": {
                            "type": "object",
                            "name": "redirects"
                        },
                        "domain reg": {
                            "type": "object",
                            "name": "domain_reg"
                        },
                        "mlforkids_outcome_label": {
                            "type": "object",
                            "name": "mlforkids_outcome_label"
                        }
                    });
                });
        });

        it('should download a model from pokemon data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(POKEMON)
                },
            };
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    modelUrl = resp.urls.model;
                    return waitForModel(resp.urls.status);
                })
                .then((modelinfo) => {
                    assert.deepStrictEqual(modelinfo.labels, [ 'water', 'fairy', 'rock', 'fire', 'electric', 'steel' ]);
                    assert.deepStrictEqual(modelinfo.features, {
                        "height": {
                            "type": "float64",
                            "name": "height"
                        },
                        "weight": {
                            "type": "float64",
                            "name": "weight"
                        },
                        "attack": {
                            "type": "int64",
                            "name": "attack"
                        },
                        "defense": {
                            "type": "int64",
                            "name": "defense"
                        },
                        "speed": {
                            "type": "int64",
                            "name": "speed"
                        },
                        "hp": {
                            "type": "int64",
                            "name": "hp"
                        },
                        "capture rate": {
                            "type": "int64",
                            "name": "capture_rate"
                        },
                        "mlforkids_outcome_label": {
                            "type": "object",
                            "name": "mlforkids_outcome_label"
                        }
                    });
                });
        });

    });



    describe('download model', () => {

        it('should download a model from titanic data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(TITANIC)
                },
            };
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    modelUrl = resp.urls.model;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(modelUrl, { encoding : null });
                })
                .then((resp) => {
                    return ydf.loadModelFromZipBlob(resp);
                })
                .then((model) => {
                    assert.deepStrictEqual(model.inputFeatures, [
                        { name : 'ticket_class', type : 'NUMERICAL',   internalIdx : 0, specIdx : 1 },
                        { name : 'gender',       type : 'CATEGORICAL', internalIdx : 1, specIdx : 2 },
                        { name : 'age',          type : 'NUMERICAL',   internalIdx : 2, specIdx : 3 },
                        { name : 'sibl__sp_',    type : 'NUMERICAL',   internalIdx : 3, specIdx : 4 },
                        { name : 'par__ch_',     type : 'NUMERICAL',   internalIdx : 4, specIdx : 5 },
                        { name : 'ticket_fare',  type : 'NUMERICAL',   internalIdx : 5, specIdx : 6 },
                        { name : 'embarked',     type : 'CATEGORICAL', internalIdx : 6, specIdx : 7 },
                    ]);
                    assert.deepStrictEqual(model.labelClasses, [ '0', '1' ]);

                    const survivedConfidence = model.predict({
                        ticket_class : [1,        3],
                        gender :       ['female', 'male'],
                        age :          [17,       30],
                        sibl__sp_ :    [3,        0],
                        par__ch_ :     [2,        0],
                        ticket_fare :  [400,      15],
                        embarked :     ['Cherbourg','Cherbourg']
                    });
                    assert(survivedConfidence[0] > 0.9);
                    assert(survivedConfidence[1] < 0.15)

                    model.unload();
                });
        });

        it('should download a model from phishing data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(PHISHING)
                },
            };
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    modelUrl = resp.urls.model;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(modelUrl, { encoding : null });
                })
                .then((resp) => {
                    return ydf.loadModelFromZipBlob(resp);
                })
                .then((model) => {
                    assert.deepStrictEqual(model.inputFeatures, [
                        { name : 'address_type', type : 'CATEGORICAL', internalIdx : 0, specIdx : 1 },
                        { name : 'url_length',   type : 'CATEGORICAL', internalIdx : 1, specIdx : 2 },
                        { name : 'shortening',   type : 'CATEGORICAL', internalIdx : 2, specIdx : 3 },
                        { name : 'includes__',   type : 'CATEGORICAL', internalIdx : 3, specIdx : 4 },
                        { name : 'port_number',  type : 'CATEGORICAL', internalIdx : 4, specIdx : 5 },
                        { name : 'domain_age',   type : 'CATEGORICAL', internalIdx : 5, specIdx : 6 },
                        { name : 'redirects',    type : 'CATEGORICAL', internalIdx : 6, specIdx : 7 },
                        { name : 'domain_reg',   type : 'CATEGORICAL', internalIdx : 7, specIdx : 8 },
                    ]);
                    assert.deepStrictEqual(model.labelClasses, [ '0', '1' ]);

                    const safeConfidence = model.predict({
                        'address_type' : ['IP addr',   'DNS name'],
                        'url_length'   : ['>75 chars', '<54 chars'],
                        'shortening'   : ['no',        'no'],
                        'includes__'   : ['yes',       'no'],
                        'port_number'  : ['non-std',   'standard'],
                        'domain_age'   : ['< 6 month', 'older'],
                        'redirects'    : ['> 4',       '<= 4'],
                        'domain_reg'   : ['not',       'not']
                    });
                    assert(safeConfidence[0] < 0.01);
                    assert(safeConfidence[1] > 0.9)

                    model.unload();
                });
        });

        it('should download a model from pokemon data', () => {
            const key = newScratchKey();
            const trainingRequest = {
                ...DEFAULT_REQUEST,
                ...DEV_CREDENTIALS,
                formData : {
                    csvfile : fs.createReadStream(POKEMON)
                },
            };
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    modelUrl = resp.urls.model;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(modelUrl, { encoding : null });
                })
                .then((resp) => {
                    return ydf.loadModelFromZipBlob(resp);
                })
                .then((model) => {
                    assert.deepStrictEqual(model.inputFeatures, [
                        { name : 'height',       type : 'NUMERICAL', internalIdx : 0, specIdx : 1 },
                        { name : 'weight',       type : 'NUMERICAL', internalIdx : 1, specIdx : 2 },
                        { name : 'attack',       type : 'NUMERICAL', internalIdx : 2, specIdx : 3 },
                        { name : 'defense',      type : 'NUMERICAL', internalIdx : 3, specIdx : 4 },
                        { name : 'speed',        type : 'NUMERICAL', internalIdx : 4, specIdx : 5 },
                        { name : 'hp',           type : 'NUMERICAL', internalIdx : 5, specIdx : 6 },
                        { name : 'capture_rate', type : 'NUMERICAL', internalIdx : 6, specIdx : 7 },
                    ]);
                    assert.deepStrictEqual(model.labelClasses, [ '0', '1', '2', '3', '4', '5' ]);

                    const pokemonConfidence = model.predict({
                        defense      : [ 40 ],
                        speed        : [ 90 ],
                        capture_rate : [ 190 ],
                        weight       : [ 6 ],
                        attack       : [ 55 ],
                        height       : [ 0.4 ],
                        hp           : [ 35 ]
                    });
                    assert(pokemonConfidence[0] > 0.5);
                    assert(pokemonConfidence[1] < 0.12);
                    assert(pokemonConfidence[2] < 0.12);
                    assert(pokemonConfidence[3] < 0.12);
                    assert(pokemonConfidence[4] < 0.12);
                    assert(pokemonConfidence[5] < 0.12);

                    model.unload();
                });
        });
    });
});
