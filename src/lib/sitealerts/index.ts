// local dependencies
import * as store from '../db/store';
import * as Objects from '../db/db-types';
import * as Types from '../db/site-alerts';



/* To avoid having to refetch the latest alert, we fetch it    */
/*  once and then reuse that. The cache needs to be explicitly */
/*  told to refresh.                                           */
let cachedAlert: Objects.SiteAlert | undefined;




export function getSiteAlert(usertype: Objects.SiteAlertAudienceLabel): Objects.SiteAlert | undefined
{
    if (cachedAlert) {
        // we have an alert

        // is the alert still valid?
        if (Date.now() > cachedAlert.expiry.getTime()) {
            // site alert has expired - clear it
            cachedAlert = undefined;
            return;
        }

        // is the alert relevant to the user type?
        if (isAlertRelevant(usertype, cachedAlert.audience)) {
            return cachedAlert;
        }
    }
    // else
    // nothing to return - no cached alert
}


export function isAlertRelevant(audience: Objects.SiteAlertAudienceLabel,
                                alertAudience: Objects.SiteAlertAudienceLabel): boolean
{
    return Types.audiencesByLabel[audience].id >= Types.audiencesByLabel[alertAudience].id;
}


export async function refreshCache(): Promise<Objects.SiteAlert | undefined>
{
    cachedAlert = await store.getLatestSiteAlert();
    return cachedAlert;
}
