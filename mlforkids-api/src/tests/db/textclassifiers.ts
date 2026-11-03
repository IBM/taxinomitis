import { describe, it, before, after } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as dbobjects from '../../lib/db/objects';
import * as textmodels from '../../lib/training/textmodels';
import * as Objects from '../../lib/db/db-types';
import * as TrainingObjects from '../../lib/training/training-types';


describe('DB objects - text service training status', () => {

    const abandonIfStartedBefore = new Date('2026-11-02T10:00:00.000Z');
    const UPDATED = new Date('2026-11-01T14:03:22.000Z');

    it('should be Non Existent with no row', () => {
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(undefined, abandonIfStartedBefore), 'Non Existent');
    });

    it('should be Available with a head and no training', () => {
        const state = { id : uuid(), updated : UPDATED, hashead : true };
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(state, abandonIfStartedBefore), 'Available');
    });

    it('should be Training with a recent start', () => {
        const state = { id : uuid(), updated : UPDATED, hashead : false, trainingstarted : new Date('2026-11-02T10:05:00.000Z') };
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(state, abandonIfStartedBefore), 'Training');
    });

    it('should be Training with a start exactly at the cutoff', () => {
        const state = { id : uuid(), updated : UPDATED, hashead : false, trainingstarted : new Date('2026-11-02T10:00:00.000Z') };
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(state, abandonIfStartedBefore), 'Training');
    });

    it('should be Failed with a start older than the cutoff', () => {
        const state = { id : uuid(), updated : UPDATED, hashead : false, trainingstarted : new Date('2026-11-02T09:59:59.999Z') };
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(state, abandonIfStartedBefore), 'Failed');
    });

    it('should be Failed when the training failed', () => {
        const state = { id : uuid(), updated : UPDATED, hashead : false, trainingfailed : new Date('2026-11-02T10:05:00.000Z') };
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(state, abandonIfStartedBefore), 'Failed');
    });

    it('should be Failed with no head and no training', () => {
        const state = { id : uuid(), updated : UPDATED, hashead : false };
        assert.strictEqual(dbobjects.getTextServiceTrainingStatus(state, abandonIfStartedBefore), 'Failed');
    });
});


