import * as TrainingObjects from '../training/training-types';

export interface Project {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly type: ProjectTypeLabel;
    name: string;
    labels: string[];
    fields: string[];
}
export interface ProjectDbRow {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly typeid: number;
    readonly name: string;
    readonly labels: string;
    readonly fields: string;
}

export type ProjectTypeLabel = 'text' | 'numbers' | 'images';

export const MAX_LABEL_LENGTH = 30;

export interface ProjectType {
    readonly id: number;
    readonly label: ProjectTypeLabel;
}


export interface TextTraining {
    readonly id: string;
    readonly textdata: string;
    label?: string;
    projectid?: string;
}

export interface TextTrainingDbRow {
    readonly id: string;
    readonly textdata: string;
    readonly label?: string;
    readonly projectid?: string;
}


export interface NumberTraining {
    readonly id: string;
    readonly numberdata: number[];
    label?: string;
    projectid?: string;
}

export interface NumberTrainingDbRow {
    readonly id: string;
    readonly numberdata: string;
    readonly label?: string;
    readonly projectid?: string;
}


export interface ImageTraining {
    readonly id: string;
    readonly imageurl: string;
    label?: string;
    projectid?: string;
}

export interface ImageTrainingDbRow {
    readonly id: string;
    readonly imageurl: string;
    readonly label?: string;
    readonly projectid?: string;
}



export interface ScratchKey {
    readonly id: string;
    readonly projectid: string;
    readonly name: string;
    readonly type: ProjectTypeLabel;
    readonly credentials?: TrainingObjects.BluemixCredentials;
    readonly classifierid?: string;
}

export interface ScratchKeyDbRow {
    readonly id: string;
    readonly projectid: string;
    readonly projectname: string;
    readonly projecttype: ProjectTypeLabel;
    readonly serviceurl: string;
    readonly serviceusername: string;
    readonly servicepassword: string;
    readonly classifierid: string;
}



export interface PagingOptions {
    readonly start: number;
    readonly limit: number;
}



export interface ClassTenant {
    readonly id: string;
    readonly supportedProjectTypes: ProjectTypeLabel[];
    //
    readonly maxUsers: number;
    readonly maxProjectsPerUser: number;
    //
    readonly textClassifierExpiry: number;
    readonly imageClassifierExpiry: number;
}

export interface ClassDbRow {
    readonly id: string;
    readonly projecttypes: string;
    readonly maxusers: number;
    readonly maxprojectsperuser: number;
    readonly textclassifiersexpiry: number;
    readonly imageclassifiersexpiry: number;
}
