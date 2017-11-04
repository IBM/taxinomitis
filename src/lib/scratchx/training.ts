// local dependencies
import * as store from '../db/store';
import * as Types from '../db/db-types';




async function storeText(key: Types.ScratchKey, label: string, textStr: string): Promise<Types.TextTraining>
{
    // check that we have some data to store
    if (!textStr || textStr.trim().length === 0) {
        throw new Error('Missing data');
    }

    const project = await store.getProject(key.projectid);

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
            const asNum = parseFloat(numbersStr[idx]);
            if (isNaN(asNum)) {
                throw new Error('Invalid data');
            }
            return asNum;
        }
    });

    // All looks good!

    return store.storeNumberTraining(project.id, numbers, label);
}



export function storeTrainingData(scratchKey: Types.ScratchKey, label: string, data: any): Promise<any>
{
    switch (scratchKey.type) {
    case 'text':
        return storeText(scratchKey, label, data);
    case 'numbers': {
        let dataAsArray: string[] = data;
        if (data && Array.isArray(dataAsArray) === false) {
            dataAsArray = [ data ];
        }
        return storeNumbers(scratchKey, label, dataAsArray);
    }
    case 'images':
        throw new Error('Not implemented yet');
    }
}
