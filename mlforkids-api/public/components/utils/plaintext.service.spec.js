describe('plainTextService', function () {

    var plainTextService;

    beforeEach(module('app'));

    beforeEach(inject(function (_plainTextService_) {
        plainTextService = _plainTextService_;
    }));


    it('allows plain text', function () {
        expect(plainTextService.isPlainText('Www.goagle.com')).toBe(true);
        expect(plainTextService.isPlainText('¿Dónde está la biblioteca? 图书馆在哪里 😀')).toBe(true);
        expect(plainTextService.isPlainText('tabs\tand\r\nnew lines')).toBe(true);
        expect(plainTextService.isPlainText('PK is short for penalty kick')).toBe(true);
        expect(plainTextService.isPlainText('')).toBe(true);
    });

    it('rejects binary files', function () {
        // Word 97-2003 document
        expect(plainTextService.isPlainText('��\u0011ࡱ\u001a�\u0000\u0000\u0000\u0000')).toBe(false);
        // .docx / .xlsx / .pptx
        expect(plainTextService.isPlainText('PK\u0003\u0004[Content_Types].xml')).toBe(false);
        // PDF
        expect(plainTextService.isPlainText('%PDF-1.7\n%��')).toBe(false);
    });
});
