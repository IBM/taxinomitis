import * as DbTypes from '../db/db-types';


export interface Status {
    readonly status: number;
    readonly msg: string;
    readonly type: DbTypes.ProjectTypeLabel;
}

export interface Key {
    readonly id: string;
    readonly model?: string;
}

export type ScratchTfjsModelType = 'teachablemachineimage' |
                                   'teachablemachinepose' |
                                   'graphdefimage' |
                                   'unknown';
export type ScratchTfjsModelTypeId = 10 | 11 | 12 | 99;


export interface ScratchTfjsExtensionEncoded {
    readonly modelurl: string;
    readonly modeltypeid: ScratchTfjsModelTypeId;
}

export interface ScratchTfjsExtension {
    readonly modelurl: string;
    modeltype: ScratchTfjsModelType;
}

export interface ScratchTfjsExtensionWithId extends ScratchTfjsExtension {
    readonly id: string;
}

export interface TensorFlowJsMetadata {
    readonly labels: string[];
    readonly modelName: string;
    readonly packageName: string;
    readonly packageVersion: string;
    readonly timeStamp: string;
}
