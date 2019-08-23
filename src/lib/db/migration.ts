import * as store from './store';
import * as storetypes from './db-types';
import * as objectstore from '../objectstore';
import * as objecttypes from '../objectstore/types';
import * as urlparse from '../restapi/sounds/urlparse';


const projects: { [id: string]: storetypes.Project } = {};


async function getBatchOfIds(offset: number, limit: number): Promise<string[]> {
    const queryString = 'SELECT `id` FROM `soundtraining` ' +
                        'WHERE `audiourl` IS NULL ' +
                        'LIMIT ? OFFSET ?';

    const rows: Array<{ id: string }> = await store.dbExecute(queryString, [ limit, offset ]);
    return rows.map((row) => row.id);
}


async function updateSoundTrainingRow(training: MigratedSoundTraining, spec: objecttypes.ObjectSpec): Promise<void> {
    const queryString = 'UPDATE `soundtraining` ' +
                        'SET `audiourl` = ? ' +
                        'WHERE `id` = ?';
    const params = [ urlparse.createSoundUrl(spec), training.id ];
    const response = await store.dbExecute(queryString, params);
    if (response.affectedRows !== 1) {
        console.log(response, training.id);
        throw new Error('failed to update');
    }
}


async function getAllIds(): Promise<string[]> {
    const batchsize = 100;
    let batchoffset = 0;

    let ids: string[] = [];
    let batch = await getBatchOfIds(batchoffset, batchsize);
    while (batch.length > 0) {
        ids = ids.concat(batch);

        batchoffset += batchsize;
        batch = await getBatchOfIds(batchoffset, batchsize);
    }

    return ids;
}


function checkUnique(ids: string[]): boolean {
    const check = new Set(ids);
    return check.size === ids.length;
}


async function getSoundData(id: string): Promise<MigratedSoundTraining> {
    const queryString = 'SELECT `id`, `audiodata`, `audiourl`, `label`, `projectid` FROM `soundtraining` ' +
                        'WHERE `id` = ?';

    const rows: SoundTraining[] = await store.dbExecute(queryString, [ id ]);
    if (rows.length !== 1) {
        console.log(rows);
        throw new Error('could not find');
    }
    if (rows[0].audiourl !== null) {
        console.log(rows);
        throw new Error('already migrated');
    }
    return {
        id : rows[0].id,
        audiodata : rows[0].audiodata.split(',').map((item) => Number(item)),
        label : rows[0].label,
        projectid : rows[0].projectid,
    };
}

async function getProject(training: MigratedSoundTraining | SoundTraining): Promise<storetypes.Project>
{
    const cachedProject = projects[training.projectid];
    if (cachedProject) {
        return Promise.resolve(cachedProject);
    }

    const project = await store.getProject(training.projectid);
    if (!project) {
        console.log(training.id);
        throw new Error('Unknown project');
    }
    projects[training.projectid] = project;
    return project;
}


async function getSpec(training: MigratedSoundTraining | SoundTraining): Promise<objecttypes.ObjectSpec> {
    const project = await getProject(training);
    return {
        classid : project.classid,
        userid : project.userid,
        projectid : project.id,
        objectid : training.id,
    };
}


async function migrateAll(ids: string[]): Promise<void>
{
    for (const id of ids) {
        try {
            const soundData = await getSoundData(id);
            const spec = await getSpec(soundData);

            await objectstore.storeSound(spec, soundData.audiodata);
            await updateSoundTrainingRow(soundData, spec);
            console.log('updated', id);
        }
        catch (err) {
            console.log(id, err.message);
        }
    }
}




store.init()
    .then(() => {
        objectstore.init();
    })
    .then(() => {
        return getAllIds();
    })
    .then((ids) => {
        const safety = checkUnique(ids);
        if (!safety) {
            throw new Error('dupe');
        }

        return migrateAll(ids);
    })
    .then(() => {
        store.disconnect();
    });



interface SoundTraining {
    readonly id: string;
    readonly audiodata: string;
    readonly label: string;
    readonly projectid: string;
    audiourl?: string;
}


interface MigratedSoundTraining {
    readonly id: string;
    readonly audiodata: number[];
    readonly label: string;
    readonly projectid: string;
    audiourl?: string;
}
