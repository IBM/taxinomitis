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

    const numbers: number[] = numbersStr.map(parseFloat);
    // check that we have only numbers to store
    if (numbers.some((num) => isNaN(num))) {
        throw new Error('Invalid data');
    }

    const project = await store.getProject(key.projectid);
    // check that we have the right number of numbers to store
    if (numbers.length !== project.fields.length) {
        throw new Error('Missing data');
    }

    // check that we have a label that is in the project
    if (project.labels.indexOf(label) === -1) {
        throw new Error('Invalid label');
    }

    // All looks good!

    return store.storeNumberTraining(project.id, numbers, label);
}



export function storeTrainingData(scratchKey: Types.ScratchKey, label: string, data: any): Promise<any>
{
    if (scratchKey.type === 'text') {
        return storeText(scratchKey, label, data);
    }
    else if (scratchKey.type === 'numbers') {
        let dataAsArray: string[] = data;
        if (data && Array.isArray(dataAsArray) === false) {
            dataAsArray = [ data ];
        }
        return storeNumbers(scratchKey, label, dataAsArray);
    }
    else {
        throw new Error('Not implemented yet');
    }
}
