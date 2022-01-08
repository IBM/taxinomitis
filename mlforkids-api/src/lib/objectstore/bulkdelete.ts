// external dependencies
import * as IBMCosSDK from 'ibm-cos-sdk';
// local dependencies
import * as keys from './keys';
// type definitions
import * as Types from './types';









export async function deleteProject(
    cos: IBMCosSDK.S3,
    bucket: string,
    project: Types.ProjectSpec,
): Promise<void>
{
    const req: IBMCosSDK.S3.ListObjectsRequest = {
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
    cos: IBMCosSDK.S3,
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
    cos: IBMCosSDK.S3,
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







function getPrefixes(commonPrefixes: IBMCosSDK.S3.CommonPrefix[] | undefined): string[] {
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


async function getProjectPrefixes(cos: IBMCosSDK.S3, bucket: string, spec: Types.UserSpec): Promise<string[]> {
    const projectsOutput = await cos.listObjects({
        Bucket: bucket,
        Prefix: keys.getUserPrefix(spec),
        Delimiter: keys.SEPARATOR,
    }).promise();
    return getPrefixes(projectsOutput.CommonPrefixes);
}

async function getUserPrefixes(cos: IBMCosSDK.S3, bucket: string, spec: Types.ClassSpec): Promise<string[]> {
    const usersOutput = await cos.listObjects({
        Bucket: bucket,
        Prefix: keys.getClassPrefix(spec),
        Delimiter: keys.SEPARATOR,
    }).promise();
    return getPrefixes(usersOutput.CommonPrefixes);
}






function bulkDelete(
    cos: IBMCosSDK.S3, bucket: string,
    imageKeys: string[],
): Promise<IBMCosSDK.S3.DeleteObjectOutput[]>
{
    return Promise.all(imageKeys.map((imagekey: string) => {
        return cos.deleteObject({
            Bucket: bucket,
            Key: imagekey,
        }).promise();
    }));
}






function getObjectKeys(cos: IBMCosSDK.S3, req: IBMCosSDK.S3.ListObjectsRequest): Promise<string[]> {
    return cos.listObjects(req).promise()
        .then((response: IBMCosSDK.S3.ListObjectsOutput) => {
            return response.Contents;
        })
        .then((contents: IBMCosSDK.S3.Object[] | undefined) => {
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
