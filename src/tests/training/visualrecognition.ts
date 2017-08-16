/*eslint-env mocha */

/* eslint no-unused-vars: 0 */

// tslint:disable:max-line-length

import * as uuid from 'uuid/v1';
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

    let getStub;
    let createStub;
    let deleteStub;
    let getProjectStub;
    let authStoreStub;
    let authByIdStoreStub;
    let countStoreStub;
    let getImageClassifiers;
    let getStoreStub;
    let storeStoreStub;
    let deleteStoreStub;
    let storeScratchKeyStub;
    let resetExpiredScratchKeyStub;
    let getClassStub;

    let downloadStub;


    before(() => {
        getStub = sinon.stub(request, 'get').callsFake(mockVisRec.getClassifier);
        createStub = sinon.stub(request, 'post');
        createStub.withArgs(sinon.match(/.*classifiers/), sinon.match.any).callsFake(mockVisRec.createClassifier);
        // createStub.withArgs(sinon.match(/.*message/), sinon.match.any).callsFake(mockVisRec.testClassifier);
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
                fields : [],
                labels : ['rock', 'paper'],
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
                type : 'images',
                fields : [],
                labels : ['rock', 'paper'],
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
                type : 'images',
                fields : [],
                labels : ['rock', 'paper'],
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

    });


    describe('get classifier info', () => {

        it('should get info for a ready classifier', async () => {
            const reqClone = clone([ goodClassifier ]);
            const one = await visrec.getClassifierStatuses('CLASSID', reqClone);

            assert.deepEqual(one, [ goodClassifierWithStatus ]);
        });


    });



    const newClassifierDate = new Date();
    newClassifierDate.setMilliseconds(0);
    const newExpiryDate = new Date();
    newExpiryDate.setMilliseconds(0);
    newExpiryDate.setHours(newClassifierDate.getHours() + 3);

    const mockVisRec = {
        getClassifier : (url) => {
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
        deleteClassifier : (url) => {
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
        createClassifier : (url, options) => {
            assert.equal(options.qs.version, '2016-05-20');
            assert.equal(options.qs.api_key, 'userpass');
            assert.equal(options.json, true);
            assert.equal(options.formData.name, 'Bob\'s images proj');
            assert.equal(typeof options.formData.rock_positive_examples.path, 'string');
            assert.equal(typeof options.formData.paper_positive_examples.path, 'string');

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




    const mockDownloadAndZip = {
        run : (urls: string[]) => {
            for (const url of urls) {
                assert.equal(typeof url, 'string');
                assert(url.startsWith('http'));
            }
            return Promise.resolve('/tmp/training.zip');
        },
    };

});
