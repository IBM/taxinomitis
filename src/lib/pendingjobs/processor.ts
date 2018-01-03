// local dependencies
import * as imagestore from '../imagestore';
import loggerSetup from '../utils/logger';
import * as Types from '../db/db-types';
import * as ImageTypes from '../imagestore/types';


const log = loggerSetup();



function fail(spec: Types.PendingJobData, expected: string): Error {
    log.error({ spec, expected }, 'Unexpected pending job data');
    return new Error('Missing required info in pending job');
}


function getImageSpec(spec: Types.PendingJobData): ImageTypes.ImageSpec {
    const check = spec as ImageTypes.ImageSpec;
    if (check.classid &&
        check.userid &&
        check.projectid &&
        check.imageid)
    {
        return check;
    }

    throw fail(spec, 'ImageSpec');
}

function getProjectSpec(spec: Types.PendingJobData): ImageTypes.ProjectSpec {
    const check = spec as ImageTypes.ProjectSpec;
    if (check.classid &&
        check.userid &&
        check.projectid)
    {
        return check;
    }

    throw fail(spec, 'ProjectSpec');
}

function getUserSpec(spec: Types.PendingJobData): ImageTypes.UserSpec {
    const check = spec as ImageTypes.UserSpec;
    if (check.classid &&
        check.userid)
    {
        return check;
    }

    throw fail(spec, 'UserSpec');
}

function getClassSpec(spec: Types.PendingJobData): ImageTypes.ClassSpec {
    const check = spec as ImageTypes.ClassSpec;
    if (check.classid)
    {
        return check;
    }

    throw fail(spec, 'ClassSpec');
}



export function processJob(job: Types.PendingJob): Promise<void> {

    switch (job.jobtype) {
    case Types.PendingJobType.DeleteOneImageFromObjectStorage:
        return imagestore.deleteImage(getImageSpec(job.jobdata));
    case Types.PendingJobType.DeleteProjectImagesFromObjectStorage:
        return imagestore.deleteProject(getProjectSpec(job.jobdata));
    case Types.PendingJobType.DeleteUserImagesFromObjectStorage:
        return imagestore.deleteUser(getUserSpec(job.jobdata));
    case Types.PendingJobType.DeleteClassImagesFromObjectStorage:
        return imagestore.deleteClass(getClassSpec(job.jobdata));
    default:
        log.error({ job }, 'Unrecognised pending job type');
        throw new Error('Unrecognised pending job type');
    }
}
