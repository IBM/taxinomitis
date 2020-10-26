// external dependencies
import * as _ from 'lodash';



export function int(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max) + 1;
    return Math.floor(Math.random() * (max - min)) + min;
}


/**
 * Generate {num} random numbers that sum to 100.
 * @param num
 * @param total
 */
export function ints(num: number): number[] {
    const numbers = [
        int(40, 60),
    ];

    let runningTotal = numbers[0];
    for (let i = 1; i < num - 1; i++) {
        const next = int(0, (95 - runningTotal));
        runningTotal += next;
        numbers.push(next);
    }
    numbers.push(100 - runningTotal);

    return _.shuffle(numbers);
}
