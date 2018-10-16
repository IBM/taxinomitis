import { WORDS } from '../utils/dictionary';
import { int } from '../utils/random';

const MIN_ACCEPTABLE_LENGTH = 8;
const MAX_ACCEPTABLE_LENGTH = 18;

const SEPARATORS = [ '-', '+', '*', '.', '/', '=', '%', '@' ];


function getSeparator(): string {
    return SEPARATORS[int(0, SEPARATORS.length - 1)];
}

function numberOfWords(): number {
    return int(2, 5);
}

function shuffle(): number {
    return 0.5 - Math.random();
}

function getShuffledWordsCopy(): string[] {
    return [ ...WORDS ].sort(shuffle);
}

export function generate(): string {
    let passphrase = '';
    while (passphrase.length < MIN_ACCEPTABLE_LENGTH ||
           passphrase.length > MAX_ACCEPTABLE_LENGTH)
    {
        passphrase = getShuffledWordsCopy()
                        .slice(0, numberOfWords())
                        .join(getSeparator());
    }
    return passphrase;
}
