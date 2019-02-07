/* eslint-disable no-unused-vars */

import * as TrainingObjects from '../training/training-types';
import * as ObjectStoreTypes from '../imagestore/types';

export interface Project {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly type: ProjectTypeLabel;
    name: string;
    labels: string[];
    readonly language: TextProjectLanguage | '';
    readonly numfields: number;
    fields?: NumbersProjectFieldSummary[];
    readonly isCrowdSourced: boolean;
}
export interface ProjectDbRow {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly typeid: number;
    readonly name: string;
    readonly labels: string;
    readonly language: string;
    readonly numfields: number;
    readonly fields: NumbersProjectFieldDbRow[];
    readonly iscrowdsourced: number;
}

export type ProjectTypeLabel = 'text' | 'numbers' | 'images';

export const MAX_LABEL_LENGTH = 30;

export interface ProjectType {
    readonly id: number;
    readonly label: ProjectTypeLabel;
}

export type TextProjectLanguage = 'en' | 'ar' | 'zh-tw' | 'zh-cn' |
                                  'cs' | 'nl' | 'fr' | 'de' | 'it' |
                                  'ja' | 'ko' | 'pt-br' | 'es';

export interface NumbersProjectFieldSummary {
    readonly name: string;
    readonly type: NumbersProjectFieldTypeLabel;
    readonly choices?: string[];
}


export interface NumbersProjectField {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly projectid: string;
    readonly name: string;
    readonly type: NumbersProjectFieldTypeLabel;
    readonly choices: string[];
}
export interface NumbersProjectFieldDbRow {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly projectid: string;
    readonly name: string;
    readonly fieldtype: number;
    readonly choices?: string;
}

export type NumbersProjectFieldTypeLabel = 'number' | 'multichoice';



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
    isstored: boolean;
}

export interface ImageTrainingDbRow {
    readonly id: string;
    readonly imageurl: string;
    readonly label?: string;
    readonly projectid?: string;
    readonly isstored: number;
}



export interface ScratchKey {
    readonly id: string;
    readonly projectid: string;
    readonly name: string;
    readonly type: ProjectTypeLabel;
    readonly credentials?: TrainingObjects.BluemixCredentials;
    readonly classifierid?: string;
    readonly updated: Date;
}

export interface ScratchKeyDbRow {
    readonly id: string;
    readonly classid: string;
    readonly projectid: string;
    readonly projectname: string;
    readonly projecttype: ProjectTypeLabel;
    readonly serviceurl: string;
    readonly serviceusername: string;
    readonly servicepassword: string;
    readonly classifierid: string;
    readonly updated: Date;
}




export interface PendingJob {
    readonly id: string;
    readonly jobtype: PendingJobType;
    readonly jobdata: PendingJobData;
    attempts: number;
    lastattempt?: Date;
}

export interface PendingJobDbRow {
    readonly id: string;
    readonly jobtype: PendingJobType;
    readonly jobdata: string;
    readonly attempts: number;
    readonly lastattempt: Date;
}

export enum PendingJobType {
    DeleteOneImageFromObjectStorage      = 1,
    DeleteProjectImagesFromObjectStorage = 2,
    DeleteUserImagesFromObjectStorage    = 3,
    DeleteClassImagesFromObjectStorage   = 4,
}

export type PendingJobData = ObjectStoreTypes.ObjectStoreSpec;



export interface PagingOptions {
    readonly start: number;
    readonly limit: number;
}



export interface ClassTenant {
    readonly id: string;
    readonly supportedProjectTypes: ProjectTypeLabel[];
    readonly isManaged: boolean;
    //
    readonly maxUsers: number;
    readonly maxProjectsPerUser: number;
    //
    textClassifierExpiry: number;
    imageClassifierExpiry: number;
}

export interface ClassDbRow {
    readonly id: string;
    readonly projecttypes: string;
    readonly maxusers: number;
    readonly maxprojectsperuser: number;
    readonly textclassifiersexpiry: number;
    readonly imageclassifiersexpiry: number;
    readonly ismanaged: number;
}






export interface TemporaryUser {
    readonly id: string;
    readonly token: string;
    readonly sessionExpiry: Date;
}

export interface TemporaryUserDbRow {
    readonly id: string;
    readonly token: string;
    readonly sessionexpiry: Date;
}
