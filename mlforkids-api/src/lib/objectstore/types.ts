
export interface ClassSpec {
    readonly classid: string;
}
export interface UserSpec extends ClassSpec {
    readonly userid: string;
}
export interface ProjectSpec extends UserSpec {
    readonly projectid: string;
}
export interface ObjectSpec extends ProjectSpec {
    readonly objectid: string;
}

export type ObjectStoreSpec = ClassSpec | UserSpec | ProjectSpec | ObjectSpec;

export type ImageFileType = 'image/png' | 'image/jpg' | 'image/jpeg' | '';

export interface Image {
    readonly size: number;
    readonly body: Buffer;
    readonly modified?: string;
    readonly etag?: string;
    readonly filetype: ImageFileType;
}

export interface Sound {
    readonly size: number;
    readonly body: number[];
    readonly modified?: string;
    readonly etag?: string;
}
