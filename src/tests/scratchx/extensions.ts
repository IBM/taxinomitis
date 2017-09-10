/*eslint-env mocha */
import * as assert from 'assert';
import * as uuid from 'uuid/v1';
import * as extensions from '../../lib/scratchx/extensions';
import * as Types from '../../lib/db/db-types';
import * as TrainingTypes from '../../lib/training/training-types';


describe('Scratchx - status', () => {

    describe('text projects', () => {

        it('should create a text classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'text',
                projectid : uuid(),
                classifierid : uuid(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'text',
                name : 'TEST',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL' ],
                numfields : 0,
            };

            const extension = await extensions.getScratchxExtension(key, proj);

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
    });


    describe('numbers projects', () => {

        it('should create a numbers classify extension', async () => {
            const key: Types.ScratchKey = {
                id : uuid(),
                name : 'TEST',
                type : 'numbers',
                projectid : uuid(),
                classifierid : uuid(),
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'numbers',
                name : 'TEST',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'left', 'middle', 'right' ],
                numfields : 4,
                fields : [
                    { name : 'alpha', type : 'number' }, { name : 'beta', type : 'number' },
                    { name : 'gamma', type : 'number' }, { name : 'delta', type : 'number' },
                ],
            };

            const extension = await extensions.getScratchxExtension(key, proj);

            assert(extension.indexOf('/api/scratch/' + key.id + '/status') > 0);
            assert(extension.indexOf('/api/scratch/' + key.id + '/classify') > 0);
            assert(extension.indexOf('ext.return_label_0 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_1 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_2 = function () {') > 0);
            assert(extension.indexOf('ext.return_label_3 = function () {') === -1);
            assert(extension.indexOf('[ \'r\', \'left\', \'return_label_0\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'middle\', \'return_label_1\'],') > 0);
            assert(extension.indexOf('[ \'r\', \'right\', \'return_label_2\'],') > 0);
            assert(extension.indexOf(
                '[ \'R\', ' +
                '\'recognise numbers alpha %n beta %n gamma %n delta %n  (label)\', ' +
                '\'numbers_classification_label\' ]') > 0);
            assert(extension.indexOf(
                '[ \'R\', ' +
                '\'recognise numbers alpha %n beta %n gamma %n delta %n  (confidence)\', ' +
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
            };
            const proj: Types.Project = {
                id : uuid(),
                type : 'images',
                name : 'TEST',
                userid : uuid(),
                classid : uuid(),
                labels : [ 'LABEL NUMBER ONE', 'SECOND LABEL', 'THIRD LABEL' ],
                numfields : 0,
            };

            const extension = await extensions.getScratchxExtension(key, proj);

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
                '[ \'R\', \'recognise image %s (label)\', \'image_classification_label\', \'costume image\' ]') > 0);
        });
    });
});
