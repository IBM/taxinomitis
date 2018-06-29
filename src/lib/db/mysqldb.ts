// external dependencies
import * as mysql from 'mysql2/promise';
// local dependencies
import * as env from '../utils/env';


let connectionPool: mysql.ConnectionPool | undefined;


export async function connect(): Promise<mysql.ConnectionPool> {
    if (!connectionPool) {
        connectionPool = await mysql.createPool({
            connectionLimit : 30,
            host : process.env[env.MYSQLHOST],
            port : process.env[env.MYSQLPORT],
            user : process.env[env.MYSQLUSER],
            password : process.env[env.MYSQLPASSWORD],
            database : process.env[env.MYSQLDATABASE],
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
