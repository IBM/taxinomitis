import * as store from './token-store';


export function init(): void {
    store.init();
}

export async function getAuthHeader(apikey: string): Promise<string> {
    const token = await store.getToken(apikey);
    return 'Bearer ' + token;
}
