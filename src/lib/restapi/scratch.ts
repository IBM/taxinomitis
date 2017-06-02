// external dependencies
import * as Express from 'express';
import * as httpstatus from 'http-status';
import * as _ from 'lodash';
// local dependencies
import * as store from '../db/store';
import * as errors from './errors';
import * as auth from './auth';
import * as nlc from '../training/nlc';
import * as Types from '../db/db-types';
import * as TrainingTypes from '../training/training-types';



async function createScratchKey(
    projectid: string,
    userid: string, classid: string,
): Promise<{ id: string, model?: string }>
{
    const project = await store.getProject(projectid);
    const nlcClassifiers = await store.getNLCClassifiers(projectid);

    if (nlcClassifiers.length === 0) {
        const id = await store.storeUntrainedScratchKey(
            projectid, project.name, project.type,
            userid, classid);
        return { id };
    }
    else {
        const classifier = nlcClassifiers[0];
        const model = classifier.classifierid;

        const credentials = await store.getServiceCredentials(
            projectid, classid, userid,
            'nlc', classifier.classifierid);

        const id = await store.storeOrUpdateScratchKey(
            projectid, project.type, userid, classid, credentials, classifier.classifierid);

        return { id, model };
    }
}


async function getScratchKeys(req: Express.Request, res: Express.Response) {
    const classid: string = req.params.classid;
    const userid: string = req.params.studentid;
    const projectid: string = req.params.projectid;

    try {
        const scratchKeys = await store.findScratchKeys(userid, projectid, classid);

        if (scratchKeys.length === 0) {
            const newKeyInfo = await createScratchKey(projectid, userid, classid);
            return res.json([ newKeyInfo ]);
        }

        return res.json(scratchKeys.map((key) => {
            return {
                id : key.id,
                model : key.classifierid,
            };
        }));
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}





async function classifyText(key: Types.ScratchKey, text: string): Promise<TrainingTypes.NLCClassification[]> {
    if (key.classifierid && key.credentials) {
        return nlc.testClassifier(key.credentials, key.classifierid, text);
    }
    else {
        const project = await store.getProject(key.projectid);
        const confidence = Math.round((1 / project.labels.length) * 100);
        return _.shuffle(project.labels).map((label) => {
            return { class_name : label, confidence };
        });
    }
}



async function classifyWithScratchKey(req: Express.Request, res: Express.Response) {
    const apikey = req.params.scratchkey;

    const text = req.body.text;
    if (!text || text.trim().length === 0) {
        return errors.missingData(res);
    }

    try {
        const scratchKey = await store.getScratchKey(apikey);
        if (scratchKey.type === 'text') {
            const classes = await classifyText(scratchKey, text);
            return res.json(classes);
        }
        else {
            return errors.notImplementedYet(res);
        }
    }
    catch (err) {
        errors.unknownError(res, err);
    }
}




export default function registerApis(app: Express.Application) {

    app.get('/api/classes/:classid/students/:studentid/projects/:projectid/scratchkeys',
            auth.authenticate,
            auth.checkValidUser,
            getScratchKeys);

    app.get('/api/scratch/:scratchkey/classify', classifyWithScratchKey);

}
