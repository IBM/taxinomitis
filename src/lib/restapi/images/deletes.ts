// external dependencies
import * as Express from 'express';
import * as httpStatus from 'http-status';
// local dependencies
import * as store from '../../imagestore';
import * as parse from './urlparse';
import * as urls from '../urls';
import loggerSetup from '../../utils/logger';

const log = loggerSetup();



/**
 * Sets up APIs required to allow image deletes - either individually or in bulk.
 */
export default function registerApis(app: Express.Application) {

    // register route handlers
    app.delete(urls.IMAGE,   handleDeleteImage);
    app.delete(urls.PROJECT, handleDeleteProject);
    app.delete(urls.USER,    handleDeleteUser);
    app.delete(urls.CLASS,   handleDeleteClass);
}



async function handleDeleteImage(req: Express.Request, res: Express.Response) {
    try {
        await store.deleteImage(parse.imageUrl(req));
        res.sendStatus(httpStatus.NO_CONTENT);
    }
    catch (err) {
        return returnDeleteError(res, err);
    }
}

async function handleDeleteProject(req: Express.Request, res: Express.Response) {
    try {
        await store.deleteProject(parse.projectUrl(req));
        res.sendStatus(httpStatus.NO_CONTENT);
    }
    catch (err) {
        return returnDeleteError(res, err);
    }
}

async function handleDeleteUser(req: Express.Request, res: Express.Response) {
    try {
        await store.deleteUser(parse.userUrl(req));
        res.sendStatus(httpStatus.NO_CONTENT);
    }
    catch (err) {
        return returnDeleteError(res, err);
    }
}

async function handleDeleteClass(req: Express.Request, res: Express.Response) {
    try {
        await store.deleteClass(parse.classUrl(req));
        res.sendStatus(httpStatus.NO_CONTENT);
    }
    catch (err) {
        return returnDeleteError(res, err);
    }
}







function returnDeleteError(res: Express.Response, err: Error) {
    log.error({ err }, 'Delete error');
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error : err.message,
        details : err,
    });
}
