const { Pool } = require('pg');
const { v4 } = require('uuid');


async function run() {
    const pool = new Pool({
        user: 'dale',
        host: 'localhost',
        database: 'helloworld',
        password: 'lO7BforYiu9x',
        port: 5432,
    });

    const response = await pool.query('SELECT id, value FROM test where id = $1', [ 13 ]);
    const rows = response.rows;
    console.log(rows);

    // for (let i = 6; i < 100; i++) {
    //     await pool.query('INSERT INTO test (id, value) VALUES ($1, $2)', [ i , v4() ]);
    // }
    // await pool.query({
    //     name: 'get-test-row',
    //     text: 'SELECT * from test WHERE id = $1',
    //     values: [1],
    // });
    // let total = 0;
    // let count = 0;
    // for (let i = 1; i < 100; i++) {
    //     const start = process.hrtime();
    //     const res = await pool.query({
    //         name: 'get-test-row',
    //         text: 'SELECT * from test WHERE id = $1',
    //         values: [i],
    //     });
    //     console.log(res);
    //     const hrend = process.hrtime(start);
    //     total += hrend[1];
    //     count += 1;

    //     // console.log(res.rows);
    //     console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
    // }
    // console.log('average time ' + (total / count));

    return pool.end();
}


run()
    .then(() => {
        console.log('done');
    });
