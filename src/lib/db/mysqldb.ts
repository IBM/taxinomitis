// external dependencies
import * as mysql from 'mysql2/promise';


let connectionPool;


export async function connect() {
    if (!connectionPool) {
        connectionPool = await mysql.createPool({
            connectionLimit : 30,
            host : process.env.MYSQLHOST,
            port : process.env.MYSQLPORT,
            user : process.env.MYSQLUSER,
            password : process.env.MYSQLPASSWORD,
            database : process.env.MYSQLDATABASE,
        });
    }
    return connectionPool;
}

export async function disconnect() {
    if (connectionPool) {
        await connectionPool.end();
        connectionPool = undefined;
    }
}
