// global dependencies
import * as bunyan from 'bunyan';
import * as bunyanSlack from 'bunyan-slack';
// local dependencies
import * as env from '../utils/env';


let logger: bunyan;


/**
 * Prepares an instance of a bunyan login.
 */
export default function getLogger(): bunyan {
    if (!logger) {
        const options: bunyan.LoggerOptions = {
            name : 'ml-for-kids',
            serializers : bunyan.stdSerializers,
        };

        if (process.env.NODE_ENV === 'production') {
            options.streams = [
                // writing the logs to stdout/stderr so that
                //  they can be picked up by Bluemix Log Service
                {
                    level : bunyan.ERROR,
                    stream : process.stderr,
                },
                {
                    level : bunyan.INFO,
                    stream : process.stdout,
                },
            ];

            if (process.env[env.SLACK_WEBHOOK_URL]) {
                // post errors to Slack so I get notified
                const slackLogger = new bunyanSlack({
                    webhook_url: process.env[env.SLACK_WEBHOOK_URL],
                    channel: 'errors',
                    customFormatter: (record: any, levelName: string) => {
                        const fields = [
                            // insert a field that identifies which instance of the app has thrown this error
                            { title : 'CF instance', value : process.env.CF_INSTANCE_INDEX, short : true },
                        ].concat(Object.keys(record).map((field) => {
                            return {
                                title : field,
                                value : field === 'err' ? record.err.stack : record[field],
                                short : field !== 'err',
                            };
                        }));
                        return {
                            text: record.msg,
                            attachments: [{
                                fallback: 'Error meta-data',
                                color: levelName === 'error' ? '#c42939' : '#36a64f',
                                author_name: 'bunyan',
                                title: 'Error fields',
                                fields,
                            }],
                        };
                    },
                });
                options.streams.push({
                    level : bunyan.ERROR,
                    stream : slackLogger,
                });
            }
        }
        else {
            options.src = true;
            options.streams = [{
                level : bunyan.DEBUG,
                type : 'rotating-file',
                path : './logs/ml-for-kids.log',
                period : '1d',
                count : 2,
            }];
        }

        logger = bunyan.createLogger(options);
    }
    return logger;
}
