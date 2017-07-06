
export async function storeNLCClassifier(
    credentials: TrainingObjects.BluemixCredentials,
    userid: string, classid: string, projectid: string,
    classifier: TrainingObjects.NLCClassifier,
): Promise<TrainingObjects.NLCClassifier>
{
    const obj = dbobjects.createNLCClassifier(classifier, credentials,
        userid, classid, projectid);

    const queryString: string = 'INSERT INTO `bluemixclassifiers` ' +
                                '(`id`, `credentialsid`, ' +
                                '`projectid`, `userid`, `classid`, ' +
                                '`servicetype`, ' +
                                '`classifierid`, `url`, `name`, `language`, `created`) ' +
                                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const values = [obj.id, obj.credentialsid, obj.projectid, obj.userid, obj.classid,
        obj.servicetype, obj.classifierid, obj.url, obj.name, obj.language, obj.created];

    const response = await dbExecute(queryString, values);
    if (response.affectedRows !== 1) {
        log.error({ response }, 'Failed to store classifier info');
        throw new Error('Failed to store classifier');
    }

    return classifier;
}



export async function getNLCClassifiers(
    projectid: string,
): Promise<TrainingObjects.NLCClassifier[]>
{
    const queryString = 'SELECT `id`, `credentialsid`, `projectid`, `servicetype`,' +
                        ' `classifierid`, `url`, `name`, `language`, `created` ' +
                        'FROM `bluemixclassifiers` ' +
                        'WHERE `projectid` = ?';

    const rows = await dbExecute(queryString, [ projectid ]);
    return rows.map(dbobjects.getClassifierFromDbRow);
}
