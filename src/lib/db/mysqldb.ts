// external dependencies
import * as mysql from 'mysql2/promise';


let connection;


export async function connect() {
    if (!connection) {
        connection = await mysql.createConnection({
            host : process.env.MYSQLHOST,
            port : process.env.MYSQLPORT,
            user : process.env.MYSQLUSER,
            password : process.env.MYSQLPASSWORD,
            database : process.env.MYSQLDATABASE,
        });
    }
    return connection;
}

export async function disconnect() {
    if (connection) {
        await connection.end();
        connection = undefined;
    }
}
