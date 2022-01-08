/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as store from '../../lib/db/store';


const TESTCLASS = 'UNIQUECLASSID';


describe.skip('DB store - accents and other character types', () => {

    const user = uuid();

    before(() => {
        return store.init();
    });
    after(async () => {
        return store.disconnect();
    });

    describe('projects', () => {
        const SUPPORTED = [
            'test',
            'DiesisteinTestprojektname',
            'áÁàÀâÂäÄãÃåÅæÆ',
            'çÇéÉèÈêÊëË',
            'íÍìÌîÎïÏñÑ',
            'óÓòÒôÔöÖõÕøØœŒß',
            'Is e seo ainm pròiseact deuchainn',
        ];
        const UNSUPPORTED = [
            '这是一个测试项目名称',
            '這是一個測試項目名稱',
            '이것은 테스트 프로젝트 이름입니다',
            'Это название тестового проекта',
            'මෙය පරීක්ෂණ ව්‍යාපෘති නමකි',
        ];

        it('should correctly store project names', async () => {
            for (const projectname of SUPPORTED) {
                const proj = await store.storeProject(user, TESTCLASS, 'text', projectname, 'en', [], false);
                const retrieve = await store.getProject(proj.id);
                assert.strictEqual(retrieve?.name, projectname, projectname);
            }
        });
        it('should handle unsupported project names', async () => {
            for (const projectname of UNSUPPORTED) {
                try {
                    await store.storeProject(user, TESTCLASS, 'text', projectname, 'en', [], false);
                    assert.fail('should not reach here for ' + projectname);
                }
                catch (err) {
                    assert.strictEqual(err.message, 'Sorry, some of those letters can\'t be used in project names');
                }
            }
        });
    });

    describe('labels', () => {
        const SUPPORTED = [
            'thisisalabel',
            'MYLABEL',
        ];
        const UNSUPPORTED = [
            'áÁàÀâÂäÄãÃå',
            'çÇéÉèÈêÊëËÆ',
            'íÍìÌîÎïÏñÑæ',
            'óÓòÒôÔöÖõÕø',
            'ÅØœŒßúÚùÙûÛ',
        ];

        it('should correctly store label names', async () => {
            for (const labelname of SUPPORTED) {
                const project = await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', [], false);
                await store.addLabelToProject(user, TESTCLASS, project.id, labelname);
                const retrieved = await store.getProject(project.id);
                if (retrieved) {
                    assert.deepStrictEqual(retrieved.labels, [ labelname ], labelname);
                }
                else {
                    assert.fail('failed to retrieve project for ' + labelname);
                }
                await store.deleteEntireProject(user, TESTCLASS, project);
            }
        });

        it('should use placeholders for special characters', async () => {
            for (const labelname of UNSUPPORTED) {
                const project = await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', [], false);
                await store.addLabelToProject(user, TESTCLASS, project.id, labelname);
                const retrieved = await store.getProject(project.id);
                if (retrieved) {
                    assert.deepStrictEqual(retrieved.labels, [ '___________' ], labelname);
                }
                else {
                    assert.fail('failed to retrieve project for ' + labelname);
                }
                await store.deleteEntireProject(user, TESTCLASS, project);
            }
        });
    });

    describe('training data', () => {

        const SUPPORTED = [
            'test',
            'Die siste in Test projektname',
            'áÁàÀâÂäÄãÃåÅæÆ',
            'çÇéÉèÈêÊëË',
            'íÍìÌîÎïÏñÑ',
            'óÓòÒôÔöÖõÕøØœŒß',
            'Is e seo ainm pròiseact deuchainn',
            '这是一个测试项目名称',
            '這是一個測試項目名稱',
            '이것은 테스트 프로젝트 이름입니다',
            'Это название тестового проекта',
            'මෙය පරීක්ෂණ ව්‍යාපෘති නමකි',
            'áÁàÀâÂäÄãÃå',
            'çÇéÉèÈêÊëËÆ',
            'íÍìÌîÎïÏñÑæ',
            'óÓòÒôÔöÖõÕø',
            'ÅØœŒßúÚùÙûÛ',
            'පුහුණු දත්ත සඳහා උදාහරණයක්!',
            'Пример тренировочных данных!',
            'Un exemple de données d\'entraînement!',
            '訓練數據示例！',
        ];

        it('should correctly store training data', async () => {
            for (const training of SUPPORTED) {
                const project = await store.storeProject(user, TESTCLASS, 'text', uuid(), 'en', [], false);
                await store.addLabelToProject(user, TESTCLASS, project.id, 'mylabel');
                await store.storeTextTraining(project.id, training, 'mylabel');
                const retrieved = await store.getTextTraining(project.id, { limit: 1, start: 0 });
                assert.deepStrictEqual(retrieved[0].textdata, training, training);
                await store.deleteEntireProject(user, TESTCLASS, project);
            }
        });
    });
});
