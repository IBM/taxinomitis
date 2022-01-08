import * as dbtypes from '../db/db-types';


interface DatasetMetadata {
    readonly name: string;
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
