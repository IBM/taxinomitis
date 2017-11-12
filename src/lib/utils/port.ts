export default function getPortNumber(portnum: string | undefined, defaultport: number): number {
    if (portnum) {
        return parseInt(portnum, 10);
    }
    return defaultport;
}
