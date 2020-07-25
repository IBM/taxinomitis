// external dependencies
import * as pg from 'pg';

let connectionPool: pg.Pool | undefined;

export async function connect(): Promise<any> {
    if (!connectionPool) {
        pg.types.setTypeParser(20, parseInt);

        connectionPool = new pg.Pool({
            host: 'localhost',
            port: 5432,
            user: 'dalelane',
            password: 'lO7BforYiu9x',
            database: 'mlforkidsdb',
        });
    }
    return connectionPool;
}

export async function disconnect(): Promise<void> {
    if (connectionPool) {
        await connectionPool.end();
        connectionPool = undefined;
    }
}
