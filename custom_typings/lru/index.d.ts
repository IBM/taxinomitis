declare module 'lru';


// {

//     export class
//     constructor(options: lru.Options);

//     /** Set the value of the key and mark the key as most recently used. */
//     set(key: string, value: T): T;
//     /** Query the value of the key and mark the key as most recently used. */
//     get(key: string): T | undefined;
//     /** Query the value of the key without marking the key as most recently used. */
//     peek(key: string): T | undefined;
//     /** Remove the value from the cache. */
//     remove(key: string): T | undefined;
//     /** Clear the cache. This method does NOT emit the evict event. */
//     clear(): void;
// }
// declare namespace lru {
//     interface Options {
//         max: number;
//         maxAge: number;
//     }
// }

// export = lru;

// // declare module 'lru' {
// //     constructor LRU<T>(options: LRU.Options): LRU.Cache<T>;

// //     namespace LRU {
// //         interface Options {
// //             max: number;
// //             maxAge: number;
// //         }

// //         interface Cache<T> {
// //             /** Set the value of the key and mark the key as most recently used. */
// //             set(key: string, value: T): T;
// //             /** Query the value of the key and mark the key as most recently used. */
// //             get(key: string): T | undefined;
// //             /** Query the value of the key without marking the key as most recently used. */
// //             peek(key: string): T | undefined;
// //             /** Remove the value from the cache. */
// //             remove(key: string): T | undefined;
// //             /** Clear the cache. This method does NOT emit the evict event. */
// //             clear(): void;
// //         }
// //     }


// // // type LruOptions = {
// // //     readonly max: number;
// // //     readonly maxAge: number;
// // // };


// //     export = LRU;
// // }


