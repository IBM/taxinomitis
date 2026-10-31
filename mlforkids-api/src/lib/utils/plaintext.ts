/**
 * Checks that a string is plain text, and not the contents of a
 *  binary file (e.g. a Word document chosen instead of a .txt file)
 *  that was read as if it were text.
 *
 * Binary files are full of NUL characters, which plain text never
 *  contains. Zip-based files (.docx, .xlsx, .pptx) and PDFs are also
 *  recognised by how they start.
 *
 * The browser makes the same check when text files are uploaded,
 *  in public/components/utils/txt.service.js
 */
export function isPlainText(text: string): boolean {
    return text.indexOf('\u0000') === -1 &&
           !text.startsWith('PK\u0003\u0004') &&
           !text.startsWith('%PDF-');
}


export const NOT_PLAIN_TEXT = 'Training data must be plain text';
