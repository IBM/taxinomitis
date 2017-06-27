export type StatusNumber = 0 | 1 | 2;

export interface Status {
    readonly status: StatusNumber;
    readonly msg: string;
}

export interface Key {
    readonly id: string;
    readonly model?: string;
}
