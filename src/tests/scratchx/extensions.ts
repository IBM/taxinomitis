/*eslint-env mocha */
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as extensions from '../../lib/scratchx/extensions';
import * as Types from '../../lib/db/db-types';


describe('Scratchx - status', () => {

    describe('text projects', () => {

        it('should create a text classify extension', async () => {
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

            const extension = await extensions.getScratchxExtension(key, proj, 2);

            assert(extension.indexOf('/api/scratch/' + key.id + '/status') > 0);
            assert(extension.indexOf('/api/scratch/' + key.id + '/classify') > 0);
            assert(extension.indexOf('ext.return_label_0 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_1 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_2 = function () {') === -1);
            assert(extension.indexOf('[ \'r\', \'LABEL NUMBER ONE\', \'return_label_0\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'SECOND LABEL\', \'return_label_1\'],') > 0);
            assert(extension.indexOf(
                '[ \'R\', \'recognise text %s (label)\', \'text_classification_label\', \'text\' ]') > 0);
            assert(extension.indexOf(
                '[ \'R\', \'recognise text %s (confidence)\', \'text_classification_confidence\', \'text\' ]') > 0);
        });


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

            const extension = await extensions.getScratchxExtension(key, proj, 3);

            assert(extension.indexOf('class MachineLearningText') === 0);
            assert(extension.indexOf('items : [  \'LABEL NUMBER ONE\',  \'SECOND LABEL\',  ]') > 0);
            assert(extension.indexOf('name: \'TEST\',') > 0);
            assert(extension.indexOf('return_label_0 () {') > 0);
            assert(extension.indexOf('return_label_1 () {') > 0);
            assert(extension.indexOf('return_label_2 () {') === -1);
        });


        it('should handle apostrophes in project names', async () => {
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

            const extension = await extensions.getScratchxExtension(key, proj, 2);

            assert(extension.indexOf('/api/scratch/' + key.id + '/status') > 0);
            assert(extension.indexOf('/api/scratch/' + key.id + '/classify') > 0);
            assert(extension.indexOf('ext.return_label_0 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_1 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_2 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_3 = function () {') === -1);
            assert(extension.indexOf('[ \'r\', \'LABEL NUMBER ONE\', \'return_label_0\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'SECOND LABEL\', \'return_label_1\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'THIRD\', \'return_label_2\'],') > 0);
            assert(extension.indexOf(
                '[ \'R\', \'recognise text %s (label)\', \'text_classification_label\', \'text\' ]') > 0);
            assert(extension.indexOf(
                '[ \'R\', \'recognise text %s (confidence)\', \'text_classification_confidence\', \'text\' ]') > 0);

            assert(extension.indexOf("ScratchExtensions.register('This is Dale\\'s test', descriptor, ext)") > 0);
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

            const extension = await extensions.getScratchxExtension(key, proj, 3);
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

            const extension = await extensions.getScratchxExtension(key, proj, 2);

            assert(extension.indexOf('/api/scratch/' + key.id + '/status') > 0);
            assert(extension.indexOf('/api/scratch/' + key.id + '/classify') > 0);

            assert(extension.indexOf('ext.return_label_0 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_1 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_2 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_3 = function () {') === -1);
            assert(extension.indexOf('[ \'r\', \'left\', \'return_label_0\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'middle\', \'return_label_1\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'right\', \'return_label_2\'],') > 0);

            assert(extension.indexOf('ext.return_choice_0 = function () {') > 0);
            assert(extension.indexOf('ext.return_choice_1 = function () {') > 0);
            assert(extension.indexOf('ext.return_choice_2 = function () {') > 0);
            assert(extension.indexOf('ext.return_choice_3 = function () {') > 0);
            assert(extension.indexOf('ext.return_choice_4 = function () {') > 0);
            assert(extension.indexOf('ext.return_choice_5 = function () {') === -1);
            assert(extension.indexOf('[ \'r\', \'AAAA\', \'return_choice_0\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'BBBB\', \'return_choice_1\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'CCCC\', \'return_choice_2\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'new\', \'return_choice_3\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'hiding\', \'return_choice_4\'],') > 0);

            assert(extension.indexOf(
                '[ \'R\', ' +
                '\'recognise numbers alpha %n beta %n gamma %n delta %n omega %s dupey %s  (label)\', ' +
                '\'numbers_classification_label\' ]') > 0);
            assert(extension.indexOf(
                '[ \'R\', ' +
                '\'recognise numbers alpha %n beta %n gamma %n delta %n omega %s dupey %s  (confidence)\', ' +
                '\'numbers_classification_confidence\' ]') > 0);
        });
    });




    describe('images projects', () => {

        it('should create a images classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'images',
                name : 'TEST',
                language : 'en',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL', 'THIRD LABEL' ],
                numfields : 0,
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj, 2);

            assert(extension.indexOf('/api/scratch/' + key.id + '/status') > 0);
            assert(extension.indexOf('/api/scratch/' + key.id + '/classify') > 0);
            assert(extension.indexOf('ext.return_label_0 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_1 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_2 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_3 = function () {') === -1);
            assert(extension.indexOf('[ \'r\', \'LABEL NUMBER ONE\', \'return_label_0\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'SECOND LABEL\', \'return_label_1\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'THIRD LABEL\', \'return_label_2\'],') > 0);
            assert(extension.indexOf(
                '[ \'R\', \'recognise image %s (label)\', \'image_classification_label\', \'image\' ]') > 0);
        });


        it('should create a images classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'images',
                projectid : uuid(),
                classifierid : uuid(),
                updated : new Date(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'images',
                name : 'TEST',
                language : 'en',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL', 'THIRD LABEL' ],
                numfields : 0,
                isCrowdSourced : false,
            };

            const extension = await extensions.getScratchxExtension(key, proj, 3);
            assert(extension.indexOf('/api/scratch/' + key.id + '/classify') > 0);
            assert(extension.indexOf('return_label_0 () {') > 0);
            assert(extension.indexOf('return_label_1 () {') > 0);
            assert(extension.indexOf('return_label_2 () {') > 0);
            assert(extension.indexOf('return_label_3 () {') === -1);
        });


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

            const extension = await extensions.getScratchxExtension(key, proj, 3);
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

            const extension = await extensions.getScratchxExtension(key, proj, 3);
            assert(extension.indexOf('recognise_label_0 () {') > 0);
            assert(extension.indexOf('recognise_label_1 () {') > 0);
            assert(extension.indexOf('recognise_label_2 () {') > 0);
            assert(extension.indexOf('recognise_label_3 () {') === -1);
        });
    });
});
