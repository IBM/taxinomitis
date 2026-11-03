/* eslint-disable no-unused-vars */

import * as TrainingObjects from '../training/training-types';
import * as ObjectStoreTypes from '../objectstore/types';

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
    readonly iscrowdsourced: boolean;
}

export interface LocalProject {
    readonly id: string;
    readonly name: string;
    readonly userid: string;
    readonly classid: string;
    readonly type: ProjectTypeLabel;
    labels: string[];
    expiry: Date;
}
export interface LocalProjectDbRow {
    readonly id: string;
    readonly name: string;
    readonly userid: string;
    readonly classid: string;
    readonly typeid: number;
    readonly labels: string;
    readonly expiry: Date;
}

export type ProjectTypeLabel = 'text' | 'numbers' | 'images' | 'sounds' | 'imgtfjs';
export type LocalProjectTypeLabel = ProjectTypeLabel | 'regression';

export const MAX_LABEL_LENGTH = 30;

export interface ProjectType {
    readonly id: number;
    readonly label: ProjectTypeLabel;
}

export type TextProjectLanguage = 'en' | 'ar' | 'zh-tw' | 'zh-cn' |
                                  'cs' | 'nl' | 'fr' | 'de' | 'it' |
                                  'ja' | 'ko' | 'pt-br' | 'es' | 'xx';

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
    // only expected if isstored is true
    readonly userid?: string;
}

export interface ImageTrainingDbRow {
    readonly id: string;
    readonly imageurl: string;
    readonly label?: string;
    readonly projectid?: string;
    readonly isstored: number;
}

export interface SoundTraining {
    readonly id: string;
    readonly audiourl: string;
    readonly label: string;
    readonly projectid: string;
}

export interface SoundTrainingDbRow {
    readonly id: string;
    readonly audiourl: string;
    readonly label: string;
    readonly projectid: string;
}


export interface TextClassifierHead {
    readonly id: string;
    readonly projectid: string;
    readonly userid: string;
    readonly head: Buffer;
    readonly updated: Date;
}

export interface TextClassifierHeadDbRow {
    readonly id: string;
    readonly projectid: string;
    readonly userid: string;
    readonly head: Buffer;
    readonly updated: Date;
}

export interface TextClassifierTrainingState {
    readonly id: string;
    readonly hashead: boolean;
    readonly updated: Date;
    readonly trainingstarted?: Date;
    readonly trainingfailed?: Date;
}

export interface TextClassifierTrainingStateDbRow {
    readonly id: string;
    readonly hashead: boolean;
    readonly updated: Date;
    readonly trainingstarted: Date | null;
    readonly trainingfailed: Date | null;
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
    DeleteOneObjectFromObjectStorage      = 1,
    DeleteProjectObjectsFromObjectStorage = 2,
    DeleteUserObjectsFromObjectStorage    = 3,
    DeleteClassObjectsFromObjectStorage   = 4,
}

export type PendingJobData = ObjectStoreTypes.ObjectStoreSpec;



export interface PagingOptions {
    readonly start: number;
    readonly limit: number;
}



export enum ClassTenantType {
    // teacher provides and manages their own Watson credentials
    UnManaged        = 0,
    // dedicated private Watson credentials provided by site-administrator
    Managed          = 1,
    // using shared pool of Watson credentials
    ManagedPool      = 2,
}

export interface ClassTenant {
    readonly id: string;
    readonly supportedProjectTypes: ProjectTypeLabel[];
    readonly tenantType: ClassTenantType;
    //
    readonly maxUsers: number;
    readonly maxProjectsPerUser: number;
    //
    textClassifierExpiry: number;
}

