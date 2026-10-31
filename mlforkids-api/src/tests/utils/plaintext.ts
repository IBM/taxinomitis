import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as plaintext from '../../lib/utils/plaintext';


describe('Utils - plaintext', () => {

    it('should allow plain text', () => {
        assert.strictEqual(plaintext.isPlainText('Www.goagle.com'), true);
        assert.strictEqual(plaintext.isPlainText('¿Dónde está la biblioteca? 图书馆在哪里 😀'), true);
        assert.strictEqual(plaintext.isPlainText('tabs\tand\r\nnew lines'), true);
        assert.strictEqual(plaintext.isPlainText(''), true);
    });

    it('should allow text that only mentions file signatures', () => {
        assert.strictEqual(plaintext.isPlainText('PK is short for penalty kick'), true);
        assert.strictEqual(plaintext.isPlainText('a %PDF- file'), true);
    });

    it('should reject text with NUL characters', () => {
        // how a Word 97-2003 document starts, once read as text
        assert.strictEqual(plaintext.isPlainText('��\u0011ࡱ\u001a�\u0000\u0000\u0000\u0000'), false);
        assert.strictEqual(plaintext.isPlainText('hello\u0000world'), false);
    });

    it('should reject zip files', () => {
        // .docx, .xlsx and .pptx files are zip files
        assert.strictEqual(plaintext.isPlainText('PK\u0003\u0004[Content_Types].xml'), false);
    });

    it('should reject PDF files', () => {
        assert.strictEqual(plaintext.isPlainText('%PDF-1.7\n%��'), false);
    });
});
