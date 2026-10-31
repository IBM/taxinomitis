(function () {

    angular
        .module('app')
        .service('ngramsService', ngramsService);

    ngramsService.$inject = [];


    // counts n-grams in a toy language model corpus
    //
    // nothing is counted in advance. the corpus is stored as a list of
    //  token ids, with an index of where each token appears, and counts
    //  are worked out from that when they are asked for. 
    function ngramsService() {

        // marks the end of a document - n-grams don't cross documents
        const SEP = -1;

        // max number of tokens to include at each level of a summary
        const SUMMARY_DEPTH = 15;

        // max number of lookups to remember before starting again
        const MAX_CACHED_LOOKUPS = 5000;

        const WORD_GAPS = /[^A-Za-zА-Яа-я0-9_]+/;
        const PUNCTUATION_PATTERN = /[.!?]/g;
        const PUNCTUATION_PLACEHOLDER = 'xxxxxSTOPxxxxx';
        const PUNCTUATION_TOKEN = '<STOP>';

        function tokenize(input) {
            return input.replace(PUNCTUATION_PATTERN, ' ' + PUNCTUATION_PLACEHOLDER)
                .split(WORD_GAPS)
                .filter((t) => t !== '')
                .flatMap((t) => {
                    if (t === 's') {
                        return '\'s';
                    }
                    if (t === PUNCTUATION_PLACEHOLDER) {
                        return PUNCTUATION_TOKEN;
                    }
                    if (t.startsWith(PUNCTUATION_PLACEHOLDER)) {
                        return [ PUNCTUATION_TOKEN, t.substring(PUNCTUATION_PLACEHOLDER.length) ];
                    }
                    return t;
                });
        }

        function integerKeyOrder(token) {
            if (/^(0|[1-9][0-9]*)$/.test(token) && Number(token) < 4294967295) {
                return Number(token);
            }
            return Infinity;
        }


        function createModel(texts) {
            const vocab = [];
            const ids = new Map();
            const sequence = [];
            for (const text of texts) {
                for (const token of tokenize(text)) {
                    let id = ids.get(token);
                    if (id === undefined) {
                        id = vocab.length;
                        vocab.push(token);
                        ids.set(token, id);
                    }
                    sequence.push(id);
                }
                sequence.push(SEP);
            }
            const tokens = Int32Array.from(sequence);

            // positions of every token, grouped by token id
            //  positions of token id X are positions[offsets[X]] to positions[offsets[X + 1] - 1]
            const offsets = new Int32Array(vocab.length + 1);
            for (const id of tokens) {
                if (id !== SEP) {
                    offsets[id + 1] += 1;
                }
            }
            for (let i = 0; i < vocab.length; i++) {
                offsets[i + 1] += offsets[i];
            }
            const positions = new Int32Array(offsets[vocab.length]);
            const nextFree = offsets.slice(0, vocab.length);
            for (let p = 0; p < tokens.length; p++) {
                if (tokens[p] !== SEP) {
                    positions[nextFree[tokens[p]]++] = p;
                }
            }

            const intKeyOrder = vocab.map(integerKeyOrder);

            // reused by every call to countNextTokens
            const counts = new Int32Array(vocab.length);
            const firstSeen = new Int32Array(vocab.length);


            // finds every n-gram that starts with the context tokens, and
            //  counts the token that comes immediately after the context
            // returns the total, and the counts sorted most common first
            function countNextTokens(contextIds, n) {
                const k = contextIds.length;
                const seen = [];
                let total = 0;

                function countAt(p) {
                    for (let i = 1; i < k; i++) {
                        if (tokens[p + i] !== contextIds[i]) {
                            return;
                        }
                    }
                    for (let i = k; i < n; i++) {
                        if (p + i >= tokens.length || tokens[p + i] === SEP) {
                            return;
                        }
                    }
                    const next = tokens[p + k];
                    if (counts[next] === 0) {
                        firstSeen[next] = seen.length;
                        seen.push(next);
                    }
                    counts[next] += 1;
                    total += 1;
                }

                if (k === 0) {
                    for (let p = 0; p < tokens.length; p++) {
                        if (tokens[p] !== SEP) {
                            countAt(p);
                        }
                    }
                }
                else {
                    const first = contextIds[0];
                    for (let j = offsets[first]; j < offsets[first + 1]; j++) {
                        countAt(positions[j]);
                    }
                }

                const results = seen.map((id) => ({ id, count : counts[id] }));
                for (const id of seen) {
                    counts[id] = 0;
                }
                results.sort((a, b) => (b.count - a.count) ||
                                       (intKeyOrder[a.id] - intKeyOrder[b.id]) ||
                                       (firstSeen[a.id] - firstSeen[b.id]));
                return { total, results };
            }


            // total number of n-grams of length n
            const totals = {};
            function count(n) {
                if (!(n in totals)) {
                    totals[n] = countNextTokens([], n).total;
                }
                return totals[n];
            }

            // true if the corpus is too small to make any n-grams
            //  (if there are no bigrams, there can't be any longer n-grams)
            function isEmpty() {
                return count(2) === 0;
            }


            // the most common n-grams of length n, as a tree with up to
            //  SUMMARY_DEPTH tokens at each level, and probabilities rounded
            // the same object is returned every time for the same n
            const summaries = {};
            function summary(n) {
                if (!(n in summaries)) {
                    summaries[n] = summaryLevel([], n);
                }
                return summaries[n];
            }
            function summaryLevel(contextIds, n) {
                if (contextIds.length === n) {
                    return [];
                }
                const { total, results } = countNextTokens(contextIds, n);
                let cumprob = 0.0;
                return results.slice(0, SUMMARY_DEPTH).map((item) => {
                    const prob = item.count / total;
                    cumprob = Math.min(cumprob + prob, 1.0);
                    return {
                        token   : vocab[item.id],
                        count   : item.count,
                        prob    : roundForSummary(prob),
                        cumprob : roundForSummary(cumprob),
                        next    : summaryLevel(contextIds.concat(item.id), n),
                    };
                });
            }


            // every token that follows the context tokens, most common first
            //  e.g. lookup([ 'the', 'cat' ]) for the tokens that follow "the cat"
            const lookups = new Map();
            function lookup(contextTokens) {
                const key = contextTokens.join(' ');
                let found = lookups.get(key);
                if (!found) {
                    found = computeLookup(contextTokens);
                    if (lookups.size >= MAX_CACHED_LOOKUPS) {
                        lookups.clear();
                    }
                    lookups.set(key, found);
                }
                return found;
            }
            function computeLookup(contextTokens) {
                const contextIds = contextTokens.map((t) => ids.get(t));
                if (contextIds.length === 0 || contextIds.some((id) => id === undefined)) {
                    return { count : 0, next : [] };
                }
                const { total, results } = countNextTokens(contextIds, contextIds.length + 1);
                let cumprob = 0.0;
                return {
                    count : total,
                    next  : results.map((item) => {
                        const prob = item.count / total;
                        cumprob = Math.min(cumprob + prob, 1.0);
                        return { token : vocab[item.id], count : item.count, prob, cumprob };
                    }),
                };
            }

            return { count, isEmpty, summary, lookup };
        }

        function roundForSummary(input) {
            return Math.round(input * 1000) / 1000;
        }


        return {
            createModel
        };
    }
})();
