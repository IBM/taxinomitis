// external dependencies
import * as Express from 'express';
import * as uuid from 'uuid/v4';
// local dependencies
import * as Types from '../../imagestore/types';



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
