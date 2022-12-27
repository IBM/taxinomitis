// external dependencies
import * as fs from 'fs';
// local dependencies
import * as dbobjects from '../db/db-types';
import * as store from '../db/store';
import * as fileutils from '../utils/fileutils';
import * as Types from './set-types';
import * as csv from './csv';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



export const ERRORS = {
    DATASET_DOES_NOT_EXIST : 'The requested dataset could not be found',
    INVALID_DATASET_ID : 'The requested dataset ID is not valid',
    UNEXPECTED_DATASET_TYPE : 'Cannot import projects using this dataset type',
};







export async function importDataset(userid: string, classid: string, options: Types.ImportOptions,
                                    type: dbobjects.ProjectTypeLabel,
                                    datasetid: string): Promise<Types.DatasetProject>
{
    log.debug({ type, datasetid, options }, 'Importing dataset');

    // get the location of the dataset (and confirm it exists)
    const location = await getDatasetLocation(type, datasetid);

    // read the dataset in as an object
    const dataset = await fileutils.readJson(location);
    const datasetjson = dataset as Types.TextDataset | Types.NumbersDataset | Types.ImagesDataset;

    // prepare the project for importing
    const project = await createProject(userid, classid, options.crowdsourced, type, datasetjson);

    // import the data into the project
    await importDataIntoProject(project, options, datasetjson);

    return project;
}




const VALID_DATASET_IDS = /^[a-z0-9-]{1,30}$/;




/**
 * Gets the location of the specified dataset.
 * This will confirm that the dataset exists and is readable.
 *
 * @param type - type of project the dataset is for (e.g. text, images)
 * @param datasetid - unique ID for the dataset (this is the name of the file it is stored in)
 */
function getDatasetLocation(type: dbobjects.ProjectTypeLabel, datasetid: string): Promise<string>
{
    return new Promise((resolve, reject) => {
        if (VALID_DATASET_IDS.test(datasetid) === false) {
            const errorObj = new Error(ERRORS.INVALID_DATASET_ID) as any;
            errorObj.statusCode = 400;
            return reject(errorObj);
        }

        const location = './resources/datasets/' + type + '/' + datasetid + '.json';
        fs.access(location, fs.constants.R_OK, (err) => {
            if (err) {
                log.error({ err, location }, 'Failed to access dataset');
                const errorObj = new Error(ERRORS.DATASET_DOES_NOT_EXIST) as any;
                errorObj.statusCode = 400;
                return reject(errorObj);
            }
            return resolve(location);
        });
    });
}









async function createProject(userid: string, classid: string, crowdsource: boolean,
                             type: dbobjects.ProjectTypeLabel,
                             dataset: Types.TextDataset | Types.NumbersDataset | Types.ImagesDataset,
                            ): Promise<Types.DatasetProject>
{
    let language: dbobjects.TextProjectLanguage = 'en';
    let fields: dbobjects.NumbersProjectFieldSummary[] = [];
    const labels = Object.keys(dataset.data);

    if (type === 'text') {
        const textdataset = dataset as Types.TextDataset;
        language = textdataset.metadata.language;
    }
    else if (type === 'numbers') {
        const numbersdataset = dataset as Types.NumbersDataset;
        fields = numbersdataset.metadata.fields;
    }

    const project = await store.storeProject(userid, classid,
                                             type,
                                             dataset.metadata.name,
                                             language,
                                             fields,
                                             crowdsource);

    project.labels = await store.replaceLabelsForProject(userid, classid, project.id, labels);

    return project;
}


// warning: modifies the input array
function shuffle(items: any[]): any[] {
    // fisher-yates
    items.reverse().forEach((item, i) => {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    });
    return items;
}





