/*eslint-env mocha */

import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as request from 'request-promise';
import * as clone from 'clone';
import * as csvWriter from 'csv-write-stream';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as nlc from '../../lib/training/nlc';
import * as TrainingTypes from '../../lib/training/training-types';

import * as mockstore from './mockstore';



describe('Training - NLC', () => {

    let getStub;
    let createStub;
    let deleteStub;
    let authStoreStub;
    let authByIdStoreStub;
    let countStoreStub;
    let getStoreStub;
    let storeStoreStub;
    let deleteStoreStub;
    let storeScratchKeyStub;


    before(() => {
        getStub = sinon.stub(request, 'get').callsFake(mockNLC.getClassifier);
        createStub = sinon.stub(request, 'post');
        createStub.withArgs(sinon.match(/.*classifiers/), sinon.match.any).callsFake(mockNLC.createClassifier);
        createStub.withArgs(sinon.match(/.*classify/), sinon.match.any).callsFake(mockNLC.testClassifier);
        deleteStub = sinon.stub(request, 'delete').callsFake(mockNLC.deleteClassifier);

        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        authByIdStoreStub = sinon.stub(store, 'getServiceCredentials').callsFake(mockstore.getServiceCredentials);
        countStoreStub = sinon.stub(store, 'countTextTraining').callsFake(mockstore.countTextTraining);
        getStoreStub = sinon.stub(store, 'getTextTraining').callsFake(mockstore.getTextTraining);
        storeStoreStub = sinon.stub(store, 'storeNLCClassifier').callsFake(mockstore.storeNLCClassifier);
        deleteStoreStub = sinon.stub(store, 'deleteNLCClassifier').callsFake(mockstore.deleteNLCClassifier);
        storeScratchKeyStub = sinon.stub(store, 'storeOrUpdateScratchKey').callsFake(mockstore.storeOrUpdateScratchKey);
    });
    after(() => {
        getStub.restore();
        createStub.restore();
        deleteStub.restore();
        authStoreStub.restore();
        authByIdStoreStub.restore();
        countStoreStub.restore();
        getStoreStub.restore();
        storeStoreStub.restore();
        deleteStoreStub.restore();
        storeScratchKeyStub.restore();
    });




    describe('create classifier', () => {

        it('should create a classifier', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'bob';
            const projectid = 'projectbob';
            const projectname = 'Bob\'s text project';

            const classifier: any = await nlc.trainClassifier(userid, classid, projectid, projectname);

            assert.deepEqual(classifier, {
                id : classifier.id,
                credentialsid : mockstore.creds.id,
                userid, projectid, classid,
                servicetype : 'nlc',
                classifierid : 'mynewclassifier',
                url : 'http://nlc.service/v1/classifiers/mynewclassifier',
                name : projectname,
                language : 'en',
                created : newClassifierDate,
            });

            assert(
                storeScratchKeyStub.calledWith(
                    projectid, sinon.match.any, userid, classid,
                    mockstore.creds,
                    'mynewclassifier'));
        });
    });


    describe('test classifier', () => {

        it('should return classes from NLC', async () => {
            const creds: TrainingTypes.BluemixCredentials = {
                id : '123',
                username : 'user',
                password : 'pass',
                servicetype : 'nlc',
                url : 'http://nlc.service',
            };
            const classes = await nlc.testClassifier(creds, 'good', 'Hello');
            assert.deepEqual(classes, [
                {
                    class_name : 'temperature',
                    confidence : 100,
                },
                {
                    class_name : 'conditions',
                    confidence : 0,
                },
            ]);
        });

    });


    describe('delete classifier', () => {

        it('should delete a classifier', async () => {
            deleteStub.reset();
            deleteStoreStub.reset();

            assert.equal(deleteStub.called, false);
            assert.equal(deleteStoreStub.called, false);

            const classid = randomstring.generate({ length : 10 });
            const userid = randomstring.generate({ length : 8 });
            const projectid = uuid();

            await nlc.deleteClassifier(userid, classid, projectid, 'good');

            assert(deleteStub.calledOnce);
            assert(deleteStoreStub.calledOnce);

            assert(deleteStub.calledWith('http://nlc.service/v1/classifiers/good', {
                auth : { user : 'user', pass : 'pass' },
            }));
            assert(deleteStoreStub.calledWith(projectid, userid, classid, 'good'));
        });

        it('should cope with deleting a classifier missing from NLC', async () => {
            deleteStub.reset();
            deleteStoreStub.reset();

            const missingErr: any = new Error();
            missingErr.statusCode = 404;

            deleteStub
                .withArgs('http://nlc.service/v1/classifiers/doesnotactuallyexist', sinon.match.any)
                .throws(missingErr);

            assert.equal(deleteStub.called, false);
            assert.equal(deleteStoreStub.called, false);

            const classid = randomstring.generate({ length : 10 });
            const userid = randomstring.generate({ length : 8 });
            const projectid = uuid();

            await nlc.deleteClassifier(userid, classid, projectid, 'doesnotactuallyexist');

            assert(deleteStub.calledOnce);
            assert(deleteStoreStub.calledOnce);

            assert(deleteStub.calledWith('http://nlc.service/v1/classifiers/doesnotactuallyexist', {
                auth : { user : 'user', pass : 'pass' },
            }));
            assert(deleteStoreStub.calledWith(projectid, userid, classid, 'doesnotactuallyexist'));
        });

    });



    describe('get classifier info', () => {

        it('should get info for a ready classifier', async () => {
            const reqClone = clone([ goodClassifier ]);
            const one = await nlc.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(one, [ goodClassifierWithStatus ]);
        });

        it('should get info for a broken classifier', async () => {
            const reqClone = clone([ brokenClassifier ]);
            const one = await nlc.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(one, [ brokenClassifierWithStatus ]);
        });

        it('should get info for multiple classifiers', async () => {
            const reqClone = clone([
                goodClassifier,
                brokenClassifier,
                trainingClassifier,
            ]);
            const three = await nlc.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(three, [
                goodClassifierWithStatus,
                brokenClassifierWithStatus,
                trainingClassifierWithStatus,
            ]);
        });

        it('should get info for no classifiers', async () => {
            const reqClone = [ ];
            const none = await nlc.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(none, []);
        });

        it('should get info for unknown classifiers', async () => {
            const reqClone = clone([
                brokenClassifier,
                unknownClassifier,
                trainingClassifier,
                goodClassifier,
            ]);
            const three = await nlc.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(three, [
                brokenClassifierWithStatus,
                unknownClassifierWithStatus,
                trainingClassifierWithStatus,
                goodClassifierWithStatus,
            ]);
        });

    });





    const newClassifierDate = new Date();

    const mockNLC = {
        getClassifier : (url) => {
            return new Promise((resolve, reject) => {
                switch (url) {
                case 'http://nlc.service/v1/classifiers/good':
                    return resolve(goodClassifierStatus);
                case 'http://nlc.service/v1/classifiers/bad':
                    return resolve(brokenClassifierStatus);
                case 'http://nlc.service/v1/classifiers/stillgoing':
                    return resolve(trainingClassifierStatus);
                default:
                    return reject({
                        error : {
                            description : 'Classifier not found',
                        },
                    });
                }
            });
        },
        testClassifier : (url, opts) => {
            return new Promise((resolve) => {
                resolve({
                    classifier_id : 'good',
                    url : 'http://nlc.service/v1/classifiers/good/classify',
                    text : opts.body.text,
                    top_class : 'temperature',
                    classes : [
                        {
                            class_name : 'temperature',
                            confidence : 0.9998201258549781,
                        },
                        {
                            class_name : 'conditions',
                            confidence : 0.00017987414502176904,
                        },
                    ],
                });
            });
        },
        deleteClassifier : (url) => {
            return new Promise((resolve, reject) => {
                switch (url) {
                case 'http://nlc.service/v1/classifiers/good':
                    return resolve();
                case 'http://nlc.service/v1/classifiers/bad':
                    return resolve();
                case 'http://nlc.service/v1/classifiers/stillgoing':
                    return resolve();
                default:
                    return reject({
                        statusCode : 404,
                    });
                }
            });
        },
        createClassifier : (url, options) => {
            return new Promise((resolve) => {
                const formData = JSON.parse(options.formData.training_metadata);

                let trainingData = '';
                const trainingFileStream = options.formData.training_data;
                trainingFileStream
                    .on('data', (chunk) => {
                        trainingData += chunk;
                    })
                    .on('end', () => {
                        const trainingDataLines = trainingData.split('\n');

                        let emptyLines = 0;
                        assert.equal(trainingDataLines.length, 348);
                        for (const trainingDataLine of trainingDataLines) {
                            if (trainingDataLine.length === 0) {
                                emptyLines += 1;
                            }
                            else {
                                const items = trainingDataLine.split(',');
                                assert.equal(items.length, 2);
                                assert.equal(items[0].indexOf('sample text'), 0);
                                assert.equal(items[1].indexOf('sample label'), 0);
                            }
                        }
                        assert.equal(emptyLines, 1);

                        resolve({
                            classifier_id : 'mynewclassifier',
                            name : formData.name,
                            language : formData.language,
                            created : newClassifierDate.toISOString(),
                            url : 'http://nlc.service/v1/classifiers/mynewclassifier',
                            status : 'Training',
                            status_description : 'Training is running',
                        });
                    });
            });
        },
    };


    const goodClassifier: TrainingTypes.NLCClassifier = {
        classifierid : 'good',
        created : new Date(),
        language : 'en',
        name : 'good classifier',
        url : 'http://nlc.service/v1/classifiers/good',
    };
    const goodClassifierWithStatus: TrainingTypes.NLCClassifier = Object.assign({}, goodClassifier, {
        status : 'Available',
        statusDescription : 'The classifier instance is now available and is ready to take classifier requests',
    });
    const goodClassifierStatus = {
        classifier_id : goodClassifier.classifierid,
        name : goodClassifier.name,
        language : goodClassifier.language,
        created : goodClassifier.created.toISOString(),
        url : goodClassifier.url,
        status : goodClassifierWithStatus.status,
        status_description : goodClassifierWithStatus.statusDescription,
    };

    const brokenClassifier: TrainingTypes.NLCClassifier = {
        classifierid : 'bad',
        created : new Date(),
        language : 'en',
        name : 'bad bad bad',
        url : 'http://nlc.service/v1/classifiers/bad',
    };
    const brokenClassifierWithStatus: TrainingTypes.NLCClassifier = Object.assign({}, brokenClassifier, {
        status : 'Failed',
        statusDescription : 'You done wrong',
    });
    const brokenClassifierStatus = {
        classifier_id : brokenClassifier.classifierid,
        name : brokenClassifier.name,
        language : brokenClassifier.language,
        created : brokenClassifier.created.toISOString(),
        url : brokenClassifier.url,
        status : brokenClassifierWithStatus.status,
        status_description : brokenClassifierWithStatus.statusDescription,
    };

    const trainingClassifier: TrainingTypes.NLCClassifier = {
        classifierid : 'stillgoing',
        created : new Date(),
        language : 'en',
        name : 'try again later',
        url : 'http://nlc.service/v1/classifiers/stillgoing',
    };
    const trainingClassifierWithStatus: TrainingTypes.NLCClassifier = Object.assign({}, trainingClassifier, {
        status : 'Training',
        statusDescription : 'It is still going... so much data',
    });
    const trainingClassifierStatus = {
        classifier_id : trainingClassifier.classifierid,
        name : trainingClassifier.name,
        language : trainingClassifier.language,
        created : trainingClassifier.created.toISOString(),
        url : trainingClassifier.url,
        status : trainingClassifierWithStatus.status,
        status_description : trainingClassifierWithStatus.statusDescription,
    };

    const unknownClassifier: TrainingTypes.NLCClassifier = {
        classifierid : 'deleted',
        created : new Date(),
        language : 'en',
        name : 'not here any more',
        url : 'http://nlc.service/v1/classifiers/deleted',
    };
    const unknownClassifierWithStatus: TrainingTypes.NLCClassifier = Object.assign({}, unknownClassifier, {
        status : 'Non Existent',
        statusDescription : 'Classifier not found',
    });

});
