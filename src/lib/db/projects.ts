import * as DbTypes from './db-types';

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

const fieldTypesById: {[id: number]: FieldTypeInfo}  = {};
Object.keys(FIELDTYPES).forEach((label) => {
    const type = FIELDTYPES[label];
    fieldTypesById[type.id] = type;
});

const fieldTypeLabels: string[] = Object.keys(FIELDTYPES);
const fieldTypesByLabel = FIELDTYPES;

// ----


export {
    typeLabels, typesById, typesByLabel,
    fieldTypeLabels, fieldTypesById, fieldTypesByLabel,
};
