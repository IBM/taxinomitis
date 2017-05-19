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

export { typeLabels, typesById, typesByLabel };
