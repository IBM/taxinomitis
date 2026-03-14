import { describe, it, before } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';


describe('UI - NLS', () => {

    let en: any;
    let cy: any;
    let de: any;
    let es: any;
    let fa: any;
    let fr: any;
    let ital: any;
    let ko: any;
    let br: any;
    let pt: any;
    let se: any;
    let tr: any;
    let cn: any;
    let tw: any;
    let si: any;
    let nl: any;
    let ja: any;
    let el: any;
    let cs: any;
    let ar: any;
    let hr: any;
    let pl: any;
    let ru: any;
    let ro: any;
    let hu: any;
    let uk: any;
    let hy: any;


    before(() => {
        en = JSON.parse(fs.readFileSync('./public/languages/en.json', 'utf8'));
        cy = JSON.parse(fs.readFileSync('./public/languages/cy.json', 'utf8'));
        de = JSON.parse(fs.readFileSync('./public/languages/de.json', 'utf8'));
        es = JSON.parse(fs.readFileSync('./public/languages/es.json', 'utf8'));
        fa = JSON.parse(fs.readFileSync('./public/languages/fa.json', 'utf8'));
        fr = JSON.parse(fs.readFileSync('./public/languages/fr.json', 'utf8'));
        ital = JSON.parse(fs.readFileSync('./public/languages/it.json', 'utf8'));
        ko = JSON.parse(fs.readFileSync('./public/languages/ko.json', 'utf8'));
        br = JSON.parse(fs.readFileSync('./public/languages/pt-br.json', 'utf8'));
        pt = JSON.parse(fs.readFileSync('./public/languages/pt.json', 'utf8'));
        se = JSON.parse(fs.readFileSync('./public/languages/sv-se.json', 'utf8'));
        tr = JSON.parse(fs.readFileSync('./public/languages/tr.json', 'utf8'));
        cn = JSON.parse(fs.readFileSync('./public/languages/zh-cn.json', 'utf8'));
        tw = JSON.parse(fs.readFileSync('./public/languages/zh-tw.json', 'utf8'));
        si = JSON.parse(fs.readFileSync('./public/languages/si-lk.json', 'utf8'));
        nl = JSON.parse(fs.readFileSync('./public/languages/nl-be.json', 'utf8'));
        ja = JSON.parse(fs.readFileSync('./public/languages/ja.json', 'utf8'));
        el = JSON.parse(fs.readFileSync('./public/languages/el.json', 'utf8'));
        cs = JSON.parse(fs.readFileSync('./public/languages/cs.json', 'utf8'));
        ar = JSON.parse(fs.readFileSync('./public/languages/ar.json', 'utf8'));
        hr = JSON.parse(fs.readFileSync('./public/languages/hr.json', 'utf8'));
        pl = JSON.parse(fs.readFileSync('./public/languages/pl.json', 'utf8'));
        ru = JSON.parse(fs.readFileSync('./public/languages/ru.json', 'utf8'));
        ro = JSON.parse(fs.readFileSync('./public/languages/ro.json', 'utf8'));
        hu = JSON.parse(fs.readFileSync('./public/languages/hu.json', 'utf8'));
        uk = JSON.parse(fs.readFileSync('./public/languages/uk.json', 'utf8'));
        hy = JSON.parse(fs.readFileSync('./public/languages/hy.json', 'utf8'));
    });

    const NO_TRANSLATION_REQUIRED = [
        '.HELP.LOG',
        '.WORKSHEETS.LOCATELARRY.TEACHERSNOTES_URL',
        '.DATASETS.DATA.FAKENEWS.ID'
    ];

    function compareKeys(obj1: any, obj2: any, obj2name: string, keypath = '') {
        for (const key of Object.keys(obj1)) {
            if (key in obj2 === false) {
                const location = keypath + '.' + key;
                if (!NO_TRANSLATION_REQUIRED.includes(location)) {
                    assert.fail(keypath + '.' + key + ' missing from ' + obj2name);
                }
            }

            if (typeof obj1[key] !== 'string') {
                compareKeys(obj1[key], obj2[key], obj2name, keypath + '.' + key);
            }
        }
        for (const key of Object.keys(obj2)) {
            if (key in obj1 === false) {
                assert.fail('Redundant value ' + keypath + '.' + key + ' found in ' + obj2name);
            }
        }
    }

    function extractTemplateVariables(text: string): string[] {
        const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
        const variables: string[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            variables.push(match[1].trim());
        }
        return variables;
    }

    function compareTemplateVariables(obj1: any, obj2: any, obj2name: string, keypath = '') {
        for (const key of Object.keys(obj1)) {
            const currentPath = keypath + '.' + key;

            if (typeof obj1[key] === 'string' && typeof obj2[key] === 'string') {
                const enVars = extractTemplateVariables(obj1[key]);
                const translatedVars = extractTemplateVariables(obj2[key]);

                if (enVars.length > 0) {
                    // Check that all English template variables exist in the translation
                    for (const enVar of enVars) {
                        if (!translatedVars.includes(enVar)) {
                            assert.fail(
                                `Template variable mismatch at ${currentPath} in ${obj2name}: ` +
                                `English has {{ ${enVar} }} but translation has {{ ${translatedVars.join(', ')} }}`
                            );
                        }
                    }

                    // Check that translation doesn't have extra variables
                    for (const translatedVar of translatedVars) {
                        if (!enVars.includes(translatedVar)) {
                            assert.fail(
                                `Extra template variable at ${currentPath} in ${obj2name}: ` +
                                `Translation has {{ ${translatedVar} }} but English expects {{ ${enVars.join(', ')} }}`
                            );
                        }
                    }
                }
            }
            else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
                if (typeof obj2[key] === 'object' && obj2[key] !== null) {
                    compareTemplateVariables(obj1[key], obj2[key], obj2name, currentPath);
                }
            }
        }
    }

    describe('compare keys', () => {

        it('German', () => {
            compareKeys(en, de, 'de');
        });
        it('French', () => {
            compareKeys(en, fr, 'fr');
        });
        it('Italian', () => {
            compareKeys(en, ital, 'it');
        });
        it('Spanish', () => {
            compareKeys(en, es, 'es');
        });
        it('Korean', () => {
            compareKeys(en, ko, 'ko');
        });
        it('Brazillian Portuguese', () => {
            compareKeys(en, br, 'br');
        });
        it('Portuguese', () => {
            compareKeys(en, pt, 'pt');
        });
        it('Swedish', () => {
            compareKeys(en, se, 'se');
        });
        it('Turkish', () => {
            compareKeys(en, tr, 'tr');
        });
        it('Chinese (simplified)', () => {
            compareKeys(en, cn, 'cn');
        });
        it('Chinese (traditional)', () => {
            compareKeys(en, tw, 'tw');
        });
        it('Sinhalese', () => {
            compareKeys(en, si, 'si');
        });
        it('Dutch', () => {
            compareKeys(en, nl, 'nl');
        });
        it('Japanese', () => {
            compareKeys(en, ja, 'ja');
        });
        it('Greek', () => {
            compareKeys(en, el, 'el');
        });
        it('Czech', () => {
            compareKeys(en, cs, 'cs');
        });
        it('Arabic', () => {
            compareKeys(en, ar, 'ar');
        });
        it('Croatian', () => {
            compareKeys(en, hr, 'hr');
        });
        it('Polish', () => {
            compareKeys(en, pl, 'pl');
        });
        it('Russian', () => {
            compareKeys(en, ru, 'ru');
        });
        it('Welsh', () => {
            compareKeys(en, cy, 'cy');
        });
        it('Romanian', () => {
            compareKeys(en, ro, 'ro');
        });
        it('Farsi', () => {
            compareKeys(en, fa, 'fa');
        });
        it('Hungarian', () => {
            compareKeys(en, hu, 'hu');
        });
        it('Ukrainian', () => {
            compareKeys(en, uk, 'uk');
        });
        it('Armenian', () => {
            compareKeys(en, hy, 'hy');
        });
    });

    describe('template variables', () => {
        it('German', () => {
            compareTemplateVariables(en, de, 'de');
        });
        it('French', () => {
            compareTemplateVariables(en, fr, 'fr');
        });
        it('Italian', () => {
            compareTemplateVariables(en, ital, 'it');
        });
        it('Spanish', () => {
            compareTemplateVariables(en, es, 'es');
        });
        it('Korean', () => {
            compareTemplateVariables(en, ko, 'ko');
        });
        it('Brazillian Portuguese', () => {
            compareTemplateVariables(en, br, 'br');
        });
        it('Portuguese', () => {
            compareTemplateVariables(en, pt, 'pt');
        });
        it('Swedish', () => {
            compareTemplateVariables(en, se, 'se');
        });
        it('Turkish', () => {
            compareTemplateVariables(en, tr, 'tr');
        });
        it('Chinese (simplified)', () => {
            compareTemplateVariables(en, cn, 'cn');
        });
        it('Chinese (traditional)', () => {
            compareTemplateVariables(en, tw, 'tw');
        });
        it('Sinhalese', () => {
            compareTemplateVariables(en, si, 'si');
        });
        it('Dutch', () => {
            compareTemplateVariables(en, nl, 'nl');
        });
        it('Japanese', () => {
            compareTemplateVariables(en, ja, 'ja');
        });
        it('Greek', () => {
            compareTemplateVariables(en, el, 'el');
        });
        it('Czech', () => {
            compareTemplateVariables(en, cs, 'cs');
        });
        it('Arabic', () => {
            compareTemplateVariables(en, ar, 'ar');
        });
        it('Croatian', () => {
            compareTemplateVariables(en, hr, 'hr');
        });
        it('Polish', () => {
            compareTemplateVariables(en, pl, 'pl');
        });
        it('Russian', () => {
            compareTemplateVariables(en, ru, 'ru');
        });
        it('Welsh', () => {
            compareTemplateVariables(en, cy, 'cy');
        });
        it('Romanian', () => {
            compareTemplateVariables(en, ro, 'ro');
        });
        it('Farsi', () => {
            compareTemplateVariables(en, fa, 'fa');
        });
        it('Hungarian', () => {
            compareTemplateVariables(en, hu, 'hu');
        });
        it('Ukrainian', () => {
            compareTemplateVariables(en, uk, 'uk');
        });
        it('Armenian', () => {
            compareTemplateVariables(en, hy, 'hy');
        });
    });
});
