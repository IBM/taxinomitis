/*eslint-env mocha */
import * as assert from 'assert';
import * as fs from 'fs';


describe('UI - NLS', () => {

    let en: any;
    let de: any;
    let es: any;
    let fr: any;
    let ko: any;
    let br: any;
    let se: any;
    let tr: any;
    let cn: any;
    let si: any;
    let nl: any;
    let ja: any;

    before(() => {
        en = JSON.parse(fs.readFileSync('./public/languages/en.json', 'utf8'));
        de = JSON.parse(fs.readFileSync('./public/languages/de.json', 'utf8'));
        es = JSON.parse(fs.readFileSync('./public/languages/es.json', 'utf8'));
        fr = JSON.parse(fs.readFileSync('./public/languages/fr.json', 'utf8'));
        ko = JSON.parse(fs.readFileSync('./public/languages/ko.json', 'utf8'));
        br = JSON.parse(fs.readFileSync('./public/languages/pt-br.json', 'utf8'));
        se = JSON.parse(fs.readFileSync('./public/languages/sv-se.json', 'utf8'));
        tr = JSON.parse(fs.readFileSync('./public/languages/tr.json', 'utf8'));
        cn = JSON.parse(fs.readFileSync('./public/languages/zh-cn.json', 'utf8'));
        si = JSON.parse(fs.readFileSync('./public/languages/si-lk.json', 'utf8'));
        nl = JSON.parse(fs.readFileSync('./public/languages/nl-be.json', 'utf8'));
        ja = JSON.parse(fs.readFileSync('./public/languages/ja.json', 'utf8'));
    });


    function compareKeys(obj1: any, obj2: any, obj2name: string, keypath = '') {
        for (const key of Object.keys(obj1)) {
            if (key in obj2 === false) {
                assert.fail(keypath + '.' + key + ' missing from ' + obj2name);
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

    it('German', () => {
        compareKeys(en, de, 'de');
    });
    it('French', () => {
        compareKeys(en, fr, 'fr');
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
    it('Swedish', () => {
        compareKeys(en, se, 'se');
    });
    it('Turkish', () => {
        compareKeys(en, tr, 'tr');
    });
    it('Chinese', () => {
        compareKeys(en, cn, 'cn');
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
});
