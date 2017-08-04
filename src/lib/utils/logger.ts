// global dependencies
import * as bunyan from 'bunyan';


let logger;

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
            // writing the logs to stdout/stderr so that
            //  they can be picked up by Bluemix Log Service
            options.streams = [
                {
                    level : bunyan.ERROR,
                    stream : process.stderr,
                },
                {
                    level : bunyan.INFO,
                    stream : process.stdout,
                },
            ];
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
