// external dependencies
import * as emoticons from 'emoticon';


export function getAllKnownEmoticons(): string[] {
    let allEmoticons: string[] = [];
    emoticons.forEach((emoticon: any) => {
        allEmoticons = allEmoticons.concat(emoticon.emoticons);
    });
    return allEmoticons;
}

const IGNORE = [
    ':-',
];

export function countEmoticons(text: string, emoticonsToSearchFor: string[]): number {
    let count = 0;
    for (const emoticon of emoticonsToSearchFor) {
        if (!IGNORE.includes(emoticon) && text.includes(emoticon)) {
            count += 1;
        }
    }
    return count;
}
