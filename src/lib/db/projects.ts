const TYPES = {
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

const typesById = {};
Object.keys(TYPES).forEach((label) => {
    const type = TYPES[label];
    typesById[type.id] = type;
});

const typeLabels: string[] = Object.keys(TYPES);
const typesByLabel = TYPES;

// ----

const FIELDTYPES = {
    number : {
        id : 1,
        label : 'number',
    },
    multichoice : {
        id : 2,
        label : 'multichoice',
    },
};

const fieldTypesById = {};
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
