import { describe, it } from 'node:test';
import * as assert from 'assert';
import { v1 as uuid } from 'uuid';
import * as extensions from '../../lib/scratchx/extensions';
import * as Types from '../../lib/db/db-types';


describe('Scratchx - extensions', () => {

    describe('escapeProjectName()', () => {

        // escapeProjectName()'s output is embedded, unescaped, directly
        //  into a single-quoted JS string literal in the generated
        //  extension file (`name: '{{{ projectname }}}',`), so the only
        //  way to prove the escaping is actually safe is to round-trip
        //  it through a real JS parser, the same way a browser loading
        //  the extension would - a naive string comparison could miss
        //  an escaping bug that a JS parser would still be tricked by
        function evalAsJsStringLiteral(escaped: string): string {
            // eslint-disable-next-line no-eval
            return eval("'" + escaped + "'");
        }

        it('should round-trip plain names unchanged', () => {
            const name = 'My Project';
            assert.strictEqual(evalAsJsStringLiteral(extensions.escapeProjectName(name)), name);
        });

        it('should round-trip apostrophes', () => {
            const name = "This is Dale's test";
            assert.strictEqual(evalAsJsStringLiteral(extensions.escapeProjectName(name)), name);
        });

        it('should not allow a backslash to break out of the string literal', () => {
            // a name ending in a single backslash immediately before a
            //  quote-escaping backslash would - if backslashes aren't
            //  escaped first - cancel out the quote-escaping and let the
            //  string literal terminate early, injecting whatever
            //  follows as executable code
            const payload = "\\';alert(document.cookie);//";
            const escaped = extensions.escapeProjectName(payload);

            // if the escaping is broken, this throws (a syntax error from
            //  the injected code) or returns something other than the
            //  original payload (having been truncated at the injected
            //  quote) - either way, it proves the string literal was
            //  escaped from
            assert.strictEqual(evalAsJsStringLiteral(escaped), payload);
        });

        it('should not allow a backslash to break out when followed directly by more content', () => {
            const payload = "\\'});alert(1);({a:'";
            const escaped = extensions.escapeProjectName(payload);
            assert.strictEqual(evalAsJsStringLiteral(escaped), payload);
        });

        it('should preserve multiple consecutive backslashes', () => {
            const name = 'back\\\\slash\\\\name';
            assert.strictEqual(evalAsJsStringLiteral(extensions.escapeProjectName(name)), name);
        });

    });


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
