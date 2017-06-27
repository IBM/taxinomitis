export interface Status {
    readonly status: number;
    readonly msg: string;
}

export interface Key {
    readonly id: string;
    readonly model?: string;
}
