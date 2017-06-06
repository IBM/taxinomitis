// external dependencies
import * as httpstatus from 'http-status';
import * as Express from 'express';
// local dependencies
import * as auth0 from '../auth0/users';
import * as auth from './auth';
import * as store from '../db/store';
import * as errors from './errors';
import loggerSetup from '../utils/logger';

const log = loggerSetup();


function getStudents(req: Express.Request, res: Express.Response) {
    return auth0.getStudents(req.params.classid)
        .then((students) => {
            res.json(students);
        })
        .catch((err) => {
            errors.unknownError(res, err);
        });
}


function createStudent(req: Express.Request, res: Express.Response) {
    const tenant: string = req.params.classid;
    if (req.body && req.body.username) {
        return auth0.createStudent(tenant, req.body.username)
            .then((newstudent) => {
                res.status(httpstatus.CREATED)
                    .json(newstudent);
            })
            .catch((err) => {
                res.status(err.response.body.statusCode)
                    .json(err.response.body);
            });
    }

    res.status(httpstatus.BAD_REQUEST)
        .send({ error : 'Missing required field "username"' });
}


async function deleteStudent(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const userid = req.params.studentid;

    try {
        await auth0.deleteStudent(tenant, userid);
        res.sendStatus(httpstatus.NO_CONTENT);
    }
    catch (err) {
        res.status(err.statusCode).json(err);
    }

    try {
        await store.deleteEntireUser(userid, tenant);
    }
    catch (err) {
        log.error({ err }, 'Failed to clean up projects for deleted user');
    }
}


function resetStudentPassword(req: Express.Request, res: Express.Response) {
    const tenant = req.params.classid;
    const userid = req.params.studentid;

    return auth0.resetStudentPassword(tenant, userid)
        .then((student) => {
            res.json(student);
        })
        .catch((err) => {
            res.status(err.statusCode)
                .json(err);
        });
}






export default function registerApis(app: Express.Application) {
    app.get('/api/classes/:classid/students',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        getStudents);

    app.post('/api/classes/:classid/students',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        createStudent);

    app.delete('/api/classes/:classid/students/:studentid',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        deleteStudent);

    app.post('/api/classes/:classid/students/:studentid/password',
        auth.authenticate,
        auth.checkValidUser,
        auth.requireSupervisor,
        resetStudentPassword);
}
