// external dependencies
import * as natural from 'natural';




const tokenizer = new natural.WordTokenizer();


export function tokenize(text: string): string[] {
    return tokenizer.tokenize(text)
        .map(w => w.toLowerCase())
        .filter(w => w !== 't' &&
                     w !== 'd' &&
                     w !== 's' &&
                     w !== 'the');
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









interface WordCount {
    readonly word: string;
    readonly count: number;
}

export interface SortedWordCount {
    readonly word: string;
    readonly count: number;
}
