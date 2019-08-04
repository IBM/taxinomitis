/* tslint:disable:no-console */

export function log(message: string, ...params: any[]): void {
    if (process.env.LOGGING !== 'off') {
        console.log(message, params);
    }
}
