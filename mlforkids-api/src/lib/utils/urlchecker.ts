

export function check(imageurl: string): string {
    // handle encoding special characters, as well as
    //  validating that the URL is valid before we try
    //  and download anything from it
    const urlObj = new URL(imageurl);
    if (!urlObj.protocol.startsWith('http')) {
        throw new Error('Only http and https supported');
    }

    return urlObj.toString();
}
