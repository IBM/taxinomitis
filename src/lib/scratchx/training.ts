// external dependencies
import { v4 as uuid } from 'uuid';
// local dependencies
import * as store from '../db/store';
import * as Types from '../db/db-types';
import * as objectstore from '../objectstore';
import * as urlparse from '../restapi/images/urlparse';
import * as ObjectTypes from '../objectstore/types';
import loggerSetup from '../utils/logger';

const log = loggerSetup();




async function storeText(key: Types.ScratchKey, label: string, textStr: string): Promise<Types.TextTraining>
{
    // check that we have some data to store
    if (!textStr || typeof textStr !== 'string' || textStr.trim().length === 0) {
        throw new Error('Missing data');
    }

    const project = await store.getProject(key.projectid);

    // check that this isn't an unknown project
    if (!project) {
        throw new Error('Project not found');
    }

    // check that we have a label that is in the project
    if (project.labels.indexOf(label) === -1) {
        throw new Error('Invalid label');
    }

    // All looks good!

    return store.storeTextTraining(project.id, textStr, label);
}



async function storeNumbers(key: Types.ScratchKey, label: string, numbersStr: string[]): Promise<Types.NumberTraining>
{
    // check that we have some data to store
    if (!numbersStr || numbersStr.length === 0) {
        throw new Error('Missing data');
    }

    const project = await store.getProject(key.projectid);

    // check that this isn't an unknown project
    if (!project) {
        throw new Error('Project not found');
    }

    // check that we have the right number of numbers to store
    if (numbersStr.length !== project.numfields) {
        throw new Error('Missing data');
    }

    // check that we have a label that is in the project
    if (project.labels.indexOf(label) === -1) {
        throw new Error('Invalid label');
    }

    // verify that the all the fields are the right type
    const fields = await store.getNumberProjectFields(project.userid, project.classid, project.id);
    const numbers: number[] = fields.map((field, idx) => {
        if (field.type === 'multichoice') {
            const asNum = field.choices.indexOf(numbersStr[idx]);
            if (asNum === -1) {
                throw new Error('Invalid data');
            }
            return asNum;
        }
        else { // if (field.type === 'number') {
            const asNum = Number(numbersStr[idx]);
            if (isNaN(asNum)) {
                throw new Error('Invalid data');
            }
            return asNum;
        }
    });

    // All looks good!

    return store.storeNumberTraining(project.id, project.isCrowdSourced, numbers, label);
}


async function storeImages(key: Types.ScratchKey, label: string, base64imagedata: string): Promise<Types.ImageTraining>
{
    // check image data to store
    if (typeof base64imagedata !== 'string') {
        throw new Error('Invalid data');
    }
    if (!base64imagedata || base64imagedata.trim().length === 0) {
        throw new Error('Missing data');
    }

    // check project
    const project = await store.getProject(key.projectid);

    // check that this isn't an unknown project
    if (!project) {
        throw new Error('Project not found');
    }

    // check that we have a label that is in the project
    if (project.labels.indexOf(label) === -1) {
        throw new Error('Invalid label');
    }

    // All looks good!

    const imageSpec: ObjectTypes.ObjectSpec = {
        classid : project.classid,
        userid : project.userid,
        projectid : project.id,
        objectid : uuid(),
    };

    await objectstore.storeImage(imageSpec, 'image/jpeg', Buffer.from(base64imagedata, 'base64'));

    return store.storeImageTraining(
        imageSpec.projectid,
        urlparse.createImageUrl(imageSpec),
        label,
        true,
        imageSpec.objectid);
}



async function storeSound(key: Types.ScratchKey): Promise<Types.SoundTraining>
{
    log.error({ key }, 'Unexpected request to store sound training data');
    throw new Error('Not implemented yet');
}








export function storeTrainingData(scratchKey: Types.ScratchKey, label: string, data: any): Promise<any>
{
    switch (scratchKey.type) {
    case 'text':
        return storeText(scratchKey, label, data as string);
    case 'numbers': {
        let dataAsArray: string[] = data;
        if (data && Array.isArray(dataAsArray) === false) {
            dataAsArray = [ data ];
        }
        return storeNumbers(scratchKey, label, dataAsArray);
    }
    case 'images':
        return storeImages(scratchKey, label, data as string);
    case 'imgtfjs':
        return storeImages(scratchKey, label, data as string);
    case 'sounds':
        return storeSound(scratchKey);
    }
}
