// external dependencies
import { NGrams, WordTokenizer } from 'natural';


const tokenizer = new WordTokenizer();

/**
 * Two forms of the ngrams should be generated:
 *  - lookup  - which should be complete, with every token in the input
 *  - summary - which is a sorted version of the most common tokens -
 *              SUMMARY_DEPTH defines the max number of tokens to include
 *              at each step in the summary
 */
export const SUMMARY_DEPTH = 15;


export function countNgrams(inputs: string[], idx: number): NgramData {
    const raw:UnsortedNgramCounts = { };

    for (const input of inputs) {
        const tokens = simpleTokenize(input);
        const tetragrams = NGrams.ngrams(tokens, idx, undefined, undefined, true);

        const rawCounts = tetragrams.frequencies;
        for (const rawTokenPair of Object.keys(rawCounts)) {
            const count = rawCounts[rawTokenPair];

            const separateTokens = breakApartTokens(rawTokenPair);

            let nextLevel = raw;

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

    const sorted = sort(raw);
    const count  = sumCounts(sorted);

    return {
        count,
        lookup  : createLookupTable(raw, 0, idx - 2),
        summary : generateCumulativeProbability(sorted, sumCounts(sorted), true),
    };
}




function createLookupTable (input: UnsortedNgramCounts, currentDepth: number, sortedCountsDepth: number): NgramLookupTable {
    const lookupBranch: NgramLookupTable = {};
    for (const tokenKey in input) {
        if (currentDepth === sortedCountsDepth) {
            const total = input[tokenKey].count;
            const leafItems = sort(input[tokenKey].next);
            const probs = generateCumulativeProbability(leafItems, total, false);
            const nextLeaf: NgramLookupTableLeafEntry[] = probs.map((i) => {
                return {
                    token   : i.token,
                    count   : i.count,
                    prob    : i.prob,
                    cumprob : i.cumprob
                };
            });
            lookupBranch[tokenKey] = {
                count : input[tokenKey].count,
                next  : nextLeaf
            };
        }
        else {
            const nextBranch: NgramLookupTableRootEntry = {
                count : input[tokenKey].count,
                next  : createLookupTable(input[tokenKey].next, currentDepth + 1, sortedCountsDepth),
            };
            lookupBranch[tokenKey] = nextBranch;
        }
    }
    return lookupBranch;
}


function roundForSummary(input: number): number {
    return Math.round(input * 1000) / 1000;
}


function sumCounts (input: SortedNgramCount[]) {
    return input.reduce((sum, item) => sum + item.count, 0);
}

function generateCumulativeProbability(input: SortedNgramCount[], count: number, isSummary: boolean): SortedNgramCountWithCumulativeProbabilities[] {
    let cumulativeProbability = 0.0;
    if (isSummary) {
        input = input.slice(0, SUMMARY_DEPTH);
    }
    return input.map((i) => {
        const probability = i.count / count;
        cumulativeProbability = Math.min(cumulativeProbability + probability, 1.0);
        return {
            token   : i.token,
            count   : i.count,
            prob    : isSummary ? roundForSummary(probability) : probability,
            cumprob : isSummary ? roundForSummary(cumulativeProbability) : cumulativeProbability,
            next    : generateCumulativeProbability(i.next, i.count, isSummary),
        };
    });
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

interface SortedNgramCount {
    token: string;
    count: number;
    next: SortedNgramCount[];
}

export interface SortedNgramCountWithCumulativeProbabilities {
    token: string;
    count: number;
    next: SortedNgramCountWithCumulativeProbabilities[];
    prob : number;
    cumprob : number;
}


export interface NgramLookupTableLeafEntry {
    token : string;
    count: number;
    prob : number;
    cumprob : number;
}

interface NgramLookupTableRootEntry {
    count : number;
    next  : NgramLookupTable | NgramLookupTableLeafEntry[]
}
export type NgramLookupTable = {[key:string]: NgramLookupTableRootEntry};


export interface NgramData {
    count:   number,
    lookup:  NgramLookupTable,
    summary: SortedNgramCountWithCumulativeProbabilities[],
}
