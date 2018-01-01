
export interface ClassSpec {
    readonly classid: string;
}
export interface UserSpec extends ClassSpec {
    readonly userid: string;
}
export interface ProjectSpec extends UserSpec {
    readonly projectid: string;
}
export interface ImageSpec extends ProjectSpec {
    readonly imageid: string;
}

export type ObjectStoreSpec = ClassSpec | UserSpec | ProjectSpec | ImageSpec;

export type ImageFileType = 'image/png' | 'image/jpg' | 'image/jpeg' | '';

export interface Image {
    readonly size: number;
    readonly body: string | Buffer;
    readonly modified?: string;
    readonly etag?: string;
    readonly filetype: ImageFileType;
}
