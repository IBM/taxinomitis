// external dependencies
import * as jszip from 'jszip';
// local dependencies
import * as fileutils from '../utils/fileutils';

// App Inventor allows students to make apps for running on Android
// phones and tablets.
//
// https://github.com/kylecorry31/ML4K-AI-Extension provides an
// extension to App Inventor that adds blocks for calling
// Machine Learning for Kids APIs.
//
// This module generates a custom copy of that extension with the
// Scratch Key pre-inserted into it.


export async function getExtension(apikey: string): Promise<NodeJS.ReadableStream> {
    const filedata = await fileutils.readBuffer('./resources/appinventor-ml4k-v1.3.1.aix');

    // The extension aix file is a zip file, containing a text file that
    //  needs to have the API key written to it
    const zip = await jszip.loadAsync(filedata);

    zip.file('com.kylecorry.ml4k/assets/api.txt', apikey);

    return zip.generateNodeStream();
}
