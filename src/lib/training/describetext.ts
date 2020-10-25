// external dependencies
import syllable = require('syllable');
// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as random from '../utils/random';



function getTrainingExample(trainingdata: Objects.TextTraining, label: string, project: Objects.Project): TextModelTrainingExample {

    const trainingOutput: { [id: string]: number } = {};

    const example = {
        text: trainingdata.textdata,
        label,
        bagofwords : [
            { annotation : 'number of times that the word "HEADLINE" appears', value : 1 },
            { annotation : 'number of times that the word "FURY" appears', value : 0 },
            { annotation : 'LONDON', value : 0 },
            { annotation : 'GO', value : 1 },
            { annotation : 'WILL', value : 1 },
            { annotation : 'OPEN', value : 0 },
            { annotation : 'PLACEHOLDER', value : 1 },
            { annotation : 'TESTING', value : 0 },
            { annotation : 'VALUES', value : 0 },
            { annotation : 'QUEEN', value : 0 },
        ],
        customfeatures : [
            { annotation : 'number of letters', value : countLetters(trainingdata.textdata) },
            { annotation : 'punctuation marks', value : countRegexMatches(trainingdata.textdata, PUNCTUATION_REGEX) },
            { annotation : 'number of capital letters', value : countRegexMatches(trainingdata.textdata, CAPITALLETTER_REGEX) },
            { annotation : 'syllables', value : syllable(trainingdata.textdata) },
            { annotation : 'includes numbers', value : 0 },
            { annotation : 'has an email address', value : 0 },
            { annotation : 'includes web address', value : 0 },
            { annotation : 'includes a question mark', value : containsQuestionMark(trainingdata.textdata) },
            { annotation : 'starts with a capital letter', value : isFirstLetterIsCapital(trainingdata.textdata) },
        ],
        random : [
            { annotation : '', value : random.int(1, 5) },
            { annotation : '', value : random.int(1, 5) },
            { annotation : '', value : random.int(0, 5) },
            { annotation : '', value : random.int(1, 5) },
            { annotation : '', value : random.int(0, 5) },
            { annotation : '', value : random.int(0, 5) },
            { annotation : '', value : random.int(0, 5) },
            { annotation : '', value : random.int(1, 5) },
            { annotation : '', value : random.int(0, 5) },
            { annotation : '', value : random.int(1, 5) },
        ],
        output: trainingOutput,
    };

    const scores = random.ints(project.labels.length);
    for (let i = 0; i < project.labels.length; i++) {
        const projectlabel = project.labels[i];
        example.output[projectlabel] = scores[i];
    }

    return example;
}


export async function getModelVisualisation(project: Objects.Project): Promise<TextModelDescriptionResponse> {

    const analysis: TextModelDescriptionResponse = {
        examples: [],
    };

    const labels = project.labels;
    for (const label of labels) {
        const examples = await store.getTextTrainingByLabel(project.id, label, { start: 0, limit: 5 });
        examples.forEach((example) => {
            const trainingExample = getTrainingExample(example, label, project);
            analysis.examples.push(trainingExample);
        });
    }

    return analysis;
}



function countLetters(text: string): number {
    return text.length;
}

const PUNCTUATION_REGEX = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g;
const QUESTIONMARK_REGEX = /[?]/g;
const CAPITALLETTER_REGEX = /[A-Z]/g;


function countRegexMatches(text: string, regex: RegExp): number {
    return ((text || '').match(regex) || []).length;
}
function containsQuestionMark(text: string): number {
    return QUESTIONMARK_REGEX.test(text) ? 1 : 0;
}


function isFirstLetterIsCapital(text: string): number {
    return /[A-Z]/.test(text[0]) ? 1 : 0;
}



export interface TextModelDescriptionResponse {
    readonly examples: TextModelTrainingExample[];
}

interface TextModelTrainingExample {
    readonly text: string;
    readonly label: string;
    readonly bagofwords: TextModelTrainingAnnotation[];
    readonly customfeatures : TextModelTrainingAnnotation[];
    readonly random: TextModelTrainingAnnotation[];
    readonly output: { [id: string]: number };
}

interface TextModelTrainingAnnotation {
    readonly annotation: string;
    readonly value: number;
}
