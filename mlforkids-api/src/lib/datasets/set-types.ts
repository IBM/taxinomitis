import * as dbtypes from '../db/db-types';


interface DatasetMetadata {
    readonly name: string;
}


export interface DatasetProject extends dbtypes.Project {
    testdata?: any[];
}

export interface ImportOptions {
    /** true if the dataset should be imported as a class project */
    readonly crowdsourced: boolean;
    /** integer (0-100) that specifies what proportion of the dataset should be excluded from the training data and returned for use in testing */
    readonly testratio: number;
}


//
// ---
//

export interface TextDataset {
    readonly metadata: TextDatasetMetadata;
    readonly data: TextDatasetData;
}

interface TextDatasetMetadata extends DatasetMetadata {
    readonly language: dbtypes.TextProjectLanguage;
}

interface TextDatasetData {
    [label: string]: string[];
}


//
// ---
//


export interface NumbersDataset {
    readonly metadata: NumbersDatasetMetadata;
    readonly data: NumbersDatasetData;
}

interface NumbersDatasetMetadata extends DatasetMetadata {
    readonly fields: dbtypes.NumbersProjectFieldSummary[];
}

type NumbersDatasetDataItem = string | number;

interface NumbersDatasetData {
    [label: string]: NumbersDatasetDataItem[][];
}


//
// ---
//


export interface ImagesDataset {
    readonly metadata: DatasetMetadata;
    readonly data: ImagesDatasetData;
}

interface ImagesDatasetData {
    [label: string]: string[];
}
