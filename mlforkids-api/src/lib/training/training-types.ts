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

/**
 * Who owns a set of Watson credentials:
 *  'managed-pool' - ML4K site owner (must not be shared with tenant admin, stored in bluemixcredentialspool)
 *  'large-pool'   - ML4K site owner, for large trainings from classes without
 *                    keys of their own (stored in bluemixcredentialspool)
 *  'class'        - tenant admin    (stored in bluemixcredentials)
 */
export type CredentialSource = 'managed-pool' | 'large-pool' | 'class';
export type PoolCredentialSource = Exclude<CredentialSource, 'class'>;

/**
 * The pools of credentials in bluemixcredentialspool, and the
 *  poolid used for each one in the table.
 */
export const CREDENTIALS_POOL_IDS: { readonly [source in PoolCredentialSource]: number } = {
    'managed-pool' : 0,
    'large-pool'   : 1,
};

/**
 * Credentials read from one of the credentials tables, so it's
 *  known which one they came from.
 */
export interface StoredBluemixCredentials extends BluemixCredentials {
    readonly source: CredentialSource;
}

export interface BluemixCredentialsPool extends StoredBluemixCredentials {
    readonly source: PoolCredentialSource;
    // the last time that the credentials couldn't be used
    //  to create a ML model
    lastfail: Date;
}
export interface BluemixCredentialsPoolDbRow extends BluemixCredentialsDbRow {
    lastfail: Date;
    readonly poolid: number;
}


export type BluemixTextServiceType = 'conv' | 'txt';
export type BluemixServiceType = BluemixTextServiceType | 'num' | 'sounds' | 'imgtfjs';
export type BluemixCredentialsTypeLabel = 'unknown' | ConversationCredentialsTypeLabel;

export type ConversationCredentialsTypeLabel = 'conv_lite' | 'conv_standard' | 'conv_plus' | 'conv_plustrial';

export interface TextClassifier {
    readonly id: string;
    readonly workspace_id: string;
    readonly credentialsid: string;
    readonly servicetype: BluemixTextServiceType;
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
    readonly projectid: string;
    readonly userid: string;
    readonly classid: string;
    readonly url: string;
}
export interface NumbersClassifierDbRow {
    readonly projectid: string;
    readonly userid: string;
    readonly classid: string;
    readonly url: string;
}


export type CsvString = string;

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
