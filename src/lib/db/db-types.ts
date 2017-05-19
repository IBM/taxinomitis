export interface Project {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly type: string;
    name: string;
    labels: string[];
}
export interface ProjectDbRow {
    readonly id: string;
    readonly userid: string;
    readonly classid: string;
    readonly typeid: number;
    readonly name: string;
    readonly labels: string;
}

type ProjectTypeLabel = 'text' | 'numbers' | 'images';

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


export interface PagingOptions {
    readonly start: number;
    readonly limit: number;
}
