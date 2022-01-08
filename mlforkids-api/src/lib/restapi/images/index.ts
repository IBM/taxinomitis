// external dependencies
import * as Express from 'express';
// local dependencies
import registerImagesUploadApi from './uploads';
import registerImagesDownloadApi from './downloads';

export default function registerApis(app: Express.Application): void
{
    registerImagesUploadApi(app);
    registerImagesDownloadApi(app);
}
