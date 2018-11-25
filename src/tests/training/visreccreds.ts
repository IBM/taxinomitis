/*eslint-env mocha */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as uuid from 'uuid/v1';
import * as request from 'request-promise';

import * as visrec from '../../lib/training/visualrecognition';
import * as downloadAndZip from '../../lib/utils/downloadAndZip';

import * as TrainingTypes from '../../lib/training/training-types';

import * as iam from '../../lib/iam';
import * as mockIAM from '../iam/mock-iam';
import * as mockVisRec from './mock-visrec';

import * as store from '../../lib/db/store';


describe('Training - Visual Recognition - IAM/API keys', () => {

    let getStub: sinon.SinonStub;
    let postStub: sinon.SinonStub;
    let deleteStub: sinon.SinonStub;

    let getClassTenantStub: sinon.SinonStub;
    let getImageTrainingByLabelStub: sinon.SinonStub;
    let countTrainingByLabelStub: sinon.SinonStub;
    let getImageClassifiersStub: sinon.SinonStub;
    let getBluemixCredentialsByIdStub: sinon.SinonStub;
    let getBluemixCredentialsStub: sinon.SinonStub;
    let storeImageClassifierStub: sinon.SinonStub;
    let storeScratchKeyStub: sinon.SinonStub;
    let resetExpiredScratchKeyStub: sinon.SinonStub;
    let deleteImageClassifierStub: sinon.SinonStub;

    let setTimeoutStub: sinon.SinonStub;

    let downloadStub: sinon.SinonStub;


    before(() => {
        iam.init();

        getStub = sinon.stub(request, 'get');

        postStub = sinon.stub(request, 'post');
        postStub.withArgs('https://iam.bluemix.net/identity/token', sinon.match.any).callsFake(mockIAM.request.get);
        postStub.withArgs(sinon.match(/.*classifiers/), sinon.match.any).callsFake(mockVisRec.request.create);

        deleteStub = sinon.stub(request, 'delete').callsFake(mockVisRec.request.delete);


        getClassTenantStub = sinon.stub(store, 'getClassTenant')
                                  .callsFake(mockVisRec.store.getClassTenant);
        getImageTrainingByLabelStub = sinon.stub(store, 'getImageTrainingByLabel')
                                           .callsFake(mockVisRec.store.getImageTrainingByLabel);
        countTrainingByLabelStub = sinon.stub(store, 'countTrainingByLabel')
                                        .callsFake(mockVisRec.store.countTrainingByLabel);
        getImageClassifiersStub = sinon.stub(store, 'getImageClassifiers')
                                       .callsFake(mockVisRec.store.getImageClassifiers);
        getBluemixCredentialsByIdStub = sinon.stub(store, 'getBluemixCredentialsById')
                                             .callsFake(mockVisRec.store.getBluemixCredentialsById);
        getBluemixCredentialsStub = sinon.stub(store, 'getBluemixCredentials')
                                         .callsFake(mockVisRec.store.getBluemixCredentials);
        storeImageClassifierStub = sinon.stub(store, 'storeImageClassifier')
                                        .callsFake(mockVisRec.store.storeImageClassifier);
        storeScratchKeyStub = sinon.stub(store, 'storeOrUpdateScratchKey')
                                        .callsFake(mockVisRec.store.storeOrUpdateScratchKey);
        resetExpiredScratchKeyStub = sinon.stub(store, 'resetExpiredScratchKey')
                                          .callsFake(mockVisRec.store.resetExpiredScratchKey);
        deleteImageClassifierStub = sinon.stub(store, 'deleteImageClassifier')
                                         .callsFake(mockVisRec.store.deleteImageClassifier);

        const fakeTimer: NodeJS.Timer = {} as NodeJS.Timer;
        setTimeoutStub = sinon.stub(global, 'setTimeout').returns(fakeTimer);

        downloadStub = sinon.stub(downloadAndZip, 'run').callsFake(mockVisRec.download.run);
    });

    after(() => {
        getStub.restore();
        postStub.restore();
        deleteStub.restore();
        getClassTenantStub.restore();
        getImageTrainingByLabelStub.restore();
        countTrainingByLabelStub.restore();
        getImageClassifiersStub.restore();
        getBluemixCredentialsByIdStub.restore();
        getBluemixCredentialsStub.restore();
        storeImageClassifierStub.restore();
        storeScratchKeyStub.restore();
        resetExpiredScratchKeyStub.restore();
        deleteImageClassifierStub.restore();
        setTimeoutStub.restore();
        downloadStub.restore();
    });

    beforeEach(() => {
        storeScratchKeyStub.resetHistory();
        deleteImageClassifierStub.resetHistory();
        resetExpiredScratchKeyStub.resetHistory();
        getImageTrainingByLabelStub.resetHistory();
        setTimeoutStub.resetHistory();
        deleteStub.resetHistory();
    });



    describe('legacy API keys', () => {

        it('should train a classifier', async () => {
            const project = mockVisRec.PROJECTS['my simple project name'].project;

            const before = Date.now() - 1;
            const classifier = await visrec.trainClassifier(project);
            const after = Date.now() + 1;

            assert.strictEqual(getImageTrainingByLabelStub.callCount, 3);

            assert(classifier.id);
            assert.strictEqual(classifier.name, project.name);
            assert.strictEqual(classifier.classifierid, mockVisRec.CLASSIFIERS_BY_PROJECT_NAME[project.name].id);
            assert(classifier.created.getTime() > before);
            assert(classifier.created.getTime() < after);
            assert(classifier.expiry.getTime() > before);
            assert(classifier.expiry.getTime() > after);
            assert.strictEqual(classifier.credentialsid, mockVisRec.CREDENTIALS_LEGACY.id);
            assert.strictEqual(classifier.status, 'training');
            assert.strictEqual(classifier.url,
                               mockVisRec.CREDENTIALS_LEGACY.url +
                                    '/v3/classifiers/' +
                                    classifier.classifierid);
        });


        it('should delete a classifier', async () => {
            const classifierinfo = mockVisRec.CLASSIFIERS_BY_PROJECT_NAME['my simple project name'];
            const classifier: TrainingTypes.VisualClassifier = {
                id : uuid(),
                classifierid : classifierinfo.id,
                created : new Date(1527284132420),
                expiry : new Date(1527287787608),
                name : classifierinfo.name,
                credentialsid : mockVisRec.CREDENTIALS_LEGACY.id,
                url : mockVisRec.CREDENTIALS_LEGACY.url + '/v3/classifiers/' + classifierinfo.id,
            };

            assert(deleteImageClassifierStub.notCalled);
            assert(resetExpiredScratchKeyStub.notCalled);
            assert(deleteStub.notCalled);

            await visrec.deleteClassifier(classifier);

            assert(deleteImageClassifierStub.called);
            assert(resetExpiredScratchKeyStub.called);
            assert(deleteStub.called);

            assert(setTimeoutStub.calledOnce);

            assert(deleteStub.calledWith(mockVisRec.CREDENTIALS_LEGACY.url + '/v3/classifiers/' + classifierinfo.id,
                                         sinon.match.has('qs', {
                                             version : '2016-05-20',
                                             api_key : mockVisRec.CREDENTIALS_LEGACY.username +
                                                       mockVisRec.CREDENTIALS_LEGACY.password,
                                         })));
        });
    });



    describe('current API keys', () => {

        it('should train a classifier', async () => {
            assert(getImageTrainingByLabelStub.notCalled);

            const project = mockVisRec.PROJECTS['my shiny new and huge project'].project;

            const before = Date.now() - 1;
            const classifier = await visrec.trainClassifier(project);
            const after = Date.now() + 1;

            assert.strictEqual(getImageTrainingByLabelStub.callCount, 2);

            assert(classifier.id);
            assert.strictEqual(classifier.name, project.name);
            assert.strictEqual(classifier.classifierid, mockVisRec.CLASSIFIERS_BY_PROJECT_NAME[project.name].id);
            assert(classifier.created.getTime() > before);
            assert(classifier.created.getTime() < after);
            assert(classifier.expiry.getTime() > before);
            assert(classifier.expiry.getTime() > after);
            assert.strictEqual(classifier.credentialsid, mockVisRec.CREDENTIALS_NEW.id);
            assert.strictEqual(classifier.status, 'training');
            assert.strictEqual(classifier.url,
                               mockVisRec.CREDENTIALS_NEW.url +
                                    '/v3/classifiers/' +
                                    classifier.classifierid);


        });


        it('should delete a classifier', async () => {
            const classifierinfo = mockVisRec.CLASSIFIERS_BY_PROJECT_NAME['my shiny new and huge project'];
            const classifier: TrainingTypes.VisualClassifier = {
                id : uuid(),
                classifierid : classifierinfo.id,
                created : new Date(1527284132420),
                expiry : new Date(1527287787608),
                name : classifierinfo.name,
                credentialsid : mockVisRec.CREDENTIALS_NEW.id,
                url : mockVisRec.CREDENTIALS_NEW.url + '/v3/classifiers/' + classifierinfo.id,
            };

            assert(deleteImageClassifierStub.notCalled);
            assert(resetExpiredScratchKeyStub.notCalled);
            assert(deleteStub.notCalled);

            await visrec.deleteClassifier(classifier);

            assert(deleteImageClassifierStub.called);
            assert(resetExpiredScratchKeyStub.called);
            assert(deleteStub.called);

            assert(deleteStub.calledWith(mockVisRec.CREDENTIALS_NEW.url + '/v3/classifiers/' + classifierinfo.id,
                                         sinon.match.has('qs', { version : '2018-03-19' })));

            const authHeader = await iam.getAuthHeader(mockVisRec.CREDENTIALS_NEW.username +
                                                       mockVisRec.CREDENTIALS_NEW.password);
            assert(authHeader.startsWith('Bearer '));
            assert(authHeader.length > 20);

            assert(setTimeoutStub.calledOnce);

            assert(deleteStub.calledWith(mockVisRec.CREDENTIALS_NEW.url + '/v3/classifiers/' + classifierinfo.id,
                                         sinon.match.has('headers', sinon.match.has('Authorization', authHeader))));
        });

    });

});
