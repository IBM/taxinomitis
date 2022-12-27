/*eslint-env mocha */
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as requestPromise from 'request-promise';
import { v1 as uuid } from 'uuid';
import * as store from '../../lib/db/store';
import * as datasets from '../../lib/datasets';
import * as dbtypes from '../../lib/db/db-types';



describe('Datasets import', () => {

    const TESTCLASS = 'UNIQUECLASSID';

    let numbersTrainingServiceDeleteStub: sinon.SinonStub<any, any>;


    before(() => {
        return store.init();
    });
    before(() => {
        const originalRequestDelete = requestPromise.delete;
        const stubbedRequestDelete = (url: string, opts?: any) => {
            if (url === 'undefined/api/models') {
                // no test numbers service available
                return Promise.resolve();
            }
            else {
                // use a real test numbers service
                return originalRequestDelete(url, opts);
            }
        };
        numbersTrainingServiceDeleteStub = sinon.stub(requestPromise, 'delete')
                                            // @ts-ignore
                                            .callsFake(stubbedRequestDelete);

        return store.deleteProjectsByClassId(TESTCLASS);
    });

    after(async () => {
        await store.deleteProjectsByClassId(TESTCLASS);
        numbersTrainingServiceDeleteStub.restore();
        return store.disconnect();
    });

    const DEFAULT_IMPORT = { crowdsourced: false, testratio :0 };


    describe('Errors', () => {

        it('should handle requests to import non-existent datasets', () => {
            return datasets.importDataset(uuid(), TESTCLASS, DEFAULT_IMPORT, 'text', 'not-a-real-dataset')
                .then(() => {
                    assert.fail('should not get here');
                })
                .catch((err) => {
                    assert.strictEqual(err.message, datasets.ERRORS.DATASET_DOES_NOT_EXIST);
                });
        });

        it('should handle requests to import non-existent dataset types', () => {
            return datasets.importDataset(uuid(), TESTCLASS, DEFAULT_IMPORT,
                                          '../../../' as dbtypes.ProjectTypeLabel, 'not-a-real-dataset')
                .then(() => {
                    assert.fail('should not get here');
                })
                .catch((err) => {
                    assert.strictEqual(err.message, datasets.ERRORS.DATASET_DOES_NOT_EXIST);
                });
        });

    });


    describe('Verify datasets', () => {
        it('should be able to import all prod datasets', async () => {
            const user = uuid();

            const prodDatasets: {[type: string]: string[]; } = {
                numbers : [
                    'titanic',
                    'argo',
                    'phishing',
                    'stars',
                ],
                text : [
                    'uk-newspaper-headlines',
                    'song-lyrics',
                    'fake-news',
                ],
                imgtfjs : [
                    'cats-and-dogs',
                    'pokemon',
                ],
            };

            for (const type of Object.keys(prodDatasets)) {
                for (const dataset of prodDatasets[type]) {
                    const project = await datasets.importDataset(user, TESTCLASS, DEFAULT_IMPORT,
                                                                 type as dbtypes.ProjectTypeLabel,
                                                                 dataset);
                    await store.deleteEntireProject(user, TESTCLASS, project);
                }
            }
        });
    });


    describe('Text datasets', () => {

        it('should import a text dataset', async () => {
            const user = uuid();

            const project = await datasets.importDataset(user, TESTCLASS, DEFAULT_IMPORT, 'text', 'test-only-txt');

            await verifyTestTextProject(project.id);
            await store.deleteEntireProject(user, TESTCLASS, project);
        });

        function verifyTestTextProject(projectid: string) {
            return store.getProject(projectid)
                .then((project) => {
                    assert(project);
                    if (project) {
                        assert.strictEqual(project.name, 'Test project');
                        assert.deepStrictEqual(project.labels, [ 'compliment', 'insult' ]);
                        assert.strictEqual(project.language, 'en');
                    }

                    return store.getTextTraining(projectid, { start: 0, limit : 10 });
                })
                .then((verify) => {
                    assert.strictEqual(verify.length, 7);
                    assert(confirmItemPresent(verify, 'You are lovely', 'compliment'));
                    assert(confirmItemPresent(verify, 'I like you', 'compliment'));
                    assert(confirmItemPresent(verify, 'We think you are a good person', 'compliment'));
                    assert(confirmItemPresent(verify, 'You suck', 'insult'));
                    assert(confirmItemPresent(verify, 'Everyone hatest you', 'insult'));
                    assert(confirmItemPresent(verify, 'You smell bad', 'insult'));
                    assert(confirmItemPresent(verify, 'You are an idiot', 'insult'));
                });
        }

        function confirmItemPresent(list: any[], textdata: string, label: string) {
            return list.some((listitem) => {
                return listitem.textdata === textdata &&
                       listitem.label === label;
            });
        }
    });


    describe('Numbers datasets', () => {

        it('should import a numbers dataset', async () => {
            const user = uuid();

            const project = await datasets.importDataset(user, TESTCLASS, DEFAULT_IMPORT, 'numbers', 'test-only-num');

            await verifyTestNumbersProject(project.id);
            await store.deleteEntireProject(user, TESTCLASS, project);
        });

        function verifyTestNumbersProject(projectid: string) {
            return store.getProject(projectid)
                .then((project) => {
                    assert(project);
                    if (project) {
                        assert.strictEqual(project.name, 'My project');
                        assert.deepStrictEqual(project.labels, [ 'first', 'second', 'third' ]);
                    }

                    return store.getNumberTraining(projectid, { start: 0, limit : 10 });
                })
                .then((verify) => {
                    assert.strictEqual(verify.length, 7);
                    assert.deepStrictEqual(verify[0].numberdata, [ 10, 0, 15, 0 ]);
                    assert.strictEqual(verify[0].label, 'first');
                    assert.deepStrictEqual(verify[1].numberdata, [ 11, 1, 14, 2 ]);
                    assert.strictEqual(verify[1].label, 'first');
                    assert.deepStrictEqual(verify[2].numberdata, [ 12, 0, 13, 1 ]);
                    assert.strictEqual(verify[2].label, 'first');
                    assert.deepStrictEqual(verify[3].numberdata, [ 13, 1, 12, 1 ]);
                    assert.strictEqual(verify[3].label, 'first');
                    assert.deepStrictEqual(verify[4].numberdata, [ 0, 1, 1, 2 ]);
                    assert.strictEqual(verify[4].label, 'second');
                    assert.deepStrictEqual(verify[5].numberdata, [ 5.8, 0, 18.1, 2 ]);
                    assert.strictEqual(verify[5].label, 'third');
                    assert.deepStrictEqual(verify[6].numberdata, [ -102, 1, -1, 1 ]);
                    assert.strictEqual(verify[6].label, 'third');
                });
        }
    });


    describe('Images datasets', () => {

        it('should import an images dataset', async () => {
            const user = uuid();

            const project = await datasets.importDataset(user, TESTCLASS, DEFAULT_IMPORT, 'imgtfjs', 'test-only-img');

            await verifyTestImagesProject(project.id);
            await store.deleteEntireProject(user, TESTCLASS, project);
        });

        function verifyTestImagesProject(projectid: string) {
            return store.getProject(projectid)
                .then((project) => {
                    assert(project);
                    if (project) {
                        assert.strictEqual(project.name, 'Pictures project');
                        assert.deepStrictEqual(project.labels, [ 'cat', 'dog' ]);
                    }
                    return store.getImageTraining(projectid, { start: 0, limit : 10 });
                })
                .then((verify) => {
                    assert.strictEqual(verify.length, 9);
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Gillie_hunting_%282292639848%29.jpg/867px-Gillie_hunting_%282292639848%29.jpg', 'cat'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Blackcat-Lilith.jpg', 'cat'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Britishblue.jpg/744px-Britishblue.jpg', 'cat'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Brown_and_white_tabby_cat_with_green_eyes-Hisashi-03.jpg/1599px-Brown_and_white_tabby_cat_with_green_eyes-Hisashi-03.jpg', 'cat'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Orange_tabby_cat_sitting_on_fallen_leaves-Hisashi-01A.jpg/900px-Orange_tabby_cat_sitting_on_fallen_leaves-Hisashi-01A.jpg', 'cat'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Racib%C3%B3rz_2007_082.jpg/1599px-Racib%C3%B3rz_2007_082.jpg', 'dog'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/4/47/Golden_retriever.jpg', 'dog'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Deutscher_Schaeferhund_Presley_von_Beluga.jpg/1600px-Deutscher_Schaeferhund_Presley_von_Beluga.jpg', 'dog'));
                    // tslint:disable-next-line:max-line-length
                    assert(confirmItemPresent(verify, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Brittany_Spaniel_standing.jpg/1583px-Brittany_Spaniel_standing.jpg', 'dog'));
                });
        }

        function confirmItemPresent(list: any[], imageurl: string, label: string) {
            return list.some((listitem) => {
                return listitem.imageurl === imageurl &&
                       listitem.label === label &&
                       listitem.isstored === false;
            });
        }
    });


    describe('Holding out test data', () => {
        it('should hold out the requested amount of text data for testing', async () => {
            const TESTS = [
                { ratio:  10, expectedtest :  28, expectedtrain : 250 },
                { ratio:  20, expectedtest :  56, expectedtrain : 222 },
                { ratio:  25, expectedtest :  70, expectedtrain : 208 },
                { ratio:  50, expectedtest : 139, expectedtrain : 139 },
                { ratio: 100, expectedtest : 278, expectedtrain :   0 },
            ];
            const expectedtotal = 278;

            const user = uuid();

            for (const test of TESTS) {
                const project = await datasets.importDataset(user, TESTCLASS, { crowdsourced: false, testratio: test.ratio }, 'text', 'uk-newspaper-headlines');
                const trainingdata = await store.getTextTraining(project.id, { limit: 1000, start: 0 });

                assert(project.testdata);

                const firstTestRow = project.testdata.shift();
                assert.deepStrictEqual(firstTestRow, [ 'text', 'label' ]);

                const total = project.testdata.length + trainingdata.length;

                assert.strictEqual(project.testdata.length, test.expectedtest);
                assert.strictEqual(trainingdata.length, test.expectedtrain);
                assert.strictEqual(total, expectedtotal);

                await store.deleteEntireProject(user, TESTCLASS, project);
            }
        });

        it('should hold out the requested amount of image data for testing', async () => {
            const TESTS = [
                { ratio:  10, expectedtest :  4, expectedtrain : 36 },
                { ratio:  20, expectedtest :  8, expectedtrain : 32 },
                { ratio:  25, expectedtest : 10, expectedtrain : 30 },
                { ratio:  50, expectedtest : 20, expectedtrain : 20 },
                { ratio: 100, expectedtest : 40, expectedtrain :  0 },
            ];
            const expectedtotal = 40;

            const user = uuid();

            for (const test of TESTS) {
                const project = await datasets.importDataset(user, TESTCLASS, { crowdsourced: false, testratio: test.ratio }, 'imgtfjs', 'cats-and-dogs');
                const trainingdata = await store.getImageTraining(project.id, { limit: 1000, start: 0 });

                assert(project.testdata);

                const firstTestRow = project.testdata.shift();
                assert.deepStrictEqual(firstTestRow, [ 'url', 'label' ]);

                const total = project.testdata.length + trainingdata.length;

                assert.strictEqual(project.testdata.length, test.expectedtest);
                assert.strictEqual(trainingdata.length, test.expectedtrain);
                assert.strictEqual(total, expectedtotal);

                await store.deleteEntireProject(user, TESTCLASS, project);
            }
        });

        it('should hold out the requested amount of numbers data for testing', async () => {
            const TESTS = [
                { ratio:  10, expectedtest :  35, expectedtrain : 315 },
                { ratio:  20, expectedtest :  70, expectedtrain : 280 },
                { ratio:  25, expectedtest :  88, expectedtrain : 262 },
                { ratio:  50, expectedtest : 175, expectedtrain : 175 },
                { ratio: 100, expectedtest : 350, expectedtrain :   0 },
            ];
            const expectedtotal = 350;

            const user = uuid();

            for (const test of TESTS) {
                const project = await datasets.importDataset(user, TESTCLASS, { crowdsourced: false, testratio: test.ratio }, 'numbers', 'pokemon-stats');
                const trainingdata = await store.getNumberTraining(project.id, { limit: 1000, start: 0 });

                assert(project.testdata);

                const firstTestRow = project.testdata.shift();
                assert.deepStrictEqual(firstTestRow, [ 'height', 'weight', 'attack', 'defense', 'speed', 'hp', 'capture rate', 'label' ]);

                const total = project.testdata.length + trainingdata.length;

                assert.strictEqual(project.testdata.length, test.expectedtest);
                assert.strictEqual(trainingdata.length, test.expectedtrain);
                assert.strictEqual(total, expectedtotal);

                await store.deleteEntireProject(user, TESTCLASS, project);
            }
        });

        it('should return string labels for multi-choice test values', async () => {
            const user = uuid();

            const project = await datasets.importDataset(user, TESTCLASS, { crowdsourced: false, testratio: 90 }, 'numbers', 'test-only-num');
            assert(project.testdata);

            const firstTestRow = project.testdata.shift();
            assert.deepStrictEqual(firstTestRow, [ 'count', 'size', 'age', 'colour', 'label' ]);

            assert.strictEqual(project.testdata.length, 6);

            for (const testdata of project.testdata) {
                assert.strictEqual(typeof testdata[0], 'number');
                assert.strictEqual(typeof testdata[1], 'string');
                assert.strictEqual(typeof testdata[2], 'number');
                assert.strictEqual(typeof testdata[3], 'string');
                assert.strictEqual(typeof testdata[4], 'string');
            }
        });

        it('should not overlap test and train data', async () => {
            const user = uuid();

            const project = await datasets.importDataset(user, TESTCLASS, { crowdsourced: false, testratio: 33 }, 'imgtfjs', 'test-only-img');
            const trainingdata = await store.getImageTraining(project.id, { limit: 1000, start: 0 });

            assert(project.testdata);

            const firstTestRow = project.testdata.shift();
            assert.deepStrictEqual(firstTestRow, [ 'url', 'label' ]);

            const total = project.testdata.length + trainingdata.length;
            assert.strictEqual(total, 9);

            assert.strictEqual(project.testdata.length, 3);
            assert.strictEqual(trainingdata.length, 6);

            const trainingurls = trainingdata.map((itm) => itm.imageurl);
            const testurls = project.testdata.map((itm) => itm[0]);

            const hasOverlap = trainingurls.some((trainingurl) => testurls.includes(trainingurl));
            assert.strictEqual(hasOverlap, false);
        });
    });
});
