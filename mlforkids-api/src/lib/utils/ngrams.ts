// external dependencies
import { NGrams, WordTokenizer } from 'natural';


const tokenizer = new WordTokenizer();


export function countNgrams(inputs: string[], idx: number): NgramData {
    const counts:UnsortedNgramCounts = { };

    for (const input of inputs) {
        const tokens = simpleTokenize(input);
        const tetragrams = NGrams.ngrams(tokens, idx, undefined, undefined, true);

        const rawCounts = tetragrams.frequencies;
        for (const rawTokenPair of Object.keys(rawCounts)) {
            const count = rawCounts[rawTokenPair];

            const separateTokens = breakApartTokens(rawTokenPair);

            let nextLevel = counts;

            for (let tokenIdx = 0; tokenIdx < separateTokens.length; tokenIdx += 1) {
                const token = separateTokens[tokenIdx];
                if (token in nextLevel === false) {
                    nextLevel[token] = { token, count : 0, next : {} };
                }
                nextLevel[token].count += count;

                nextLevel = nextLevel[token].next;
            }
        }
    }

    return {
        lookup : counts,
        sorted : sort(counts),
    };
}



function sort(input: UnsortedNgramCounts): SortedNgramCount[] {
    return Object.keys(input)
        .map((key) => input[key])
        .map((item) => {
            return {
                token : item.token,
                count : item.count,
                next : sort(item.next)
            };
        })
        .sort((a, b) => b.count - a.count);
}



function breakApartTokens(input: string): string[] {
    return input.replace(/[()]/g, '').split(', ');
}



function simpleTokenize(input: string): string[] {
    const PUNCTUATION_PLACEHOLDER = 'xxxxxSTOPxxxxx';
    const PUNCTUATION_PLACEHOLDER_PATTERN = ' ' + PUNCTUATION_PLACEHOLDER;
    const PUNCTUATION_TOKEN = '<STOP>';
    const S = 's';
    const APOSTROPHE_S = "'s";

    const PUNCTUATION_PATTERN = /[.!?]/g;
    return tokenizer
        .tokenize(input.replace(PUNCTUATION_PATTERN, PUNCTUATION_PLACEHOLDER_PATTERN))
        .flatMap((t) => {
            if (t === S) {
                return APOSTROPHE_S;
            }
            if (t === PUNCTUATION_PLACEHOLDER) {
                return PUNCTUATION_TOKEN;
            }
            if (t.startsWith(PUNCTUATION_PLACEHOLDER)) {
                return [
                    PUNCTUATION_TOKEN,
                    t.substring(PUNCTUATION_PLACEHOLDER.length)
                ];
            }
            return t;
        });
}





interface UnsortedNgramCount {
    token: string;
    count: number;
    next: UnsortedNgramCounts;
}
type UnsortedNgramCounts = {[key:string]: UnsortedNgramCount};

export interface SortedNgramCount {
    token: string;
    count: number;
    next: SortedNgramCount[];
}

export interface NgramData {
    lookup: UnsortedNgramCounts,
    sorted: SortedNgramCount[],
}