function importDataIntoProject(project: Types.DatasetProject, options: Types.ImportOptions,
                               dataset: Types.TextDataset | Types.NumbersDataset | Types.ImagesDataset,
                              ): Promise<void>
{
    if (project.type === 'text') {
        const training = getTextDataToImport(dataset as Types.TextDataset);
        if (training.length > 0)
        {
            // only shuffle if we're planning to hold out a test set
            if (options.testratio > 0) {
                // randomize the training data from the json file
                shuffle(training);

                // split into "training" and "testItems"
                const numTestItems = Math.round((options.testratio / 100) * training.length);
                const testItems = training.splice(0, numTestItems);

                // get test data to return
                csv.addTextDataForTesting(project, testItems);
            }
        }

        // check again in case we're using 100% of the data for testing
        if (training.length > 0) {
            return store.bulkStoreTextTraining(project.id, training);
        }
        else {
            // no data to import
            return Promise.resolve();
        }
    }
    else if (project.type === 'numbers') {
        const training = getNumbersDataToImport(dataset as Types.NumbersDataset);
        if (training.length > 0)
        {
            // only shuffle if we're planning to hold out a test set
            if (options.testratio > 0) {
                // randomize the training data from the json file
                shuffle(training);

                // split into "training" and "testItems"
                const numTestItems = Math.round((options.testratio / 100) * training.length);
                const testItems = training.splice(0, numTestItems);

                // get test data to return
                csv.addNumbersDataForTesting(project, testItems);
            }
        }

        // check again in case we're using 100% of the data for testing
        if (training.length > 0) {
            return store.bulkStoreNumberTraining(project.id, training);
        }
        else {
            return Promise.resolve();
        }
    }
    else if (project.type === 'imgtfjs') {
        const training = getImageDataToImport(dataset as Types.ImagesDataset);
        if (training.length > 0)
        {
            // only shuffle if we're planning to hold out a test set
            if (options.testratio > 0) {
                // randomize the training data from the json file
                shuffle(training);

                // split into "training" and "testItems"
                const numTestItems = Math.round((options.testratio / 100) * training.length);
                const testItems = training.splice(0, numTestItems);

                // get test data to return
                csv.addImageDataForTesting(project, testItems);
            }
        }

        // check again in case we're using 100% of the data for testing
        if (training.length > 0) {
            return store.bulkStoreImageTraining(project.id, training);
        }
        else {
            return Promise.resolve();
        }
    }
    else {
        const failure = new Error(ERRORS.UNEXPECTED_DATASET_TYPE) as any;
        failure.statusCode = 400;
        throw failure;
    }
}








/** Restructure the dataset into a flat list of text items to store. */
function getTextDataToImport(dataset: Types.TextDataset): {textdata: string, label: string}[] {
    const training: {textdata: string, label: string}[] = [];

    const labels = Object.keys(dataset.data);
    for (const label of labels) {
        const items = dataset.data[label];
        for (const item of items) {
            training.push({
                label,
                textdata: item,
            });
        }
    }

    return training;
}


/** Restructure the dataset into a flat list of number items to store. */
function getNumbersDataToImport(dataset: Types.NumbersDataset): {numberdata: number[], label: string}[] {
    const training: {numberdata: number[], label: string}[] = [];

    const key = dataset.metadata.fields.map((field) => {
        if (field.type === 'multichoice' && field.choices) {
            return field.choices.reduce((keymap: any, item, idx) => {
                keymap[item] = idx;
                return keymap;
            }, {});
        }
        else {
            return {};
        }
    });

    const labels = Object.keys(dataset.data);
    for (const label of labels) {
        const items = dataset.data[label];
        for (const item of items) {
            training.push({
                label,
                numberdata: item.map((val, idx) => {
                    if (dataset.metadata.fields[idx].type === 'multichoice' &&
                        dataset.metadata.fields[idx].choices)
                    {
                        return key[idx][val];
                    }
                    else {
                        return val;
                    }
                }),
            });
        }
    }

    return training;
}

/** Restructure the dataset into a flat list of image url items to store. */
function getImageDataToImport(dataset: Types.ImagesDataset): {imageurl: string, label: string}[] {
    const training: {imageurl: string, label: string}[] = [];

    const labels = Object.keys(dataset.data);
    for (const label of labels) {
        const items = dataset.data[label];
        for (const item of items) {
            training.push({
                label,
                imageurl: item,
            });
        }
    }

    return training;
}
