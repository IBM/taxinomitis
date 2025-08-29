// external dependencies
import * as Express from 'express';
// local dependencies
import * as auth from './auth';
import * as urls from './urls';
import * as errors from './errors';
import * as ngrams from '../utils/ngrams';
import loggerSetup from '../utils/logger';

const log = loggerSetup();



async function generateNgrams(req: Express.Request, res: Express.Response) {
    log.info('handling ngram generation request');

    if (Object.keys(req.body).length > 1 ||
        typeof req.body !== 'object' ||
        !req.body.input ||
        !Array.isArray(req.body.input) ||
        !req.body.input.every((i: string) => typeof i === 'string'))
    {
        return errors.missingData(res);
    }

    const input: string[] = req.body.input;
    return res.json({
        bigrams    : ngrams.countNgrams(input, 2),
        trigrams   : ngrams.countNgrams(input, 3),
        tetragrams : ngrams.countNgrams(input, 4),
    });
}


export default function registerApis(app: Express.Application) {
    app.post(urls.PREPARE_NGRAMS,
             errors.expectsBody,
             auth.authenticate,
             auth.checkValidUser,
             generateNgrams);
}
