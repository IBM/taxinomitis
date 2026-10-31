// local dependencies
import * as conversation from './conversation';
import * as DbObjects from '../db/db-types';
import * as TrainingObjects from './training-types';



export const ERROR_MESSAGES = {
    UNKNOWN : 'Failed to train machine learning model',
    MODEL_NOT_FOUND : 'Your machine learning model could not be found on the training server.',
    TEXT_TOO_LONG : 'text cannot be longer than 2048 characters',
    TEXT_NOT_PLAIN : 'Text to classify must be plain text',
    SERVICE_ERROR : 'The cloud service that runs your machine learning model reported an unexpected error',
};



export function trainClassifier(
    project: DbObjects.Project,
): Promise<TrainingObjects.ConversationWorkspace>
{
    return conversation.trainClassifier(project);
}


export function trainClassifierForProject(
    project: DbObjects.Project | DbObjects.LocalProject,
    training: TrainingObjects.ConversationTrainingData,
): Promise<TrainingObjects.ConversationWorkspace>
{
    return conversation.trainClassifierForProject(project, training);
}


export function deleteClassifier(tenant: DbObjects.ClassTenant, classifier: TrainingObjects.ConversationWorkspace): Promise<void>
{
    return conversation.deleteClassifier(tenant, classifier);
}


export function getClassifierStatuses(
    tenant: DbObjects.ClassTenant,
    workspaces: TrainingObjects.ConversationWorkspace[],
): Promise<TrainingObjects.ConversationWorkspace[]>
{
    return conversation.getClassifierStatuses(tenant, workspaces);
}


export function getStatus(
    credentials: TrainingObjects.BluemixCredentials,
    workspace: TrainingObjects.ConversationWorkspace,
): Promise<TrainingObjects.ConversationWorkspace>
{
    return conversation.getStatus(credentials, workspace);
}


export function testClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    classifierId: string, classifierTimestamp: Date,
    projectid: string,
    text: string,
): Promise<TrainingObjects.Classification[]>
{
    return conversation.testClassifier(credentials, classifierId, classifierTimestamp, projectid, text);
}


export function cleanupExpiredClassifiers(): Promise<void[]>
{
    return conversation.cleanupExpiredClassifiers();
}


export function validateTraining(obj: TrainingObjects.ConversationTrainingData): boolean
{
    return conversation.validateTraining(obj);
}


export function isPlainTextTraining(obj: TrainingObjects.ConversationTrainingData): boolean
{
    return conversation.isPlainTextTraining(obj);
}


export function sanitizeTraining(obj: TrainingObjects.ConversationTrainingData): TrainingObjects.ConversationTrainingData
{
    return conversation.sanitizeTraining(obj);
}


export function getLabelNamesFromTraining(obj: TrainingObjects.ConversationTrainingData): string[]
{
    return conversation.getLabelNamesFromTraining(obj);
}


export function normalizeText(text: string): string
{
    return conversation.normalizeText(text);
}
