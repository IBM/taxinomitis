/*eslint-env mocha */

import * as uuid from 'uuid/v1';
import * as assert from 'assert';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as request from 'request-promise';
import * as clone from 'clone';
import * as csvWriter from 'csv-write-stream';

import * as store from '../../lib/db/store';
import * as nlc from '../../lib/training/nlc';
import * as TrainingTypes from '../../lib/training/training-types';

import * as mockstore from './mockstore';



describe('Training - NLC', () => {

    let getStub;
    let createStub;
    let authStoreStub;
    let countStoreStub;
    let getStoreStub;
    let storeStoreSub;


    before(() => {
        getStub = sinon.stub(request, 'get').callsFake(mockNLC.getClassifier);
        createStub = sinon.stub(request, 'post').callsFake(mockNLC.createClassifier);

        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        countStoreStub = sinon.stub(store, 'countTextTraining').callsFake(mockstore.countTextTraining);
        getStoreStub = sinon.stub(store, 'getTextTraining').callsFake(mockstore.getTextTraining);
        storeStoreSub = sinon.stub(store, 'storeNLCClassifier').callsFake(mockstore.storeNLCClassifier);
    });
    after(() => {
        getStub.restore();
        createStub.restore();
        authStoreStub.restore();
        countStoreStub.restore();
        getStoreStub.restore();
        storeStoreSub.restore();
    });




    describe('create classifier', () => {

        it('should create a classifier', async () => {
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
                url : 'http://nlc.service/api/classifiers/mynewclassifier',
                name : projectname,
                language : 'en',
                created : newClassifierDate,
            });
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
                case 'http://nlc.service/api/classifiers/good':
                    return resolve(goodClassifierStatus);
                case 'http://nlc.service/api/classifiers/bad':
                    return resolve(brokenClassifierStatus);
                case 'http://nlc.service/api/classifiers/stillgoing':
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
                            url : 'http://nlc.service/api/classifiers/mynewclassifier',
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
        url : 'http://nlc.service/api/classifiers/good',
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
        url : 'http://nlc.service/api/classifiers/bad',
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
        url : 'http://nlc.service/api/classifiers/stillgoing',
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
        url : 'http://nlc.service/api/classifiers/deleted',
    };
    const unknownClassifierWithStatus: TrainingTypes.NLCClassifier = Object.assign({}, unknownClassifier, {
        status : 'Non Existent',
        statusDescription : 'Classifier not found',
    });

});
