// external dependencies
import * as request from 'request-promise';
import * as md5 from 'crypto-js/md5';
// local dependencies
import * as ScratchTypes from './scratchx-types';
import * as urls from '../restapi/urls';


// ---

function getBaseUrl(url: string): string {
    if (!url.startsWith('http')) {
        throw new Error('Invalid url');
    }
    if (url.endsWith('/model.json')) {
        return url.substr(0, url.lastIndexOf('/model.json'));
    }
    if (url.endsWith('/')) {
        return url.substr(0, url.length - 1);
    }
    return url;
}

function fetchMetadata(baseurl: string): Promise<ScratchTypes.TensorFlowJsMetadata> {
    const options = {
        uri: baseurl + '/metadata.json',
        qs: {
            'tfjs-format' : 'file'
        },
        json: true,
    };
    return request(options)
        .then((resp) => {
            return resp;
        });
}

export function getModelJsonUrl(modelinfo: ScratchTypes.ScratchTfjsExtension): string {
    return getBaseUrl(modelinfo.modelurl) + '/model.json';
}

export function getMetadata(modelinfo: ScratchTypes.ScratchTfjsExtension): Promise<ScratchTypes.TensorFlowJsMetadata> {
    return fetchMetadata(getBaseUrl(modelinfo.modelurl));
}


// ---

function generateId(modelinfo: ScratchTypes.ScratchTfjsExtension): ScratchTypes.ScratchTfjsExtensionWithId {
    return {
        ...modelinfo,
        id : md5(modelinfo.modelurl).toString(),
    };
}

// ---

function getModelTypeAsId(type: ScratchTypes.ScratchTfjsModelType): ScratchTypes.ScratchTfjsModelTypeId {
    switch (type) {
    case 'teachablemachineimage':
        return 10;
    case 'graphdefimage':
        return 11;
    case 'teachablemachinepose':
        return 12;
    default:
        return 99;
    }
}
function getModelTypeFromId(id: ScratchTypes.ScratchTfjsModelTypeId): ScratchTypes.ScratchTfjsModelType {
    if (id === 10) {
        return 'teachablemachineimage';
    }
    else if (id === 11) {
        return 'graphdefimage';
    }
    else if (id === 12) {
        return 'teachablemachinepose';
    }
    else {
        return 'unknown';
    }
}

// ---

function getEncodedInfo(modelinfo: ScratchTypes.ScratchTfjsExtension): ScratchTypes.ScratchTfjsExtensionEncoded {
    return {
        modelurl: modelinfo.modelurl,
        modeltypeid: getModelTypeAsId(modelinfo.modeltype),
    };
}
function getDecodedInfo(encodedinfo: ScratchTypes.ScratchTfjsExtensionEncoded): ScratchTypes.ScratchTfjsExtensionWithId {
    return generateId({
        modelurl: encodedinfo.modelurl,
        modeltype: getModelTypeFromId(encodedinfo.modeltypeid),
    });
}

// ---

function encode(modelinfo: ScratchTypes.ScratchTfjsExtension): string {
    return encodeURIComponent(JSON.stringify(getEncodedInfo(modelinfo)));
}
function decode(encoded: string): ScratchTypes.ScratchTfjsExtensionWithId {
    return getDecodedInfo(JSON.parse(decodeURIComponent(encoded)));
}

// ---

export function generateUrl(modelinfo: ScratchTypes.ScratchTfjsExtension): Promise<string> {
    if (modelinfo &&
        typeof modelinfo === 'object' &&
        modelinfo.modelurl && typeof modelinfo.modelurl === 'string' && modelinfo.modelurl.startsWith('http') &&
        modelinfo.modeltype && typeof modelinfo.modeltype === 'string')
    {
        return getMetadata(modelinfo)
            .then(() => {
                return urls.SCRATCHTFJS_EXTENSION.replace(':scratchkey', encode(modelinfo));
            });
    }
    else {
        return Promise.reject(new Error('Unexpected model info'));
    }
}
export function getModelInfoFromScratchKey(scratchkey: string): ScratchTypes.ScratchTfjsExtensionWithId {
    return decode(scratchkey);
}
