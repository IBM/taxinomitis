import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';
import * as textmodels from '../../lib/training/textmodels';
import * as textservice from '../../lib/training/textservice';



/**
 * Text models trained by a real mlforkids-text service, running locally
 *  (using mlforkids-text/ops/local-03-run.sh) at the TEXT_SERVICE url,
 *  with the real DB - so that nothing depends on mocks of the service.
 */
(process.env.TRAVIS ? describe.skip : describe)('Training - text models with the text service', () => {

    // a class with no Watson Assistant credentials, so new
    //  text models are trained by the text service
    const CLASSID = 'UNIQUECLASSIDTXTSERVICE';

    let userid: string;
    let trainSpy: sinon.SinonSpy<any, any>;

    before(async () => {
        await store.init();
        await store.deleteClassResources(CLASSID);
        trainSpy = sinon.spy(textservice, 'train');
    });
    beforeEach(() => {
        userid = uuid();
        trainSpy.resetHistory();
    });
    afterEach(async () => {
        await textmodels.waitForTrainings();
    });
    after(async () => {
        trainSpy.restore();
        await store.deleteClassResources(CLASSID);
        await store.disconnect();
    });


    /**
     * @param owner - the student who owns the project
     * @param labelSuffix - added to the label names, so that
     *  projects can be told apart by their labels
     */
    async function createCloudProject(owner = userid, labelSuffix = ''): Promise<DbTypes.Project> {
        const animals = 'animals' + labelSuffix;
        const food = 'food' + labelSuffix;
        const project = await store.storeProject(owner, CLASSID, 'text', 'my text project', 'en', [], false);
        await store.addLabelToProject(owner, CLASSID, project.id, animals);
        await store.addLabelToProject(owner, CLASSID, project.id, food);
        project.labels = [ animals, food ];
        for (const text of [ 'cat', 'dog', 'horse', 'a big brown cow', 'my pet rabbit' ]) {
            await store.storeTextTraining(project.id, text, animals);
        }
        for (const text of [ 'pizza', 'chips', 'a cheese sandwich', 'chocolate cake', 'an apple' ]) {
            await store.storeTextTraining(project.id, text, food);
        }
        return project;
    }

    async function getModel(projectid: string): Promise<TrainingTypes.TextClassifier> {
        const tenant = await store.getClassTenant(CLASSID);
        const models = await store.getTextClassifiers(projectid);
        assert.strictEqual(models.length, 1);
        const [ withStatus ] = await textmodels.getModelStatuses(tenant, models);
        return withStatus;
    }

    async function classify(projectid: string, modelid: string, text: string): Promise<TrainingTypes.Classification[]> {
        const tenant = await store.getClassTenant(CLASSID);
        return textmodels.classifyModel(tenant, projectid, modelid, new Date(), text);
    }


    it('should train a model in the background, and classify with it', async () => {
        const project = await createCloudProject();

        const accepted = await textmodels.trainClassifier(project);
        assert.strictEqual(accepted.servicetype, 'txt');
        assert.strictEqual(accepted.status, 'Training');
        assert.strictEqual(accepted.workspace_id, accepted.id);
        assert.strictEqual((await getModel(project.id)).status, 'Training');

        await textmodels.waitForTrainings();

        const model = await getModel(project.id);
        assert.strictEqual(model.status, 'Available');
        assert.notStrictEqual(model.workspace_id, accepted.id);
        assert(trainSpy.calledOnce);

        const classes = await classify(project.id, model.workspace_id, 'a fluffy kitten');
        assert.deepStrictEqual(classes.map((item) => item.class_name).sort(), [ 'animals', 'food' ]);
        assert.strictEqual(classes[0].class_name, 'animals');
        assert(classes[0].confidence > classes[1].confidence);
        assert(!classes[0].random);
    });


    it('should retrain a model, giving random answers until it is trained', async () => {
        const project = await createCloudProject();
        await textmodels.trainClassifier(project);
        await textmodels.waitForTrainings();
        const first = await getModel(project.id);

        await store.storeTextTraining(project.id, 'a bowl of soup', 'food');
        const accepted = await textmodels.trainClassifier(project);
        assert.strictEqual(accepted.status, 'Training');
        assert.strictEqual(accepted.workspace_id, first.id);

        const during = await classify(project.id, accepted.workspace_id, 'a fluffy kitten');
        assert.strictEqual(during.length, 1);
        assert.strictEqual(during[0].random, true);
        await assert.rejects(
            () => classify(project.id, first.workspace_id, 'a fluffy kitten'),
            { message : textmodels.ERROR_MESSAGES.MODEL_NOT_FOUND });

        await textmodels.waitForTrainings();

        const second = await getModel(project.id);
        assert.strictEqual(second.status, 'Available');
        assert.notStrictEqual(second.workspace_id, first.workspace_id);
        assert.notStrictEqual(second.workspace_id, first.id);

        const classes = await classify(project.id, second.workspace_id, 'tomato soup');
        assert.strictEqual(classes[0].class_name, 'food');
    });


    it('should give a duplicate request the training in progress', async () => {
        const project = await createCloudProject();

        const [ first, second ] = await Promise.all([
            textmodels.trainClassifier(project),
            textmodels.trainClassifier(project),
        ]);
        const third = await textmodels.trainClassifier(project);

        assert.strictEqual(second.id, first.id);
        assert.strictEqual(third.id, first.id);
        assert.strictEqual(third.status, 'Training');

        await textmodels.waitForTrainings();
        assert(trainSpy.calledOnce);
        assert.strictEqual((await getModel(project.id)).status, 'Available');
    });


    it('should train several projects at once', async () => {
        // more than the local service trains at once, so the
        //  others have to wait their turn in the service
        const NUM_PROJECTS = 5;
        const projects: DbTypes.Project[] = [];
        for (let i = 0; i < NUM_PROJECTS; i++) {
            // a student each, so the model limit doesn't apply
            projects.push(await createCloudProject(uuid(), '_' + i));
        }

        const accepted = await Promise.all(projects.map((project) => textmodels.trainClassifier(project)));
        assert(accepted.every((model) => model.status === 'Training'));

        await textmodels.waitForTrainings();
        assert.strictEqual(trainSpy.callCount, NUM_PROJECTS);

        for (let i = 0; i < NUM_PROJECTS; i++) {
            const model = await getModel(projects[i].id);
            assert.strictEqual(model.status, 'Available');

            // each model was trained with its own project's labels
            const classes = await classify(projects[i].id, model.workspace_id, 'a fluffy kitten');
            assert.deepStrictEqual(classes.map((item) => item.class_name).sort(), [ 'animals_' + i, 'food_' + i ]);
            assert.strictEqual(classes[0].class_name, 'animals_' + i);
        }
    });


    it('should turn away a training the service would reject', async () => {
        const project = await store.storeLocalProject(userid, CLASSID, 'text', 'my local project', []);
        const training = textmodels.sanitizeTraining({
            name : 'my local project',
            language : 'en',
            // the service needs at least two labels
            intents : [ { intent : 'animals', examples : [ { text : 'cat' }, { text : 'dog' } ] } ],
            dialog_nodes : [],
            counterexamples : [],
            entities : [],
            metadata : {},
        });

        await assert.rejects(() => textmodels.trainClassifierForProject(project, training),
            { message : textmodels.ERROR_MESSAGES.INVALID_TRAINING });

        assert(trainSpy.notCalled);
        assert.deepStrictEqual(await store.getTextClassifiers(project.id), []);
    });


    it('should report Scratch status while training, and once trained', async () => {
        const project = await createCloudProject();

        const trainReply = await textmodels.trainWithScratchKey(project);
        assert.deepStrictEqual(trainReply, { status : 1, msg : 'Model not ready yet', type : 'text' });

        let [ key ] = await store.findScratchKeys(userid, project.id, CLASSID);
        assert.deepStrictEqual(await textmodels.getScratchKeyStatus(key), { status : 1, msg : 'Model not ready yet', type : 'text' });

        await textmodels.waitForTrainings();

        key = await store.getScratchKey(key.id);
        assert.strictEqual(key.classifierid, (await getModel(project.id)).workspace_id);
        assert.deepStrictEqual(await textmodels.getScratchKeyStatus(key), { status : 2, msg : 'Ready', type : 'text' });

        const classes = await textmodels.classifyWithScratchKey(key, 'a hamster');
        assert.strictEqual(classes[0].class_name, 'animals');
    });
});
