const path = require('path');

module.exports = {
    entry: {
        CreateZip: `./src/CreateZip.ts`,
        Resize: `./src/Resize.ts`,
        AuthCheck: `./src/AuthCheck.ts`
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ],
    },
    resolve: {
        extensions: ['.js', '.ts', '.tsx', '.json']
    },
    mode: 'production',
    target: 'node',
    node: {
        __dirname: true
    },
    externals : {}
};

const installedModules = [
    'amqplib',
    'apn',
    'async',
    'bent',
    'body-parser',
    'btoa',
    'cassandra-driver',
    'cloudant',
    '@cloudant\/cloudant',
    'commander',
    'composeaddresstranslator',
    'consul',
    'cookie-parser',
    'cradle',
    'elasticsearch',
    'errorhandler',
    'etcd3',
    'express',
    'express-session',
    'formidable',
    'glob',
    'gm',
    'ibm-cos-sdk',
    'ibm_db',
    'ibmiotf',
    'iconv-lite',
    'jsdom',
    'jsonwebtoken',
    'lodash',
    'log4js',
    'marked',
    'merge',
    'moment',
    'mongodb',
    'mysql',
    'mustache',
    'nano',
    'nodemailer',
    'oauth2-server',
    'openwhisk',
    'path-to-regex',
    'pg',
    'process',
    'pug',
    'redis',
    'request',
    'request-promise',
    'rimraf',
    'semver',
    '@sendgrid/mail@6.3.1',
    'serve-favicon',
    'superagent',
    'twilio',
    'underscore',
    'url-pattern',
    'uuid',
    'validator',
    'watson-developer-cloud',
    'when',
    'winston',
    'ws',
    'xml2js',
    'xmlhttprequest',
    'yauzl'
];

installedModules.forEach((nodeModule) => module.exports.externals[nodeModule] = `commonjs ${nodeModule}`); // don't bundle externals; leave as require('module')
