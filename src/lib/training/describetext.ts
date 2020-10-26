// external dependencies
import syllable = require('syllable');
import nlp = require('compromise');
import nlpnum = require('compromise-numbers');
// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as random from '../utils/random';
import * as bagofwords from '../utils/bagofwords';
import * as emoticons from '../utils/emoticons';



const nlpFunctions: any = nlp.extend(nlpnum);



function getTrainingExampleWordCounts(trainingExampleText: string, bowDictionary: string[]): TextModelTrainingAnnotation[] {
    const trainingExampleWords = bagofwords.tokenize(trainingExampleText);

    const trainingExampleWordCounts: { [word: string]: number } = {};
    for (const word of trainingExampleWords) {
        if (bowDictionary.includes(word)) {
            if (!(word in trainingExampleWordCounts)) {
                trainingExampleWordCounts[word] = 0;
            }
            trainingExampleWordCounts[word] += 1;
        }
    }

    if (Object.keys(trainingExampleWordCounts).length < 2) {
        const wordsToAdd = bagofwords.getMostCommonWords([ trainingExampleText ], 2);
        for (const wordToAdd of wordsToAdd) {
            trainingExampleWordCounts[wordToAdd.word] = wordToAdd.count;
        }
    }

    let zeroWordIndex = 0;
    while (Object.keys(trainingExampleWordCounts).length < 10) {
        if (!(bowDictionary[zeroWordIndex] in trainingExampleWordCounts)) {
            trainingExampleWordCounts[bowDictionary[zeroWordIndex]] = 0;
        }
        zeroWordIndex += 1;
    }

    return Object.keys(trainingExampleWordCounts).map(word => {
        return {
            annotation : 'number of times that the word "' + word.toUpperCase() + '" appears',
            value : trainingExampleWordCounts[word],
        };
    });
}


function getCustomFeatures(trainingExampleText: string, emoticonsDictionary: string[]): TextModelTrainingAnnotation[] {
    return [
        // 1
        { annotation : 'number of letters', value : countLetters(trainingExampleText) },
        // 2
        { annotation : 'punctuation marks', value : countRegexMatches(trainingExampleText, PUNCTUATION_REGEX) },
        // 3
        { annotation : 'number of capital letters', value : countRegexMatches(trainingExampleText, CAPITALLETTER_REGEX) },
        // 4
        { annotation : 'syllables', value : syllable(trainingExampleText) },
        // 5
        { annotation : 'includes a question mark', value : containsQuestionMark(trainingExampleText) },
        // 6
        { annotation : 'number of verbs', value : nlpFunctions(trainingExampleText).verbs().json().length },
        // 7
        { annotation : 'number of emoticons', value : emoticons.countEmoticons(trainingExampleText, emoticonsDictionary) },
        // 8
        { annotation : 'mentions of numbers', value : nlpFunctions(trainingExampleText).numbers().json().length },
        // 9
        { annotation : 'usages of contractions', value : nlpFunctions(trainingExampleText).contractions().json().length },
    ];
}



function getTrainingExample(trainingdata: Objects.TextTraining, label: string, project: Objects.Project, bowDictionary: string[], emoticonsDictionary: string[]): TextModelTrainingExample {

    const trainingOutput: { [id: string]: number } = {};

    const example = {
        text: trainingdata.textdata,
        label,
        bagofwords : getTrainingExampleWordCounts(trainingdata.textdata, bowDictionary),
        customfeatures : getCustomFeatures(trainingdata.textdata, emoticonsDictionary),
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


async function getTrainingBagOfWords(project: Objects.Project): Promise<string[]> {
    const allTraining = await store.getTextTraining(project.id, { start : 0, limit : 1000 });
    const counts = bagofwords.getMostCommonWords(allTraining.map(t => t.textdata), 20);
    return counts.map(c => c.word);
}


export async function getModelVisualisation(project: Objects.Project): Promise<TextModelDescriptionResponse> {

    const bagOfWordsDictionary = await getTrainingBagOfWords(project);
    const emoticonsDictionary = emoticons.getAllKnownEmoticons();

    const EXAMPLES_PER_LABEL = 5;

    const examplesByLabel: { [label: string]: TextModelTrainingExample[] } = {};

    const labels = project.labels;
    for (const label of labels) {
        examplesByLabel[label] = [];

        const examples = await store.getTextTrainingByLabel(project.id, label, { start: 0, limit: EXAMPLES_PER_LABEL });
        examples.forEach((example) => {
            const trainingExample = getTrainingExample(example, label, project, bagOfWordsDictionary, emoticonsDictionary);
            examplesByLabel[label].push(trainingExample);
        });
    }

    const analysis: TextModelDescriptionResponse = { examples: [] };
    for (let i = 0; i < EXAMPLES_PER_LABEL; i++) {
        for (const label of labels) {
            if (examplesByLabel[label][i]) {
                analysis.examples.push(examplesByLabel[label][i]);
            }
        }
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
