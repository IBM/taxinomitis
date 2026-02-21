import { describe, it } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as extensions from '../../lib/scratchx/extensions';
import * as Types from '../../lib/db/db-types';


describe('Scratchx - extensions', () => {

    describe('text projects', () => {

        it('should create a text classify extension for Scratch 3', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'text',
                name : 'TEST',
                language : 'en',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL' ],
                numfields : 0,
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj);

            assert(extension.indexOf('class MachineLearningText') === 0);
            assert(extension.indexOf('items : [  \'LABEL NUMBER ONE\',  \'SECOND LABEL\',  ]') > 0);
            assert(extension.indexOf('name: \'TEST\',') > 0);
            assert(extension.indexOf('return_label_0 () {') > 0);
            assert(extension.indexOf('return_label_1 () {') > 0);
            assert(extension.indexOf('return_label_2 () {') === -1);
        });


        it('should handle apostrophes in project names for Scratch 3', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : "This is Dale's test",
                type : 'text',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'text',
                name : "This is Dale's test",
                language : 'en',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL', 'THIRD' ],
                numfields : 0,
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj);
            assert(extension.indexOf("name: 'This is Dale\\'s test',") > 0);
        });
    });


    describe('numbers projects', () => {

        it('should create a numbers classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'numbers',
                name : 'TEST',
                userid : uuid(),
                classid : uuid(),
                language : 'en',
                labels : [ 'left', 'middle', 'right' ],
                numfields : 6,
                fields : [
                    { name : 'alpha', type : 'number' }, { name : 'beta', type : 'number' },
                    { name : 'gamma', type : 'number' }, { name : 'delta', type : 'number' },
                    { name : 'omega', type : 'multichoice', choices : [ 'AAAA', 'BBBB', 'CCCC' ] },
                    { name : 'dupey', type : 'multichoice', choices : [ 'new', 'BBBB', 'hiding' ] },
                ],
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj);

            assert(extension.indexOf('/api/scratch/' + key.id + '/models') > 0);
            assert(extension.indexOf('opcode: \'return_label_0\'') > 0);
            assert(extension.indexOf('opcode: \'return_label_1\'') > 0);
            assert(extension.indexOf('opcode: \'return_label_2\'') > 0);
            assert(extension.indexOf('opcode: \'return_label_3\'') === -1);
            assert(extension.indexOf('return \'left\';') > 0);
            assert(extension.indexOf('return \'middle\';') > 0);
            assert(extension.indexOf('return \'right\';') > 0);
            assert(extension.indexOf('return_choice_0 () {') > 0);
            assert(extension.indexOf('return_choice_1 () {') > 0);
            assert(extension.indexOf('return_choice_2 () {') > 0);
            assert(extension.indexOf('return_choice_3 () {') > 0);
            assert(extension.indexOf('return_choice_4 () {') > 0);
            assert(extension.indexOf('return_choice_5 () {') === -1);
            assert(extension.indexOf('return \'AAAA\';') > 0);
            assert(extension.indexOf('return \'BBBB\';') > 0);
            assert(extension.indexOf('return \'CCCC\';') > 0);
            assert(extension.indexOf('return \'new\';') > 0);
            assert(extension.indexOf('return \'hiding\';') > 0);
            assert(extension.includes('recognise numbers  alpha[FIELD0]  beta[FIELD1]  gamma[FIELD2]  delta[FIELD3]  omega[FIELD4]  dupey[FIELD5]  (label)'));
            assert(extension.includes('recognise numbers  alpha[FIELD0]  beta[FIELD1]  gamma[FIELD2]  delta[FIELD3]  omega[FIELD4]  dupey[FIELD5]  (confidence)'));
            assert(extension.includes('add training data  alpha[FIELD0]  beta[FIELD1]  gamma[FIELD2]  delta[FIELD3]  omega[FIELD4]  dupey[FIELD5]  is [LABEL]'));
        });
    });




    describe('images projects', () => {

        it('should create a imgtfjs classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'imgtfjs',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'imgtfjs',
                name : 'TEST',
                language : 'en',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL', 'THIRD LABEL' ],
                numfields : 0,
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj);
            assert(extension.indexOf('return_label_0 () {') > 0);
            assert(extension.indexOf('return_label_1 () {') > 0);
            assert(extension.indexOf('return_label_2 () {') > 0);
            assert(extension.indexOf('return_label_3 () {') === -1);
        });
    });


    describe('sounds projects', () => {

        it('should create a sounds classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'sounds',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'sounds',
                name : 'TEST',
                language : 'en',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL', 'THIRD LABEL' ],
                numfields : 0,
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj);
            assert(extension.indexOf('recognise_label_0 () {') > 0);
            assert(extension.indexOf('recognise_label_1 () {') > 0);
            assert(extension.indexOf('recognise_label_2 () {') > 0);
            assert(extension.indexOf('recognise_label_3 () {') === -1);
        });
    });
});
