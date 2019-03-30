import * as DbTypes from './db-types';
import * as TrainingTypes from '../training/training-types';

interface ProjectTypeInfo {
    readonly id: number;
    readonly label: DbTypes.ProjectTypeLabel;
}

const TYPES: {[s: string]: ProjectTypeInfo} = {
    text : {
        id : 1,
        label : 'text',
    },
    numbers : {
        id : 2,
        label : 'numbers',
    },
    images : {
        id : 3,
        label : 'images',
    },
    sounds : {
        id : 4,
        label : 'sounds',
    },
};

const typesById: {[id: number]: ProjectTypeInfo} = {};
Object.keys(TYPES).forEach((label) => {
    const type = TYPES[label];
    typesById[type.id] = type;
});

const typeLabels: string[] = Object.keys(TYPES);
const typesByLabel = TYPES;

// ----

interface FieldTypeInfo {
    readonly id: number;
    readonly label: DbTypes.NumbersProjectFieldTypeLabel;
}

const FIELDTYPES: {[s: string]: FieldTypeInfo} = {
    number : {
        id : 1,
        label : 'number',
    },
    multichoice : {
        id : 2,
        label : 'multichoice',
    },
};

const fieldTypesById: {[id: number]: FieldTypeInfo} = {};
Object.keys(FIELDTYPES).forEach((label) => {
    const type = FIELDTYPES[label];
    fieldTypesById[type.id] = type;
});

const fieldTypeLabels: string[] = Object.keys(FIELDTYPES);
const fieldTypesByLabel = FIELDTYPES;

// ----

interface CredsTypeInfo {
    readonly id: number;
    readonly label: TrainingTypes.BluemixCredentialsTypeLabel;
}

const CREDSTYPES: {[s: string]: CredsTypeInfo} = {
    unknown : {
        id : 0,
        label : 'unknown',
    },
    conv_lite : {
        id : 1,
        label : 'conv_lite',
    },
    conv_standard : {
        id : 2,
        label : 'conv_standard',
    },
    visrec_lite : {
        id : 3,
        label : 'visrec_lite',
    },
    visrec_standard : {
        id : 4,
        label : 'visrec_standard',
    },
};

const credsTypesById: {[id: number]: CredsTypeInfo} = {};
Object.keys(CREDSTYPES).forEach((label) => {
    const type = CREDSTYPES[label];
    credsTypesById[type.id] = type;
});

const credsTypeLabels: string[] = Object.keys(CREDSTYPES);
const credsTypesByLabel = CREDSTYPES;

// ----


export {
    typeLabels, typesById, typesByLabel,
    fieldTypeLabels, fieldTypesById, fieldTypesByLabel,
    credsTypeLabels, credsTypesById, credsTypesByLabel,
};
