// external dependencies
import * as pg from 'pg';
// local dependencies
import * as env from '../utils/env';
import * as fileutils from '../utils/fileutils';

let connectionPool: pg.Pool | undefined;

export async function connect(): Promise<any> {
    if (!connectionPool) {
        pg.types.setTypeParser(20, parseInt);

        const connectionOptions: pg.PoolConfig = {
            host: process.env[env.POSTGRESQLHOST],
            port: parseInt(process.env[env.POSTGRESQLPORT] as string, 10),
            user: process.env[env.POSTGRESQLUSER],
            password: process.env[env.POSTGRESQLPASSWORD],
            database: process.env[env.POSTGRESQLDATABASE],
        };

        if (process.env[env.POSTGRESQLCERT]) {
            connectionOptions.ssl = {
                ca : await fileutils.read(process.env[env.POSTGRESQLCERT] as string),
            };
        }

        connectionPool = new pg.Pool(connectionOptions);
    }
    return connectionPool;
}

export async function disconnect(): Promise<void> {
    if (connectionPool) {
        await connectionPool.end();
        connectionPool = undefined;
    }
}
