(function () {

    angular
        .module('app')
        .service('plainTextService', plainTextService);

    plainTextService.$inject = [];


    function plainTextService() {

        const NOT_TEXT_FILE = 'That file isn\'t a text file. Save it as a .txt file and try again.';

        // checks that the contents of a file read as text are really text,
        //  and not a binary file (e.g. a Word document chosen instead of a
        //  .txt file)
        // binary files are full of NUL characters, which text never has.
        //  zip-based files (.docx, .xlsx, .pptx) and PDFs are also recognised
        //  by how they start
        // the server makes the same check, in src/lib/utils/plaintext.ts
        function isPlainText(contents) {
            return contents.indexOf('\u0000') === -1 &&
                   !contents.startsWith('PK\u0003\u0004') &&
                   !contents.startsWith('%PDF-');
        }

        return {
            NOT_TEXT_FILE,
            isPlainText
        };
    }
})();
