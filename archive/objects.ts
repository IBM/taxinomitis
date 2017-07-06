export function createNLCClassifier(
    classifierInfo: TrainingObjects.NLCClassifier,
    credentialsInfo: TrainingObjects.BluemixCredentials,
    userid: string, classid: string, projectid: string,
): TrainingObjects.ClassifierDbRow
{
    return {
        id : uuid(),
        credentialsid : credentialsInfo.id,
        userid, projectid, classid,
        servicetype : 'nlc',
        classifierid : classifierInfo.classifierid,
        url : classifierInfo.url,
        name : classifierInfo.name,
        language : classifierInfo.language,
        created : classifierInfo.created,
    };
}



export function getClassifierFromDbRow(row: TrainingObjects.ClassifierDbRow): TrainingObjects.NLCClassifier {
    return {
        classifierid : row.classifierid,
        url : row.url,
        name : row.name,
        language : row.language,
        created : row.created,
    };
}
