/*eslint-env mocha */

import { v1 as uuid } from 'uuid';
import * as assert from 'assert';

import * as store from '../../lib/db/store';
import * as DbTypes from '../../lib/db/db-types';
import * as modeldescriber from '../../lib/training/describetext';


describe('Training - describe text models', () => {

    const userid = uuid();
    const classid = 'TESTTENANT';

    describe('tiny project', () => {
        const project: DbTypes.Project = {
            id : uuid(),
            name : 'tiny project',
            userid, classid,
            type : 'text',
            language : 'en',
            labels : ['first', 'second', 'third', 'fourth' ],
            numfields : 0,
            isCrowdSourced : false,
        };

        let vizInfo: modeldescriber.TextModelDescriptionResponse;

        const trainingExamples = [
            { label : 'first', textdata : 'a' },
            { label : 'first', textdata : 'b' },
            { label : 'second', textdata : 'c' },
            { label : 'second', textdata : 'd' },
            { label : 'third', textdata : 'e' },
            { label : 'third', textdata : 'f' },
        ];

        before(async () => {
            await store.init();
            await store.bulkStoreTextTraining(project.id, trainingExamples);
            vizInfo = await modeldescriber.getModelVisualisation(project);
        });

        after(() => {
            return store.deleteEntireProject(userid, classid, project)
                .then(() => {
                    return store.disconnect();
                });
        });


        it('should include examples', () => {
            assert(vizInfo.examples);
        });

        it('should return all training examples', () => {
            assert.strictEqual(vizInfo.examples.length, trainingExamples.length);
        });

        it('should include examples with integer confidence scores that sum to 100', () => {
            for (const example of vizInfo.examples) {
                assert(example.output);
                assert.strictEqual(Object.keys(example.output).length, project.labels.length);
                let total = 0;
                for (const label of project.labels) {
                    assert(Number.isInteger(example.output[label]));
                    total += example.output[label];
                }
                assert.strictEqual(total, 100);
            }
        });

        it('should generate ten small integer representations for the input layer', () => {
            for (const example of vizInfo.examples) {
                assert.strictEqual(example.random.length, 10);
                for (const score of example.random) {
                    assert(Number.isInteger(score.value));
                    assert(score.value < 10);
                }
            }
        });

        it('should contain examples from the training corpus', () => {
            for (const example of vizInfo.examples) {
                assert(trainingExamples.some((v) => {
                    return v.textdata === example.text && v.label === example.label;
                }));
            }
        });

        it('should not have duplicate examples', () => {
            const checking: string[] = [];
            for (const example of vizInfo.examples) {
                assert.strictEqual(checking.includes(example.text), false);
                checking.push(example.text);
            }
        });

        it('should return custom features for each example', () => {
            for (const example of vizInfo.examples) {
                for (const customfeature of example.customfeatures) {
                    assert(Number.isInteger(customfeature.value));
                    assert(customfeature.value >= 0);
                    if (customfeature.annotation === 'number of letters') {
                        assert(customfeature.value > 0);
                    }
                }
            }
        });

        it('should return a count of ten commonly used words', () => {
            for (const example of vizInfo.examples) {
                assert.strictEqual(example.bagofwords.length, 10);
                for (const customfeature of example.bagofwords) {
                    assert(Number.isInteger(customfeature.value));
                    assert(customfeature.value >= 0);
                    assert(customfeature.annotation.startsWith('number of times that the word'));
                    assert(customfeature.annotation.endsWith('appears'));
                }
            }
        });

        it('should return some non-zero custom features for every example', () => {
            for (const example of vizInfo.examples) {
                let sum = 0;
                for (const customfeature of example.customfeatures) {
                    sum += customfeature.value;
                }
                assert(sum > 0);
            }
        });

        it('should not have duplicate words in the bag', () => {
            for (const example of vizInfo.examples) {
                const checking: string[] = [];
                for (const customfeature of example.bagofwords) {
                    assert.strictEqual(checking.includes(customfeature.annotation), false);
                    checking.push(customfeature.annotation);
                }
            }
        });
    });

    describe('small project', () => {
        const project: DbTypes.Project = {
            id : uuid(),
            name : 'small project',
            userid, classid,
            type : 'text',
            language : 'en',
            labels : ['left', 'right' ],
            numfields : 0,
            isCrowdSourced : false,
        };

        let vizInfo: modeldescriber.TextModelDescriptionResponse;

        const USES_RIGHT_TWICE = 'this right one can be found on the right';
        const USES_EMOTICON = 'another right-side string :-)';

        const trainingExamples = [
            { label : 'left', textdata : 'Something on the left side!' },
            { label : 'left', textdata : 'another awesome thing is here on the LEFT' },
            { label : 'left', textdata : 'this is some sort of thing' },
            { label : 'left', textdata : 'a fourth left string' },
            { label : 'left', textdata : 'the final training item for the Left' },
            { label : 'right', textdata : USES_RIGHT_TWICE },
            { label : 'right', textdata : 'this string is also on the right' },
            { label : 'right', textdata : USES_EMOTICON },
            { label : 'right', textdata : 'This is on the RIGHT' },
            { label : 'right', textdata : 'a Right example for training?' },
        ];

        before(async () => {
            await store.init();
            await store.bulkStoreTextTraining(project.id, trainingExamples);
            vizInfo = await modeldescriber.getModelVisualisation(project);
        });

        after(() => {
            return store.deleteEntireProject(userid, classid, project)
                .then(() => {
                    return store.disconnect();
                });
        });


        it('should include examples', () => {
            assert(vizInfo.examples);
        });

        it('should return five examples per label', () => {
            const expectedNumExamples = 5 * (project.labels.length);
            assert.strictEqual(vizInfo.examples.length, expectedNumExamples);
        });

        it('should include examples with integer confidence scores that sum to 100', () => {
            for (const example of vizInfo.examples) {
                assert(example.output);
                assert.strictEqual(Object.keys(example.output).length, project.labels.length);
                let total = 0;
                for (const label of project.labels) {
                    assert(Number.isInteger(example.output[label]));
                    total += example.output[label];
                }
                assert.strictEqual(total, 100);
            }
        });

        it('should generate ten small integer representations for the input layer', () => {
            for (const example of vizInfo.examples) {
                assert.strictEqual(example.random.length, 10);
                for (const score of example.random) {
                    assert(Number.isInteger(score.value));
                    assert(score.value < 10);
                }
            }
        });

        it('should contain examples from the training corpus', () => {
            for (const example of vizInfo.examples) {
                assert(trainingExamples.some((v) => {
                    return v.textdata === example.text && v.label === example.label;
                }));
            }
        });

        it('should not have duplicate examples', () => {
            const checking: string[] = [];
            for (const example of vizInfo.examples) {
                assert.strictEqual(checking.includes(example.text), false);
                checking.push(example.text);
            }
        });

        it('should return custom features for each example', () => {
            for (const example of vizInfo.examples) {
                for (const customfeature of example.customfeatures) {
                    assert(Number.isInteger(customfeature.value));
                    assert(customfeature.value >= 0);
                    if (customfeature.annotation === 'number of letters') {
                        assert(customfeature.value > 0);
                    }
                    if (example.text === USES_EMOTICON && customfeature.annotation === 'number of emoticons') {
                        assert.strictEqual(customfeature.value, 1);
                    }
                }
            }
        });

        it('should return some non-zero custom features for every example', () => {
            for (const example of vizInfo.examples) {
                let sum = 0;
                for (const customfeature of example.customfeatures) {
                    sum += customfeature.value;
                }
                assert(sum > 0);
            }
        });

        it('should not have duplicate words in the bag', () => {
            for (const example of vizInfo.examples) {
                const checking: string[] = [];
                for (const customfeature of example.bagofwords) {
                    assert.strictEqual(checking.includes(customfeature.annotation), false);
                    checking.push(customfeature.annotation);
                }
            }
        });

        it('should return a count of ten commonly used words', () => {
            for (const example of vizInfo.examples) {
                assert.strictEqual(example.bagofwords.length, 10);
                for (const customfeature of example.bagofwords) {
                    assert(Number.isInteger(customfeature.value));
                    assert(customfeature.value >= 0);
                    assert(customfeature.annotation.startsWith('number of times that the word'));
                    assert(customfeature.annotation.endsWith('appears'));
                    if (example.text === USES_RIGHT_TWICE && customfeature.annotation.includes('"RIGHT"')) {
                        assert.strictEqual(customfeature.value, 2);
                    }
                }
            }
        });
    });
});
