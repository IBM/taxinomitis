
export interface NLCClassifier {
    readonly classifierid: string;
    readonly url: string;
    readonly name: string;
    readonly language: string;
    readonly created: Date;
    status?: NLCStatus;
    statusDescription?: string;
}
