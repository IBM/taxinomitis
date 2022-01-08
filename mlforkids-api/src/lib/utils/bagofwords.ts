// external dependencies
import * as natural from 'natural';




const tokenizer = new natural.WordTokenizer();

const IGNORE_TOKENS = [
    't', 'd', 's', 'a', 'the', 'is',
];
function notAnIgnoredToken(token: string): boolean {
    return IGNORE_TOKENS.includes(token) === false;
}

export function tokenize(text: string): string[] {
    return tokenizer.tokenize(text)
        .map(w => w.toLowerCase())
        .filter(notAnIgnoredToken);
}

function countAllWords(texts: string[]): { [word: string]: number } {
    const allWords: { [word: string]: number } = {};
    for (const text of texts) {
        const words = tokenize(text);
        for (const word of words) {
            if (!(word in allWords)) {
                allWords[word] = 0;
            }
            allWords[word] += 1;
        }
    }
    return allWords;
}

function getWordCounts(texts: string[]): WordCount[] {
    const allWords = countAllWords(texts);
    const allCounts: WordCount[] = [];
    for (const word in allWords) {
        if (allWords.hasOwnProperty(word)) {
            allCounts.push({ word, count: allWords[word] });
        }
    }
    return allCounts;
}

const PADDING_WORDS = [
    'would',
    'water',
    'first',
    'long',
    'time',
    'made',
    'people',
    'there',
    'some',
    'word',
];

export function getMostCommonWords(texts: string[], num: number): SortedWordCount[] {
    const allWords = getWordCounts(texts);
    allWords.sort((x, y) => {
        if (x.count === y.count) {
            return 0;
        }
        return x.count < y.count ? 1 : -1;
    });
    const mostCommonWords = allWords.slice(0, num);
    for (let i = 0; i < PADDING_WORDS.length && mostCommonWords.length < num; i++) {
        const paddingWord = PADDING_WORDS[i];
        if (!(mostCommonWords.some(mcw => mcw.word === paddingWord))) {
            mostCommonWords.push({ word : paddingWord, count : 0 });
        }
    }
    return mostCommonWords;
}


export function getTrainingExampleWordCounts(trainingExampleText: string, bowDictionary: string[]): WordCount[] {
    const REQUIRED_MINIMUM = 10;

    const trainingExampleWords = tokenize(trainingExampleText);

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
        const wordsToAdd = getMostCommonWords([ trainingExampleText ], 2);
        for (const wordToAdd of wordsToAdd) {
            trainingExampleWordCounts[wordToAdd.word] = wordToAdd.count;
        }
    }

    let zeroWordIndex = 0;
    let dictionarySizeLimit = REQUIRED_MINIMUM;
    if (bowDictionary.length < dictionarySizeLimit) {
        dictionarySizeLimit = bowDictionary.length;
    }
    while (Object.keys(trainingExampleWordCounts).length < dictionarySizeLimit) { // } && zeroWordIndex < bowDictionary.length) {
        if (!(bowDictionary[zeroWordIndex] in trainingExampleWordCounts)) {
            trainingExampleWordCounts[bowDictionary[zeroWordIndex]] = 0;
        }
        zeroWordIndex += 1;
    }

    if (Object.keys(trainingExampleWordCounts).length < REQUIRED_MINIMUM) {
        zeroWordIndex = 0;
        const wordsToAdd = getMostCommonWords([ trainingExampleText ], REQUIRED_MINIMUM);
        while ((Object.keys(trainingExampleWordCounts).length < REQUIRED_MINIMUM) && (zeroWordIndex < wordsToAdd.length)) {
            const wordToAdd = wordsToAdd[zeroWordIndex];
            if (!(wordToAdd.word in trainingExampleWordCounts)) {
                trainingExampleWordCounts[wordToAdd.word] = wordToAdd.count;
            }
            zeroWordIndex += 1;
        }
    }

    return Object.keys(trainingExampleWordCounts).map(word => {
        return {
            word,
            count : trainingExampleWordCounts[word],
        };
    });
}






export interface WordCount {
    readonly word: string;
    readonly count: number;
}

export interface SortedWordCount {
    readonly word: string;
    readonly count: number;
}
