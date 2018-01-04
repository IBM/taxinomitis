// external dependencies
import * as Express from 'express';
// local dependencies
import registerImagesUploadApi from './uploads';
import registerImagesDownloadApi from './downloads';
import registerImagesDeleteApis from './deletes';

export default function registerApis(app: Express.Application): void
{
    registerImagesUploadApi(app);
    // registerImagesDownloadApi(app);
    // registerImagesDeleteApis(app);
}
