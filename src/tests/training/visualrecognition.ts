/*eslint-env mocha */

/* eslint no-unused-vars: 0 */

// tslint:disable:max-line-length

import * as uuid from 'uuid/v1';
import * as fs from 'fs';
import * as assert from 'assert';
import * as httpstatus from 'http-status';
import * as sinon from 'sinon';
import * as request from 'request-promise';
import * as clone from 'clone';
import * as randomstring from 'randomstring';

import * as store from '../../lib/db/store';
import * as visrec from '../../lib/training/visualrecognition';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as downloadAndZip from '../../lib/utils/downloadAndZip';

import * as mockstore from './mockstore';



describe('Training - Visual Recognition', () => {

    let getStub: sinon.SinonStub;
    let createStub: sinon.SinonStub;
    let deleteStub: sinon.SinonStub;
    let getProjectStub: sinon.SinonStub;
    let authStoreStub: sinon.SinonStub;
    let authByIdStoreStub: sinon.SinonStub;
    let countStoreStub: sinon.SinonStub;
    let getImageClassifiers: sinon.SinonStub;
    let getStoreStub: sinon.SinonStub;
    let storeStoreStub: sinon.SinonStub;
    let deleteStoreStub: sinon.SinonStub;
    let storeScratchKeyStub: sinon.SinonStub;
    let resetExpiredScratchKeyStub: sinon.SinonStub;
    let getClassStub: sinon.SinonStub;

    let downloadStub: sinon.SinonStub;


    before(() => {
        getStub = sinon.stub(request, 'get');
        getStub.withArgs(sinon.match(/.*classifiers.*/), sinon.match.any).callsFake(mockVisRec.getClassifier);
        getStub.withArgs(sinon.match(/.*classify/), sinon.match.any).callsFake(mockVisRec.testClassify);
        createStub = sinon.stub(request, 'post');
        createStub.withArgs(sinon.match(/.*classifiers/), sinon.match.any).callsFake(mockVisRec.createClassifier);
        createStub.withArgs(sinon.match(/.*classify/), sinon.match.any).callsFake(mockVisRec.testClassify);
        deleteStub = sinon.stub(request, 'delete').callsFake(mockVisRec.deleteClassifier);

        getProjectStub = sinon.stub(store, 'getProject').callsFake(mockstore.getProject);
        authStoreStub = sinon.stub(store, 'getBluemixCredentials').callsFake(mockstore.getBluemixCredentials);
        authByIdStoreStub = sinon.stub(store, 'getBluemixCredentialsById').callsFake(mockstore.getBluemixCredentialsById);
        getImageClassifiers = sinon.stub(store, 'getImageClassifiers').callsFake(mockstore.getImageClassifiers);
        countStoreStub = sinon.stub(store, 'countTrainingByLabel').callsFake(mockstore.countTrainingByLabel);
        getStoreStub = sinon.stub(store, 'getImageTrainingByLabel').callsFake(mockstore.getImageTrainingByLabel);
        storeStoreStub = sinon.stub(store, 'storeImageClassifier').callsFake(mockstore.storeImageClassifier);
        deleteStoreStub = sinon.stub(store, 'deleteImageClassifier').callsFake(mockstore.deleteImageClassifier);
        storeScratchKeyStub = sinon.stub(store, 'storeOrUpdateScratchKey').callsFake(mockstore.storeOrUpdateScratchKey);
        resetExpiredScratchKeyStub = sinon.stub(store, 'resetExpiredScratchKey').callsFake(mockstore.resetExpiredScratchKey);
        getClassStub = sinon.stub(store, 'getClassTenant').callsFake(mockstore.getClassTenant);

        downloadStub = sinon.stub(downloadAndZip, 'run').callsFake(mockDownloadAndZip.run);
    });

    after(() => {
        getStub.restore();
        createStub.restore();
        deleteStub.restore();
        getProjectStub.restore();
        authStoreStub.restore();
        authByIdStoreStub.restore();
        getImageClassifiers.restore();
        countStoreStub.restore();
        getStoreStub.restore();
        storeStoreStub.restore();
        deleteStoreStub.restore();
        storeScratchKeyStub.restore();
        resetExpiredScratchKeyStub.restore();
        getClassStub.restore();

        downloadStub.restore();
    });



    describe('create classifier', () => {

        it('should create a classifier', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'bob';
            const projectid = 'projectbobvis';
            const projectname = 'Bob\'s images proj';

            const project: DbTypes.Project = {
                id : projectid,
                name : projectname,
                userid, classid,
                type : 'images',
                language : 'en',
                labels : ['rock', 'paper'],
                numfields : 0,
                isCrowdSourced : false,
            };

            const classifier = await visrec.trainClassifier(project);
            assert(classifier.id);

            assert.deepEqual(classifier, {
                id : classifier.id,
                name : projectname,
                classifierid : 'good',
                status : 'training',
                url : 'http://visual.recognition.service/v3/classifiers/good',
                credentialsid : '456',
                created : newClassifierDate,
                expiry : newExpiryDate,
            });

            assert(
                storeScratchKeyStub.calledWith(project, mockstore.credsForVisRec,
                    'good'));
        });

        it('should not try to create a classifier without enough training data', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'bob';
            const projectid = 'tinyvis';
            const projectname = 'Bob\'s small images proj';

            const project: DbTypes.Project = {
                id : projectid,
                name : projectname,
                userid, classid,
                language : 'en',
                type : 'images',
                labels : ['rock', 'paper'],
                numfields : 0,
                isCrowdSourced : false,
            };

            try {
                await visrec.trainClassifier(project);
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Not enough images to train the classifier');
            }

            assert.equal(storeScratchKeyStub.called, false);
        });

        it('should not try to create a classifier with too much training data', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'bob';
            const projectid = 'massivevis';
            const projectname = 'Bob\'s huge images proj';

            const project: DbTypes.Project = {
                id : projectid,
                name : projectname,
                userid, classid,
                language : 'en',
                type : 'images',
                labels : ['rock', 'paper'],
                numfields : 0,
                isCrowdSourced : false,
            };

            try {
                await visrec.trainClassifier(project);
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Number of images exceeds maximum (10000)');
            }

            assert.equal(storeScratchKeyStub.called, false);
        });

        it('should handle hitting limits on API keys', async () => {
            storeScratchKeyStub.reset();

            const classid = 'TESTTENANT';
            const userid = 'bob';
            const projectid = 'projectbobvislim';
            const projectname = 'Bob\'s other images proj';

            const project: DbTypes.Project = {
                id : projectid,
                name : projectname,
                userid, classid,
                type : 'images',
                language : 'en',
                labels : ['rock', 'paper'],
                numfields : 0,
                isCrowdSourced : false,
            };

            try {
                await visrec.trainClassifier(project);
                assert.fail(0, 1, 'should not have reached here', '');
            }
            catch (err) {
                assert.equal(err.message, 'Your class already has created their maximum allowed number of models');
            }

            assert.equal(storeScratchKeyStub.called, false);
        });
    });



    describe('test classifier', () => {

        it('should classify images by URL', async () => {
            const creds = mockstore.credsForVisRec;
            const classes = await visrec.testClassifierURL(creds, 'good', 'projectbobvis', 'http://test.com/image.jpg');
            assert.deepEqual(classes, [
                { class_name : 'rock', confidence : 65 },
                { class_name : 'paper', confidence : 13 },
            ]);
        });

        it('should classify images by file', async () => {
            const creds = mockstore.credsForVisRec;
            const classes = await visrec.testClassifierFile(creds, 'good', 'projectbobvis', '/tmp/image.jpg');
            assert.deepEqual(classes, [
                { class_name : 'rock', confidence : 75 },
                { class_name : 'paper', confidence : 3 },
            ]);
        });

    });



    describe('delete classifier', () => {

        it('should delete a classifier', async () => {
            deleteStub.reset();
            deleteStoreStub.reset();
            resetExpiredScratchKeyStub.reset();

            assert.equal(deleteStub.called, false);
            assert.equal(deleteStoreStub.called, false);

            await visrec.deleteClassifier(goodClassifier);

            assert(deleteStub.calledOnce);
            assert(deleteStoreStub.calledOnce);

            assert(deleteStub.calledWith('http://visual.recognition.service/v3/classifiers/good', {
                qs : { version : '2016-05-20', api_key : 'userpass' },
                headers : { 'user-agent' : 'machinelearningforkids' },
                timeout : 120000,
            }));
            assert(deleteStoreStub.calledWith(goodClassifier.id));
            assert(resetExpiredScratchKeyStub.called);
        });


        it('should handle deleting unknown classifiers', async () => {
            deleteStub.reset();
            deleteStoreStub.reset();
            resetExpiredScratchKeyStub.reset();

            assert.equal(deleteStub.called, false);
            assert.equal(deleteStoreStub.called, false);

            await visrec.deleteClassifier(unknownClassifier);

            assert(deleteStub.calledOnce);
            assert(deleteStoreStub.calledOnce);

            assert(deleteStub.calledWith('http://visual.recognition.service/v3/classifiers/unknown', {
                qs : { version : '2016-05-20', api_key : 'userpass' },
                headers : { 'user-agent' : 'machinelearningforkids' },
                timeout : 120000,
            }));
            assert(deleteStoreStub.calledWith(unknownClassifier.id));
            assert(resetExpiredScratchKeyStub.called);
        });

    });


    describe('get classifier info', () => {

        it('should get info for a ready classifier', async () => {
            const reqClone = clone([ goodClassifier ]);
            const one = await visrec.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(one, [ goodClassifierWithStatus ]);
        });

        it('should get info for unknown classifiers', async () => {
            const reqClone = clone([
                unknownClassifier,
                goodClassifier,
            ]);
            const three = await visrec.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(three, [
                unknownClassifierWithStatus,
                goodClassifierWithStatus,
            ]);
        });


    });



    const newClassifierDate = new Date();
    newClassifierDate.setMilliseconds(0);
    const newExpiryDate = new Date();
    newExpiryDate.setMilliseconds(0);
    newExpiryDate.setHours(newClassifierDate.getHours() + 3);

    const mockVisRec = {
        getClassifier : (url: string) => {
            return new Promise((resolve, reject) => {
                switch (url) {
                case 'http://visual.recognition.service/v3/classifiers/good':
                    return resolve(goodClassifierStatus);
                // case 'http://visual.recognition.service/v1/classifiers/bad':
                //     return resolve(brokenClassifierStatus);
                // case 'http://visual.recognition.service/v1/classifiers/stillgoing':
                //     return resolve(trainingClassifierStatus);
                default:
                    return reject({
                        error : 'Resource not found',
                    });
                }
            });
        },
        deleteClassifier : (url: string) => {
            return new Promise((resolve, reject) => {
                switch (url) {
                case 'http://visual.recognition.service/v3/classifiers/good':
                    return resolve();
                case 'http://visual.recognition.service/v3/classifiers/bad':
                    return resolve();
                case 'http://visual.recognition.service/v3/classifiers/stillgoing':
                    return resolve();
                default:
                    return reject({ error : 'Resource not found' });
                }
            });
        },
        testClassify : (url: string, opts: visrec.VisualRecogApiRequestPayloadTestFileItem | visrec.VisualRecogApiRequestPayloadTestUrlItem) => {
            assert.equal(url, 'http://visual.recognition.service/v3/classify');
            assert.equal(opts.qs.version, '2016-05-20');
            assert.equal(opts.qs.api_key, 'userpass');
            assert.equal(opts.headers['user-agent'], 'machinelearningforkids');

            const fileOptions = opts as visrec.VisualRecogApiRequestPayloadTestFileItem;
            const urlOptions = opts as visrec.VisualRecogApiRequestPayloadTestUrlItem;

            if (urlOptions.qs.classifier_ids === 'good' && urlOptions.qs.url) {
                assert.equal(urlOptions.qs.threshold, 0.0);
                assert(urlOptions.qs.url.startsWith('http'));

                return new Promise((resolve) => {
                    return resolve({
                        images : [
                            {
                                classifiers : [
                                    {
                                        classes : [
                                            { class : 'rock', score : 0.645656 },
                                            { class : 'paper', score : 0.132234 },
                                        ],
                                        classifier_id : 'good',
                                        name : 'Bob\'s images proj',
                                    },
                                ],
                                resolved_url : 'https://some-server.com/your-image.jpg',
                                source_url : urlOptions.qs.url,
                            },
                        ],
                        images_processed : 1,
                    });
                });
            }
            else if (fileOptions.formData.parameters.value === JSON.stringify({
                owners : [ 'me' ], classifier_ids : [ 'good' ], threshold : 0.0,
            }))
            {
                assert(fileOptions.formData.images_file);

                return new Promise((resolve) => {
                    return resolve({
                        images : [
                            {
                                classifiers : [
                                    {
                                        classes : [
                                            { class : 'rock', score : 0.745656 },
                                            { class : 'paper', score : 0.032234 },
                                        ],
                                        classifier_id : 'good',
                                        name : 'Bob\'s images proj',
                                    },
                                ],
                                image : 'your-image.jpg',
                            },
                        ],
                        images_processed : 1,
                    });
                });
            }
        },
        createClassifier : (url: string, options: visrec.VisualRecogApiRequestPayloadClassifierItem) => {
            if (options.formData.name === 'Bob\'s images proj') {
                assert.equal(options.qs.version, '2016-05-20');
                assert.equal(options.qs.api_key, 'userpass');
                assert.equal(options.json, true);
                assert.equal(options.formData.name, 'Bob\'s images proj');
                const rockStream: fs.ReadStream = options.formData.rock_positive_examples as fs.ReadStream;
                assert.equal(typeof rockStream.path, 'string');
                const paperStream: fs.ReadStream = options.formData.paper_positive_examples as fs.ReadStream;
                assert.equal(typeof paperStream.path, 'string');

                return new Promise((resolve, reject) => {
                    resolve({
                        classifier_id : 'good',
                        name : 'Bob\'s images proj',
                        owner : 'bob',
                        status : 'training',
                        created : newClassifierDate.toISOString(),
                        classes : [
                            { class : 'rock' },
                            { class : 'paper' },
                        ],
                    });
                });
            }
            else {
                return new Promise((resolve, reject) => {
                    const err = {
                        error : {
                            error : 'Cannot execute learning task. : this plan instance can have only 1 custom classifier(s), and 1 already exist.',
                        },
                        statusCode : 400,
                        status : 400,
                    };
                    reject(err);
                });
            }
        },
    };



    const goodClassifier: TrainingTypes.VisualClassifier = {
        id : uuid(),
        credentialsid : '456',
        name : 'good classifier',
        created : new Date(),
        expiry : new Date(),
        url : 'http://visual.recognition.service/v3/classifiers/good',
        classifierid : 'good',
    };
    const goodClassifierWithStatus = Object.assign({}, goodClassifier, {
        status : 'ready',
    });

    const goodClassifierStatus = {
        classifier_id : 'good',
        name : goodClassifier.name,
        owner : 'bob',
        status : 'ready',
        created : goodClassifier.created.toISOString(),
        classes : [
            { class : 'rock' },
            { class : 'paper' },
        ],
    };



    const unknownClassifier: TrainingTypes.VisualClassifier = {
        id : uuid(),
        credentialsid : '456',
        name : 'unknown classifier',
        created : new Date(),
        expiry : new Date(),
        url : 'http://visual.recognition.service/v3/classifiers/unknown',
        classifierid : 'unknown',
    };
    const unknownClassifierWithStatus = Object.assign({}, unknownClassifier, {
        status : 'Non Existent',
    });



    const mockDownloadAndZip = {
        run : (locations: downloadAndZip.ImageDownload[]) => {
            for (const location of locations) {
                if (location.type === 'download') {
                    assert.equal(typeof location.url, 'string');
                    assert(location.url.startsWith('http'));
                }
            }
            return Promise.resolve('/tmp/training.zip');
        },
    };

});
