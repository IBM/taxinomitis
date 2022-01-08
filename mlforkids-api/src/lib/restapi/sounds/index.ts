// external dependencies
import * as Express from 'express';
// local dependencies
import registerSoundsUploadApi from './uploads';
import registerSoundsDownloadApi from './downloads';

export default function registerApis(app: Express.Application): void
{
    registerSoundsUploadApi(app);
    registerSoundsDownloadApi(app);
}
