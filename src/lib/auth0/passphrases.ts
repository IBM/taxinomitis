import { WORDS } from '../utils/dictionary';
import { int } from '../utils/random';


const SEPARATORS = [ '-', '+', '*', '.', '/' ];


function getSeparator(): string {
    return SEPARATORS[int(0, SEPARATORS.length - 1)];
}

function numberOfWords(): number {
    return int(3, 4);
}

function shuffle(): number {
    return 0.5 - Math.random();
}

function getShuffledWordsCopy(): string[] {
    return [ ...WORDS ].sort(shuffle);
}

export function generate(): string {
    return getShuffledWordsCopy()
               .slice(0, numberOfWords())
               .join(getSeparator());
}
