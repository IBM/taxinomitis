// external dependencies
import * as Express from 'express';
import * as uuid from 'uuid/v4';
// local dependencies
import * as Types from '../../imagestore/types';
import * as urls from '../../restapi/urls';



export function imageUrl(req: Express.Request): Types.ImageSpec {
    return {
        classid : req.params.classid,
        userid : req.params.studentid,
        projectid : req.params.projectid,
        imageid : req.params.imageid,
    };
}

export function imagesUrl(req: Express.Request): Types.ImageSpec {
    return {
        classid : req.params.classid,
        userid : req.params.studentid,
        projectid : req.params.projectid,
        imageid : uuid(),
    };
}

export function projectUrl(req: Express.Request): Types.ProjectSpec {
    return {
        classid : req.params.classid,
        userid : req.params.studentid,
        projectid : req.params.projectid,
    };
}

export function userUrl(req: Express.Request): Types.UserSpec {
    return {
        classid : req.params.classid,
        userid : req.params.studentid,
    };
}

export function classUrl(req: Express.Request): Types.ClassSpec {
    return {
        classid : req.params.classid,
    };
}

export function createImageUrl(params: Types.ImageSpec): string {
    return urls.IMAGE
            .replace(':classid', params.classid)
            .replace(':studentid', params.userid)
            .replace(':projectid', params.projectid)
            .replace(':imageid', params.imageid);
}