export interface ClassDbRow {
    readonly id: string;
    readonly projecttypes: string;
    readonly maxusers: number;
    readonly maxprojectsperuser: number;
    readonly textclassifiersexpiry: number;
    readonly ismanaged: ClassTenantType;
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






export type SiteAlertSeverityLabel = 'error' | 'warning' | 'info';
export type SiteAlertAudienceLabel = 'supervisor' | 'student' | 'public';

export interface SiteAlert {
    readonly timestamp: Date;
    readonly severity: SiteAlertSeverityLabel;
    readonly audience: SiteAlertAudienceLabel;
    readonly message: string;
    readonly url: string;
    readonly expiry: Date;
}

export interface SiteAlertDbRow {
    readonly timestamp: Date;
    readonly severityid: number;
    readonly audienceid: number;
    readonly message: string;
    readonly url: string;
    readonly expiry: Date;
}






export type TextServiceUsageEventType = 'train-accept' | 'train-attempt' | 'train-end' | 'classify' | 'large-pool';

// what happened when a train request was answered
//   accepted  - a text service training started
//   duplicate - a text service training was already in progress
//   limit     - the student has too many models
//   large     - a new model was sent to Watson Assistant, as the training is large
//   move      - a text service model moved to Watson Assistant, as the training is large
//   invalid   - the training was turned away, as the text service wouldn't accept it
export type TextServiceTrainAcceptOutcome = 'accepted' | 'duplicate' | 'limit' | 'large' | 'move' | 'invalid';

export type TextServiceRequestFailureOutcome = 'timeout' | 'network' | '5xx' | 'other';

export type TextServiceTrainAttemptOutcome = 'ok' | 'busy' | 'starting' | 'invalid' | 'toolarge' | 'unauthorized' |
                                             TextServiceRequestFailureOutcome;

// how a text service training ended
//   available - the model was trained and stored
//   failed    - the training failed
//   discarded - the model was deleted, or a newer training started
//   shutdown  - the API instance shut down before the training finished
//   abandoned - the training didn't finish in time
export type TextServiceTrainEndOutcome = 'available' | 'failed' | 'discarded' | 'shutdown' | 'abandoned';

// how classifying with a text service model ended
//   ok          - classified by the text service, which had the model cached
//   cached-miss - classified by the text service, which needed the model's head
//   placeholder - a random answer, as the model is training (or its training failed)
export type TextServiceClassifyOutcome = 'ok' | 'cached-miss' | 'placeholder' | TextServiceRequestFailureOutcome;

// how a training using the large pool of Watson Assistant credentials ended
export type TextServiceLargePoolOutcome = 'ok' | 'exhausted' | 'other';

// where a request came from
//   website    - the main ML for Kids site
//   scratchkey - the Scratch key API (used by Scratch, Python, App Inventor, etc.)
export type TextServiceUsageSource = 'website' | 'scratchkey';

export interface TextServiceUsageClient {
    readonly source: TextServiceUsageSource;
    // two-letter country code, from the edge worker
    readonly country?: string;
}

export interface TextServiceTrainingSize {
    readonly labels: number;
    readonly examples: number;
    // Unicode code points in the examples
    readonly chars: number;
    // chars, weighted by the language
    readonly weightedchars: number;
}

export interface TextServiceUsageEvent {
    readonly recorded: Date;
    readonly event: TextServiceUsageEventType;
    readonly outcome: string;
    readonly region?: string;
    readonly projectid?: string;
    readonly modelid?: string;
    readonly tenanttype?: ClassTenantType;
    readonly language?: string;
    readonly size?: Partial<TextServiceTrainingSize>;
    readonly durationms?: number;
    readonly totalms?: number;
    readonly attempt?: number;
    readonly retryafterms?: number;
    readonly client?: TextServiceUsageClient;
}

export interface TextServiceUsageEventDbRow {
    readonly id: number;
    readonly recorded: Date;
    readonly event: TextServiceUsageEventType;
    readonly outcome: string;
    readonly region: string | null;
    readonly country: string | null;
    readonly projectid: string | null;
    readonly modelid: string | null;
    readonly tenanttype: number | null;
    readonly language: string | null;
    readonly examples: number | null;
    readonly chars: number | null;
    readonly weightedchars: number | null;
    readonly labels: number | null;
    readonly durationms: number | null;
    readonly totalms: number | null;
    readonly attempt: number | null;
    readonly retryafter: number | null;
    readonly source: TextServiceUsageSource | null;
}
