/* eslint-disable no-unused-vars */

import * as DbTypes from '../db/db-types';

export interface BluemixCredentials {
    readonly id: string;
    readonly servicetype: BluemixServiceType;
    // not readonly, because we don't know what the correct URL is
    //  until after we've tried a few options
    url: string;
    readonly username: string;
    readonly password: string;
    readonly classid: string;
    // not readonly, because users can modify this
    credstype: BluemixCredentialsTypeLabel;
    notes?: string | null;
}
export interface BluemixCredentialsDbRow {
    readonly id: string;
    readonly servicetype: string;
    // not readonly, because we don't know what the correct URL is
    //  until after we've tried a few options
    url: string;
    readonly username: string;
    readonly password: string;
    readonly classid: string;
    readonly credstypeid?: number;
    notes?: string | null;
}

export type BluemixServiceType = 'conv' | 'visrec' | 'num' | 'sounds';
export type BluemixCredentialsTypeLabel = 'unknown' | ConversationCredentialsTypeLabel | VisualRecCredentialsTypeLabel;

export type ConversationCredentialsTypeLabel = 'conv_lite' | 'conv_standard';
export type VisualRecCredentialsTypeLabel = 'visrec_lite' | 'visrec_standard';

export interface ConversationWorkspace {
    readonly id: string;
    readonly workspace_id: string;
    readonly credentialsid: string;
    readonly url: string;
    readonly name: string;
    readonly language: DbTypes.TextProjectLanguage;
    readonly created: Date;
    expiry: Date;
    status?: ClassifierStatus;
    updated?: Date;
}


export interface ConversationTrainingData {
    readonly name: string;
    readonly language: DbTypes.TextProjectLanguage;
    readonly intents: ConversationIntent[];
    readonly entities: any[];
    readonly dialog_nodes: any[];
    readonly counterexamples: any[];
    readonly metadata: { [key: string]: string };
}
export interface ConversationIntent {
    readonly intent: string;
    readonly examples: ConversationIntentExample[];
}
interface ConversationIntentExample {
    readonly text: string;
}


/**
 * Type of credentials for the Watson Assistant service.
 *
 * 'legacy' refers to credentials created in regions outside au-syd,
 *           which use a username and password for authentication.
 * 'current' refers to credentials created after May 22 2018
 *            which use a bearer token request header for auth.
 */
export type ConversationCredsType = 'legacy' | 'current';


export interface VisualClassifier {
    readonly id: string;
    readonly classifierid: string;
    readonly credentialsid: string;
    readonly url: string;
    readonly name: string;
    readonly created: Date;
    expiry: Date;
    status?: VisualClassifierStatus;
}

export type VisualClassifierStatus = 'training' | 'ready' | 'Non Existent'| 'ERROR';

/**
 * Type of credentials for the Watson Visual Recognition service.
 *
 * 'legacy' refers to credentials created before May 22 2018,
 *           which use an API Key query parameter for authentication.
 * 'current' refers to credentials created after May 22 2018
 *            which use a bearer token request header for auth.
 */
export type VisualRecCredsType = 'legacy' | 'current';



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
    readonly expiry: Date;
}

export type ClassifierStatus = 'Non Existent' | 'Training' | 'Failed' | 'Available' | 'Unavailable';


export interface NumbersClassifier {
    readonly created: Date;
    readonly status: NumbersStatus;
    readonly classifierid: string;
    updated?: Date;
}
export interface NumbersClassifierDbRow {
    readonly userid: string;
    readonly projectid: string;
    readonly classid: string;
    readonly created: Date;
    readonly status: number;
}
export type NumbersStatus = 'Failed' | 'Available';



export interface Classification {
    readonly class_name: string;
    readonly confidence: number;

    // true if this was a randomly generated "classification"
    //  created while waiting for a classifier to be ready
    readonly random?: boolean;

    // the time that the classifier (which returned this
    //  classification) was trained
    // allows classifications to be cached by clients, with
    //  the cache expiring when there is a new classifier
    readonly classifierTimestamp: Date;
}

export interface File {
    readonly path: string;
}


export interface ClassifierSummary {
    readonly id: string;
    readonly name: string;
    readonly credentials: BluemixCredentials;
    readonly type: BluemixServiceType;
}








export enum KnownErrorCondition {
    UnmanagedBluemixClassifier = 1,
    BadBluemixCredentials = 2,
}

export interface KnownError {
    readonly id: string;
    readonly type: KnownErrorCondition;
    readonly servicetype: BluemixServiceType;
    readonly objid: string;
}

