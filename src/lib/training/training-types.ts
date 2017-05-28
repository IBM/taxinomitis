export interface BluemixCredentials {
    readonly id: string;
    readonly servicetype: BluemixServiceType;
    readonly url: string;
    readonly username: string;
    readonly password: string;
}
export interface BluemixCredentialsDbRow {
    readonly id: string;
    readonly servicetype: string;
    readonly url: string;
    readonly username: string;
    readonly password: string;
}

export type BluemixServiceType = 'nlc' | 'visrec';


export interface NLCClassifier {
    readonly classifierid: string;
    readonly url: string;
    readonly name: string;
    readonly language: string;
    readonly created: Date;
    status?: NLCStatus;
    statusDescription?: string;
}
export interface ClassifierDbRow {
    readonly id: string;
    readonly credentialsid: string;
    readonly userid: string;
    readonly projectid: string;
    readonly classid: string;
    readonly servicetype: string;
    readonly classifierid: string;
    readonly url: string;
    readonly name: string;
    readonly language: string;
    readonly created: Date;
}

export type NLCStatus = 'Non Existent' | 'Training' | 'Failed' | 'Available' | 'Unavailable';

export interface NLCClassification {
    readonly class_name: string;
    readonly confidence: number;
}

export interface File {
    readonly path: string;
}
