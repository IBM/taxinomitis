export default function getPortNumber(portnum: string | undefined, defaultport: number): number {
    if (portnum) {
        const port = parseInt(portnum, 10);
        if (isNaN(port)) {
            return defaultport;
        }
        return port;
    }
    return defaultport;
}
