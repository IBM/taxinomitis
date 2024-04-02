const request = require('request-promise');
const assert = require('assert');
const uuid = require('uuid').v4;
const fs = require('fs');
const { DOMParser } = require('xmldom');


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
                            model : API + '/saved-models/' + key + '/download/model.json',
                            viz : API + '/saved-models/' + key + '/download/dtreeviz-tree-0.svg',
                        },
                    });
                    return waitForModel(resp.urls.status);
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
                            model : API + '/saved-models/' + key + '/download/model.json',
                            viz : API + '/saved-models/' + key + '/download/dtreeviz-tree-0.svg',
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
                    return request.get(modelUrl, { json: true });
                })
                .then((resp) => {
                    return Object.keys(resp.signature.inputs)
                        .map((inputval) => { return inputval.split(':')[0]; });
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
            return Promise.all([run(PHISHING), run(POKEMON), run(TITANIC)])
                .then(([phishingvals, pokemonvals, titanicvals]) => {
                    assert(phishingvals.includes('domain_age'));
                    assert(pokemonvals.includes('capture_rate'));
                    assert(titanicvals.includes('ticket_fare'));
                });
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
            let vizUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    vizUrl = resp.urls.viz;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(vizUrl);
                })
                .then((resp) => {
                    xmlParser.parseFromString(resp, 'text/xml');
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
            let vizUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    vizUrl = resp.urls.viz;
                    return waitForModel(resp.urls.status);
                })
                .then(() => {
                    return request.get(vizUrl);
                })
                .then((resp) => {
                    xmlParser.parseFromString(resp, 'text/xml');
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
            let modelUrl;

            return request.post(NEW_MODEL_API + key, trainingRequest)
                .then((resp) => {
                    modelUrl = resp.urls.model;
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
                    return request.get(modelUrl, { json: true });
                })
                .then((resp) => {
                    assert.strictEqual('graph-model', resp.format);
                    const inputs = Object.keys(resp.signature.inputs)
                        .map((inputval) => { return inputval.split(':')[0]; });
                    assert(inputs.includes('embarked'));
                    assert(inputs.includes('ticket_class'));
                    assert(inputs.includes('gender'));
                    assert(inputs.includes('ticket_fare'));
                    assert(inputs.includes('sibl__sp_'));
                    assert(inputs.includes('age'));
                    assert(inputs.includes('par__ch_'));
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
                    return request.get(modelUrl, { json: true });
                })
                .then((resp) => {
                    assert.strictEqual('graph-model', resp.format);
                    const inputs = Object.keys(resp.signature.inputs)
                        .map((inputval) => { return inputval.split(':')[0]; });
                    assert(inputs.includes('domain_reg'));
                    assert(inputs.includes('includes__'));
                    assert(inputs.includes('redirects'));
                    assert(inputs.includes('domain_age'));
                    assert(inputs.includes('address_type'));
                    assert(inputs.includes('port_number'));
                    assert(inputs.includes('url_length'));
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
                    return request.get(modelUrl, { json: true });
                })
                .then((resp) => {
                    assert.strictEqual('graph-model', resp.format);
                    const inputs = Object.keys(resp.signature.inputs)
                        .map((inputval) => { return inputval.split(':')[0]; });
                    assert(inputs.includes('defense'));
                    assert(inputs.includes('speed'));
                    assert(inputs.includes('capture_rate'));
                    assert(inputs.includes('weight'));
                    assert(inputs.includes('attack'));
                    assert(inputs.includes('height'));
                    assert(inputs.includes('hp'));
                });
        });
    });
});
