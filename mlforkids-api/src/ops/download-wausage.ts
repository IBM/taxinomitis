/* eslint no-console: 0 */
/* tslint:disable: no-console */
import * as fs from 'fs/promises';
import * as path from 'path';
import { setTimeout } from 'node:timers/promises';
import * as store from '../lib/db/store';

//
// Downloads the text model usage events recorded in the wausage table
//  to a local file, and then deletes them from the database.
//
// Each run writes a new newline-delimited JSON file to the provided
//  directory. Events are only deleted from the database after the
//  file has been written and verified.
//

const opsArgs = process.argv.slice(2);

if (opsArgs.length !== 1) {
    console.log('usage: node download-wausage.js <output-directory>');
    process.exit(-1); // eslint-disable-line
}

const outputDir = opsArgs[0];

// number of events to retrieve from the database at a time
const PAGE_SIZE = 5000;

// Events are inserted concurrently, so an event with a lower id can
//  be committed after an event with a higher id. Waiting after getting
//  the latest id gives any of these in-flight inserts time to complete
//  so that they will be downloaded before they are deleted.
const INFLIGHT_WAIT_MS = 5000;


async function downloadEvents(maxId: number, outputFile: string): Promise<number> {
    const file = await fs.open(outputFile, 'wx');
    let count = 0;
    try {
        let afterId = 0;
        let page = await store.getWaUsageEvents(afterId, maxId, PAGE_SIZE);
        while (page.length > 0) {
            const lines = page.map((event) => JSON.stringify(event) + '\n').join('');
            await file.write(lines);

            count += page.length;
            afterId = page[page.length - 1].id;

            page = await store.getWaUsageEvents(afterId, maxId, PAGE_SIZE);
        }

        await file.sync();
    }
    finally {
        await file.close();
    }
    return count;
}


async function countLines(file: string): Promise<number> {
    const contents = await fs.readFile(file, 'utf8');
    return contents.split('\n').filter((line) => line.length > 0).length;
}


async function run() {
    await fs.mkdir(outputDir, { recursive : true });

    await store.init();

    const maxId = await store.getLatestWaUsageEventId();
    if (maxId === 0) {
        console.log('no usage events to download');
        return;
    }

    await setTimeout(INFLIGHT_WAIT_MS);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, 'wausage-' + timestamp + '.ndjson');

    const downloaded = await downloadEvents(maxId, outputFile);
    console.log('downloaded', downloaded, 'events to', outputFile);

    const verified = await countLines(outputFile);
    if (verified !== downloaded) {
        throw new Error('Unable to verify download (' + verified + ' events in file). ' +
                        'Events have not been deleted from the database.');
    }

    const deleted = await store.deleteWaUsageEvents(maxId);
    console.log('deleted', deleted, 'events from the database');

    if (deleted !== downloaded) {
        console.error('WARNING: number of events deleted does not match the number downloaded');
    }
}


run()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => {
        return store.disconnect();
    });