describe('DB store - text classifier heads', () => {

    before(() => {
        return store.init();
    });
    after(() => {
        return store.disconnect();
    });


    function createProject(): Objects.Project {
        return {
            id : uuid(),
            userid : uuid(),
            classid : uuid(),
            type : 'text',
            name : 'my text project',
            labels : [ 'happy', 'sad' ],
            language : 'en',
            numfields : 0,
            isCrowdSourced : false,
        };
    }


    describe('getTextClassifierHead', () => {
        it('should return the head of a trained model', async () => {
            const project = createProject();
            const head = Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x54, 0x58, 0x54, 0x01, 0x00, 0xff ]);
            const trained = new Date('2026-11-01T14:03:22Z');
            const model = await storeTrainedModel(project, head, trained);

            assert.deepStrictEqual(await store.getTextClassifierHead(model.id), {
                id : model.id,
                projectid : project.id,
                userid : project.userid,
                head : Buffer.from([ 0x4d, 0x4c, 0x46, 0x4b, 0x54, 0x58, 0x54, 0x01, 0x00, 0xff ]),
                updated : trained,
            });

            await store.deleteTextClassifier(model.id);
        });

        it('should return nothing for an unknown id', async () => {
            const retrieved = await store.getTextClassifierHead(uuid());
            assert.strictEqual(retrieved, undefined);
        });
    });


    describe('deleteEntireProject', () => {
        it('should delete the heads for the project', async () => {
            const deletedProject = createProject();
            const otherProject = { ...createProject(), userid : deletedProject.userid, classid : deletedProject.classid };
            const deleted = await storeTrainedModel(deletedProject, Buffer.from([ 0x01 ]));
            const kept = await storeTrainedModel(otherProject, Buffer.from([ 0x02 ]));

            await store.deleteEntireProject(deletedProject.userid, deletedProject.classid, deletedProject);

            assert.strictEqual(await store.getTextClassifierHead(deleted.id), undefined);
            assert.deepStrictEqual((await store.getTextClassifierHead(kept.id))?.head, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifier(kept.id);
        });
    });


    describe('deleteEntireUser', () => {
        it('should delete the heads for the user', async () => {
            const deletedUserProject = createProject();
            const otherUserProject = { ...createProject(), classid : deletedUserProject.classid };
            const deleted = await storeTrainedModel(deletedUserProject, Buffer.from([ 0x01 ]));
            const kept = await storeTrainedModel(otherUserProject, Buffer.from([ 0x02 ]));

            await store.deleteEntireUser(deletedUserProject.userid, deletedUserProject.classid);

            assert.strictEqual(await store.getTextClassifierHead(deleted.id), undefined);
            assert.deepStrictEqual((await store.getTextClassifierHead(kept.id))?.head, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifier(kept.id);
        });
    });


    describe('deleteTextClassifier', () => {
        it('should delete the model and its head', async () => {
            const project = createProject();
            const otherProject = createProject();
            const model = await storeTrainedModel(project, Buffer.from([ 0x01 ]));
            const other = await storeTrainedModel(otherProject, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifier(model.id);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), []);
            assert.deepStrictEqual(await store.getTextClassifiers(otherProject.id), [ other ]);
            assert.strictEqual(await store.getTextClassifierHead(model.id), undefined);
            assert.deepStrictEqual((await store.getTextClassifierHead(other.id))?.head, Buffer.from([ 0x02 ]));

            await store.deleteTextClassifier(other.id);
        });
    });


    function createTrainingModel(project: Objects.Project, started: Date): TrainingObjects.TextClassifier {
        const id = uuid();
        return {
            id,
            // placeholder while the model is training
            workspace_id : id,
            credentialsid : '',
            servicetype : 'txt',
            url : '',
            name : project.name,
            language : 'en',
            created : started,
            expiry : new Date(started.getTime() + (2 * 60 * 60 * 1000)),
        };
    }

    /** stores a text service model that has finished training, as training would */
    async function storeTrainedModel(
        project: Objects.Project,
        head = Buffer.from([ 0x01 ]),
        trained = new Date('2026-11-01T14:03:22Z'),
    ): Promise<TrainingObjects.TextClassifier>
    {
        const model = createTrainingModel(project, trained);
        assert.strictEqual(await store.createTextServiceTraining(project, model, trained), 'created');
        const trainedModel = { ...model, workspace_id : uuid() };
        assert.strictEqual(await store.finishTextServiceTraining(model.id, trained, {
            modelid : trainedModel.workspace_id, head, finished : trained, expiry : model.expiry,
        }), true);
        return trainedModel;
    }


    describe('createTextServiceTraining', () => {
        it('should count a model that is training towards the model limit', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);

            assert.strictEqual(await store.countTextModelsByUser(project.userid), 0);
            await store.createTextServiceTraining(project, model, started);
            assert.strictEqual(await store.countTextModelsByUser(project.userid), 1);

            await store.deleteTextClassifier(model.id);
        });

        it('should store a model that is training', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00.123Z');
            const model = createTrainingModel(project, started);

            const result = await store.createTextServiceTraining(project, model, started);
            assert.strictEqual(result, 'created');

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [ model ]);
            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingstarted : started,
            });
            assert.strictEqual(await store.getTextClassifierHead(model.id), undefined);

            await store.deleteTextClassifier(model.id);
        });

        it('should report a second create for the project as already training', async () => {
            const project = createProject();
            const first = createTrainingModel(project, new Date('2026-11-02T10:00:00Z'));
            const second = createTrainingModel(project, new Date('2026-11-02T10:00:01Z'));

            assert.strictEqual(await store.createTextServiceTraining(project, first, first.created), 'created');
            assert.strictEqual(await store.createTextServiceTraining(project, second, second.created), 'already-training');

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [ first ]);
            assert.strictEqual(await store.getTextServiceTrainingState(second.id), undefined);

            await store.deleteTextClassifier(first.id);
        });

        it('should store one model for concurrent creates', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const models = [ 1, 2, 3, 4, 5 ].map(() => createTrainingModel(project, started));

            const results = await Promise.all(models.map((model) => store.createTextServiceTraining(project, model, started)));

            assert.deepStrictEqual(results.filter((r) => r === 'created').length, 1);
            assert.deepStrictEqual(results.filter((r) => r === 'already-training').length, 4);
            const stored = await store.getTextClassifiers(project.id);
            assert.strictEqual(stored.length, 1);

            await store.deleteTextClassifier(stored[0].id);
        });

        it('should store neither row if the model cannot be stored', async () => {
            const project = createProject();
            const started = new Date();
            const model = { ...createTrainingModel(project, started), name : 'x'.repeat(101) };

            await assert.rejects(
                store.createTextServiceTraining(project, model, started),
                { message : 'Failed to store text model' });

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), []);
            assert.strictEqual(await store.getTextServiceTrainingState(model.id), undefined);
        });
    });


    // the cutoff for a training started at 'now' to be abandoned
    function abandonIfStartedBefore(now: Date): Date {
        return new Date(now.getTime() - textmodels.ABANDON_TRAINING_AFTER_MS);
    }


    describe('claimTextServiceTraining', () => {
        it('should claim a trained model, and remove its head', async () => {
            const project = createProject();
            const model = await storeTrainedModel(project);

            const now = new Date('2026-11-02T10:00:00.456Z');
            const claimed = await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now));
            assert.deepStrictEqual(claimed, now);

            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : new Date('2026-11-01T14:03:22Z'),
                trainingstarted : now,
            });
            assert.strictEqual(await store.getTextClassifierHead(model.id), undefined);

            await store.deleteTextClassifier(model.id);
        });

        it('should not claim a model that is training', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);

            const now = new Date('2026-11-02T10:09:59.999Z');
            assert.strictEqual(await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now)), undefined);

            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingstarted : started,
            });

            await store.deleteTextClassifier(model.id);
        });

        it('should claim a model whose training was abandoned', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);

            const now = new Date('2026-11-02T10:10:00.001Z');
            assert.deepStrictEqual(await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now)), now);

            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingstarted : now,
            });

            await store.deleteTextClassifier(model.id);
        });

        it('should let only one of several concurrent claims succeed', async () => {
            const project = createProject();
            const model = await storeTrainedModel(project);

            const times = [ 1, 2, 3, 4, 5 ].map((ms) => new Date(Date.UTC(2026, 10, 2, 10, 0, 0, ms)));
            const claims = await Promise.all(times.map((now) => store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now))));

            const successes = claims.filter((claimed) => claimed !== undefined);
            assert.strictEqual(successes.length, 1);
            const state = await store.getTextServiceTrainingState(model.id);
            assert.deepStrictEqual(state?.trainingstarted, successes[0]);

            await store.deleteTextClassifier(model.id);
        });

        it('should not claim an unknown model', async () => {
            const now = new Date();
            assert.strictEqual(await store.claimTextServiceTraining(uuid(), now, abandonIfStartedBefore(now)), undefined);
        });
    });


    describe('setTextServiceModelPlaceholder', () => {
        it('should replace the model id with the placeholder', async () => {
            const project = createProject();
            const model = await storeTrainedModel(project);

            await store.setTextServiceModelPlaceholder(model.id);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [ { ...model, workspace_id : model.id } ]);

            await store.deleteTextClassifier(model.id);
        });

        it('should not fail for a model that has been deleted', async () => {
            await store.setTextServiceModelPlaceholder(uuid());
        });

        it('should not change a Watson Assistant model', async () => {
            const project = createProject();
            const model: TrainingObjects.TextClassifier = {
                ...createTrainingModel(project, new Date('2026-11-01T14:03:22Z')),
                workspace_id : uuid(),
                credentialsid : uuid(),
                servicetype : 'conv',
                url : 'https://api.us-south.assistant.watson.cloud.ibm.com',
            };
            await store.storeTextClassifier(project, model);

            await store.setTextServiceModelPlaceholder(model.id);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [ model ]);

            await store.deleteTextClassifier(model.id);
        });
    });


    describe('finishTextServiceTraining', () => {
        it('should store the trained model', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00.789Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);

            const modelid = uuid();
            const finished = new Date('2026-11-02T10:00:07.250Z');
            const expiry = new Date('2026-11-02T12:00:07.250Z');
            const stored = await store.finishTextServiceTraining(model.id, started, {
                modelid, head : Buffer.from([ 0x03, 0x04 ]), finished, expiry,
            });
            assert.strictEqual(stored, true);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [
                { ...model, workspace_id : modelid, expiry },
            ]);
            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : true,
                updated : finished,
            });
            assert.deepStrictEqual(await store.getTextClassifierHead(model.id), {
                id : model.id,
                projectid : project.id,
                userid : project.userid,
                head : Buffer.from([ 0x03, 0x04 ]),
                updated : finished,
            });

            await store.deleteTextClassifier(model.id);
        });

        it('should store a retrained model', async () => {
            const project = createProject();
            const model = await storeTrainedModel(project);
            const now = new Date('2026-11-02T10:00:00Z');
            const started = await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now));
            assert(started);
            await store.setTextServiceModelPlaceholder(model.id);

            const modelid = uuid();
            const finished = new Date('2026-11-02T10:00:05Z');
            const expiry = new Date('2026-11-02T12:00:05Z');
            assert.strictEqual(await store.finishTextServiceTraining(model.id, started, {
                modelid, head : Buffer.from([ 0x02 ]), finished, expiry,
            }), true);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [
                { ...model, workspace_id : modelid, expiry },
            ]);
            const head = await store.getTextClassifierHead(model.id);
            assert.deepStrictEqual(head?.head, Buffer.from([ 0x02 ]));
            assert.deepStrictEqual(head?.updated, finished);

            await store.deleteTextClassifier(model.id);
        });

        it('should store nothing if the model was deleted', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);
            await store.deleteTextClassifier(model.id);

            const stored = await store.finishTextServiceTraining(model.id, started, {
                modelid : uuid(), head : Buffer.from([ 0x01 ]), finished : new Date(), expiry : new Date(),
            });
            assert.strictEqual(stored, false);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), []);
            assert.strictEqual(await store.getTextServiceTrainingState(model.id), undefined);
        });

        it('should store nothing if a newer training has started', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);
            const now = new Date('2026-11-02T10:10:00.001Z');
            assert.deepStrictEqual(await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now)), now);

            const stored = await store.finishTextServiceTraining(model.id, started, {
                modelid : uuid(), head : Buffer.from([ 0x01 ]),
                finished : new Date('2026-11-02T10:10:01Z'), expiry : new Date('2026-11-02T12:10:01Z'),
            });
            assert.strictEqual(stored, false);

            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [ model ]);
            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingstarted : now,
            });

            await store.deleteTextClassifier(model.id);
        });
    });


    describe('failTextServiceTraining', () => {
        it('should record that the training failed', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);

            const failed = new Date('2026-11-02T10:04:00.321Z');
            assert.strictEqual(await store.failTextServiceTraining(model.id, started, failed), true);

            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingfailed : failed,
            });
            assert.deepStrictEqual(await store.getTextClassifiers(project.id), [ model ]);

            await store.deleteTextClassifier(model.id);
        });

        it('should let a failed model be claimed straight away', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);
            await store.failTextServiceTraining(model.id, started, new Date('2026-11-02T10:00:01Z'));

            const now = new Date('2026-11-02T10:00:02Z');
            assert.deepStrictEqual(await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now)), now);

            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingstarted : now,
            });

            await store.deleteTextClassifier(model.id);
        });

        it('should record nothing if the model was deleted', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);
            await store.deleteTextClassifier(model.id);

            assert.strictEqual(await store.failTextServiceTraining(model.id, started, new Date()), false);
            assert.strictEqual(await store.getTextServiceTrainingState(model.id), undefined);
        });

        it('should record nothing if a newer training has started', async () => {
            const project = createProject();
            const started = new Date('2026-11-02T10:00:00Z');
            const model = createTrainingModel(project, started);
            await store.createTextServiceTraining(project, model, started);
            const now = new Date('2026-11-02T10:10:00.001Z');
            await store.claimTextServiceTraining(model.id, now, abandonIfStartedBefore(now));

            assert.strictEqual(await store.failTextServiceTraining(model.id, started, new Date('2026-11-02T10:10:01Z')), false);

            assert.deepStrictEqual(await store.getTextServiceTrainingState(model.id), {
                id : model.id,
                hashead : false,
                updated : started,
                trainingstarted : now,
            });

            await store.deleteTextClassifier(model.id);
        });
    });


    describe('replaceScratchKeyPlaceholder', () => {
        function textServiceCredentials(project: Objects.Project): TrainingObjects.BluemixCredentials {
            return {
                id : '',
                servicetype : 'txt',
                url : '',
                username : dbobjects.TEXT_SERVICE_SCRATCHKEY_USERNAME,
                password : '',
                classid : project.classid,
                credstype : 'unknown',
            };
        }

        it('should replace the placeholder with the model id', async () => {
            const project = createProject();
            const placeholder = uuid();
            const keyid = await store.storeOrUpdateScratchKey(project, textServiceCredentials(project),
                placeholder, new Date('2026-11-02T10:00:00Z'));

            const modelid = uuid();
            const finished = new Date('2026-11-02T10:00:06.500Z');
            await store.replaceScratchKeyPlaceholder(project.id, placeholder, modelid, finished);

            const key = await store.getScratchKey(keyid);
            assert.strictEqual(key.classifierid, modelid);
            assert.deepStrictEqual(key.updated, finished);

            await store.deleteScratchKey(keyid);
        });

        it('should not change a key that has been reset', async () => {
            const project = createProject();
            const placeholder = uuid();
            const keyid = await store.storeOrUpdateScratchKey(project, textServiceCredentials(project),
                placeholder, new Date('2026-11-02T10:00:00Z'));
            await store.resetExpiredScratchKey(placeholder, 'text');

            await store.replaceScratchKeyPlaceholder(project.id, placeholder, uuid(), new Date());

            const key = await store.getScratchKey(keyid);
            assert.strictEqual(key.classifierid, undefined);

            await store.deleteScratchKey(keyid);
        });

        it('should not create a key', async () => {
            const project = createProject();

            await store.replaceScratchKeyPlaceholder(project.id, uuid(), uuid(), new Date());

            assert.deepStrictEqual(await store.findScratchKeys(project.userid, project.id, project.classid), []);
        });
    });
});
