
type PossibleError = Error | null;

export type IErrCallback = (err?: PossibleError) => void;
export type IRenameCallback = (err?: PossibleError, renamedPath?: string) => void;
export type IDownloadCallback = (err?: PossibleError, downloadedFilePath?: string) => void;
export type IDownloadAllCallback = (err?: PossibleError, downloadedFilePaths?: string[]) => void;
export type IZipCallback = (err?: PossibleError, zipPath?: string, zipSize?: number) => void;
export type ICreateZipCallback = (err?: PossibleError, zipPath?: string) => void;
export type IZipDataCallback = (err?: PossibleError, zipPath?: string, zipContents?: string) => void;
