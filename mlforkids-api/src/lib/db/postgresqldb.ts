// external dependencies
import * as pg from 'pg';
// local dependencies
import * as env from '../utils/env';
import * as fileutils from '../utils/fileutils';
import loggerSetup from '../utils/logger';

let connectionPool: pg.Pool | undefined;

const log = loggerSetup();

function parseConnectionUrl(url: string): pg.PoolConfig {
    const parsedUrl = new URL(url);
    return {
        host: parsedUrl.hostname || undefined,
        port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : undefined,
        user: parsedUrl.username || undefined,
        password: parsedUrl.password || undefined,
        database: parsedUrl.pathname?.slice(1) || undefined,
    };
}

export async function connect(): Promise<any> {
    if (!connectionPool) {
        pg.types.setTypeParser(20, parseInt);

        let connectionOptions: pg.PoolConfig;

        // Use DATABASE_URL if available, otherwise use individual env vars
        if (process.env.DATABASE_URL) {
            connectionOptions = parseConnectionUrl(process.env.DATABASE_URL);
            // require SSL for DATABASE_URL connections
            connectionOptions.ssl = { rejectUnauthorized: false };
        } else {
            connectionOptions = {
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
        }

        // explicitly set schema search path to mlforkidsdb
        connectionOptions.options = '-c search_path=mlforkidsdb,public';

        connectionPool = new pg.Pool(connectionOptions);

        connectionPool.on('error', (err) => {
            log.error({ err }, 'Idle database client error');
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
