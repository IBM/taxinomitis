// external dependencies
import * as openwhisk from 'openwhisk';
// local dependencies
import Resize from './Resize';
import { ResizeParams } from './Requests';
import { HttpResponse } from './Responses';
import { log } from './Debug';


const STATES = {
    // initial null state
    NOT_INITIALIZED: 'NOT_INITIALIZED',

    // openwhisk client is intialised successfully
    //  so actions will be submitted using it
    RUN_OPENWHISK : 'RUN_OPENWHISK',

    // not able to initialise openwhisk client, so
    //  functions will be run locally
    RUN_LOCAL : 'RUN_LOCAL',
};


let state = STATES.NOT_INITIALIZED;
let ow: openwhisk.Client;




export function runResizeFunction(params: ResizeParams): Promise<HttpResponse> {
    if (state === STATES.NOT_INITIALIZED) {
        try {
            ow = openwhisk();
            state = STATES.RUN_OPENWHISK;
        }
        catch (err) {
            log('failed to init ow', err);
            state = STATES.RUN_LOCAL;
        }
    }


    if (state === STATES.RUN_LOCAL) {
        return Resize(params);
    }
    else {
        return ow.actions.invoke({
            name : 'mltraining-images/ResizeImage',
            blocking : true,
            result : true,
            params,
        }) as Promise<HttpResponse>;
    }
}
