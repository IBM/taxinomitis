// local dependencies
import * as objectstore from '../objectstore';
import loggerSetup from '../utils/logger';
import * as Types from '../db/db-types';
import * as ObjectTypes from '../objectstore/types';


const log = loggerSetup();



function fail(spec: Types.PendingJobData, expected: string): Error {
    log.error({ spec, expected }, 'Unexpected pending job data');
    return new Error('Missing required info in pending job');
}


function getObjectSpec(spec: Types.PendingJobData): ObjectTypes.ObjectSpec {
    const check = spec as ObjectTypes.ObjectSpec;
    if (check.classid &&
        check.userid &&
        check.projectid &&
        check.objectid)
    {
        return check;
    }

    throw fail(spec, 'ImageSpec');
}

function getProjectSpec(spec: Types.PendingJobData): ObjectTypes.ProjectSpec {
    const check = spec as ObjectTypes.ProjectSpec;
    if (check.classid &&
        check.userid &&
        check.projectid)
    {
        return check;
    }

    throw fail(spec, 'ProjectSpec');
}

function getUserSpec(spec: Types.PendingJobData): ObjectTypes.UserSpec {
    const check = spec as ObjectTypes.UserSpec;
    if (check.classid &&
        check.userid)
    {
        return check;
    }

    throw fail(spec, 'UserSpec');
}

function getClassSpec(spec: Types.PendingJobData): ObjectTypes.ClassSpec {
    const check = spec as ObjectTypes.ClassSpec;
    if (check.classid)
    {
        return check;
    }

    throw fail(spec, 'ClassSpec');
}



export function processJob(job: Types.PendingJob): Promise<void> {

    switch (job.jobtype) {
    case Types.PendingJobType.DeleteOneObjectFromObjectStorage:
        return objectstore.deleteObject(getObjectSpec(job.jobdata));
    case Types.PendingJobType.DeleteProjectObjectsFromObjectStorage:
        return objectstore.deleteProject(getProjectSpec(job.jobdata));
    case Types.PendingJobType.DeleteUserObjectsFromObjectStorage:
        return objectstore.deleteUser(getUserSpec(job.jobdata));
    case Types.PendingJobType.DeleteClassObjectsFromObjectStorage:
        return objectstore.deleteClass(getClassSpec(job.jobdata));
    default:
        log.error({ job }, 'Unrecognised pending job type');
        throw new Error('Unrecognised pending job type');
    }
}
