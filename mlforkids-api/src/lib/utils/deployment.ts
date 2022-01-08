/**
 * @returns {Boolean} true if the site is a production deployment
 *              running at machinelearningforkids.co.uk
 *                    false if the site is running locally, or a
 *              form deployed to a different location
 */
export function isProdDeployment(): boolean
{
    return process.env &&
           process.env.DEPLOYMENT === 'machinelearningforkids.co.uk';
}
