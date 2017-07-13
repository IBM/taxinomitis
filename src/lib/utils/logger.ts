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
            // TODO stream logs to ELK / Logmet

        }
        else {
            options.src = true;
            options.streams = [{
                level : 'debug',
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
