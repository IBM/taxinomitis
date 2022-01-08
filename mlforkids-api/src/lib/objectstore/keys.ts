// local dependency
import { ObjectSpec, ProjectSpec, UserSpec, ClassSpec } from './types';

export const SEPARATOR = '/';


export function get(spec: ObjectSpec): string {
    return [
        spec.classid,
        spec.userid,
        spec.projectid,
        spec.objectid,
    ].join(SEPARATOR);
}

export function getProjectPrefix(spec: ProjectSpec): string {
    return [
        spec.classid,
        spec.userid,
        spec.projectid,
    ].join(SEPARATOR) + SEPARATOR;
}

export function getUserPrefix(spec: UserSpec): string {
    return [
        spec.classid,
        spec.userid,
    ].join(SEPARATOR) + SEPARATOR;
}

export function getClassPrefix(spec: ClassSpec): string {
    return [
        spec.classid,
    ].join(SEPARATOR) + SEPARATOR;
}



export function getProjectIdFromPrefix(projectPrefix: string): string {
    const chunks = projectPrefix.split(SEPARATOR);
    return chunks[chunks.length - 2];
}
export function getUserIdFromPrefix(userPrefix: string): string {
    const chunks = userPrefix.split(SEPARATOR);
    return chunks[chunks.length - 2];
}
