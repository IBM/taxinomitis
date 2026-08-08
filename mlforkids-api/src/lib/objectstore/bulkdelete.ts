// external dependencies
import {
    S3Client,
    DeleteObjectsCommand,
    ListObjectsCommand, type ListObjectsCommandInput,
    type CommonPrefix,
} from 'ibm-cos-sdk-v2';
// local dependencies
import * as keys from './keys';
// type definitions
import * as Types from './types';









export async function deleteProject(
    cos: S3Client,
    bucket: string,
    project: Types.ProjectSpec,
): Promise<void>
{
    const req: ListObjectsCommandInput = {
        Bucket: bucket,
        Prefix: keys.getProjectPrefix(project),
        Delimiter: keys.SEPARATOR,
    };

    let imageKeys = await getObjectKeys(cos, req);
    do {
        await bulkDelete(cos, bucket, imageKeys);

        imageKeys = await getObjectKeys(cos, req);
    } while (imageKeys.length > 0);
}

export async function deleteUser(
    cos: S3Client,
    bucket: string,
    user: Types.UserSpec,
): Promise<void>
{
    const projectPrefixes = await getProjectPrefixes(cos, bucket, user);
    const deletePromises = projectPrefixes.map((projectPrefix) => {
        const project: Types.ProjectSpec = {
            classid: user.classid,
            userid: user.userid,
            projectid: keys.getProjectIdFromPrefix(projectPrefix),
        };
        return deleteProject(cos, bucket, project);
    });
    await Promise.all(deletePromises);
}

export async function deleteClass(
    cos: S3Client,
    bucket: string,
    clazz: Types.ClassSpec,
): Promise<void>
{
    const userPrefixes = await getUserPrefixes(cos, bucket, clazz);
    const deletePromises = userPrefixes.map((userPrefix) => {
        const user: Types.UserSpec = {
            classid: clazz.classid,
            userid: keys.getUserIdFromPrefix(userPrefix),
        };
        return deleteUser(cos, bucket, user);
    });
    await Promise.all(deletePromises);
}







function getPrefixes(commonPrefixes: CommonPrefix[] | undefined): string[] {
    if (commonPrefixes) {
        return commonPrefixes
            .filter(notEmpty)
            .map((prefix) => {
                return prefix.Prefix;
            })
            .filter(notEmpty);
    }
    else {
        return [];
    }
}


async function getProjectPrefixes(cos: S3Client, bucket: string, spec: Types.UserSpec): Promise<string[]> {
    const projectsOutput = await cos.send(new ListObjectsCommand({
        Bucket: bucket,
        Prefix: keys.getUserPrefix(spec),
        Delimiter: keys.SEPARATOR,
    }));
    return getPrefixes(projectsOutput.CommonPrefixes);
}

async function getUserPrefixes(cos: S3Client, bucket: string, spec: Types.ClassSpec): Promise<string[]> {
    const usersOutput = await cos.send(new ListObjectsCommand({
        Bucket: bucket,
        Prefix: keys.getClassPrefix(spec),
        Delimiter: keys.SEPARATOR,
    }));
    return getPrefixes(usersOutput.CommonPrefixes);
}






async function bulkDelete(
    cos: S3Client, bucket: string,
    imageKeys: string[],
): Promise<void>
{
    if (imageKeys.length === 0) {
        return;
    }

    // imageKeys comes from a single ListObjects page, which is capped at
    //  1,000 keys - the same limit DeleteObjects allows in one request
    const response = await cos.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
            Objects: imageKeys.map((imagekey: string) => {
                return { Key: imagekey };
            }),
        },
    }));

    if (response.Errors && response.Errors.length > 0) {
        throw new Error('Failed to delete ' + response.Errors.length + ' object(s) from ' + bucket +
                         ' : ' + JSON.stringify(response.Errors));
    }
}






function getObjectKeys(cos: S3Client, req: ListObjectsCommandInput): Promise<string[]> {
    return cos.send(new ListObjectsCommand(req))
        .then((response) => {
            return response.Contents;
        })
        .then((contents) => {
            if (contents) {
                return contents.map((content) => {
                    return content.Key;
                });
            }
            else {
                return [];
            }
        })
        .then((imageKeys: (string | undefined)[]) => {
            return imageKeys.filter(notEmpty);
        });
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}
