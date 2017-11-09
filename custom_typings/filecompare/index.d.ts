export = filecompare;

type isEqualCallback = (isEqual: boolean) => void;

declare function filecompare(path1: string, path2: string, cb: isEqualCallback): void;

declare namespace filecompare {
    const prototype: {
    };
}
