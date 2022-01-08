/*eslint-env mocha */
import * as assert from 'assert';
import * as baidu from '../../lib/utils/baidu';



describe('Utils - baidu', () => {

    it('should recognise a Baidu image search result', () => {
        for (const validurl of VALID_URLS) {
            assert.strictEqual(baidu.isBaiduImageSearchResult(validurl), true);
        }
    });

    it('should reject non-Baidu image search results', () => {
        for (const invalidurl of INVALID_URLS) {
            assert.strictEqual(baidu.isBaiduImageSearchResult(invalidurl), false);
        }
    });

    it('should get source URL of Baidu image search results', () => {
        return Promise.all(VALID_URLS.map((url) => baidu.getSource(url)))
            .then((responses) => {
                assert.deepStrictEqual(responses, EXPECTED_URL_SRCS);
            });
    });

    it('should ignore non-Baidu image search results', () => {
        return Promise.all(INVALID_URLS.map((url) => baidu.getSource(url)))
            .then((responses) => {
                assert.deepStrictEqual(responses, INVALID_URLS);
            });
    });


    // ts-lint:disable:max-line-length

    const VALID_URLS = [
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187208229&di=1d4a5c8511c61428925fc61638521079&imgtype=0&src=http%3A%2F%2Fimg14.360buyimg.com%2Fn1%2Fjfs%2Ft24178%2F137%2F1056052833%2F154182%2F3cc8901b%2F5b4eb752N3906ab64.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187208236&di=d98a598d820c9bbfe2cc32ee13dd991c&imgtype=0&src=http%3A%2F%2Fimg14.360buyimg.com%2Fn1%2Fs350x449_jfs%2Ft18295%2F194%2F1604708725%2F83557%2F6ed57ab3%2F5ad09766N2e11eafa.jpg%2521cc_350x449.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187064780&di=0858946d296e7b97b070655b231308b4&imgtype=0&src=http%3A%2F%2Fpic27.nipic.com%2F20130326%2F11678744_080329047000_2.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187064789&di=d09b8fa282dfe0a00b795ca42dc95734&imgtype=0&src=http%3A%2F%2Ffile03.16sucai.com%2F2016%2F10%2F1100%2F16sucai_p20161026111_4bd.JPG',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187064790&di=18f3542122387cc83306d805f857c1f1&imgtype=0&src=http%3A%2F%2Fimg.pptjia.com%2Fimage%2F20171229%2F0a6aa1e4b3962a92d7a5b741f75c74c9.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187064793&di=684409a9b848ca0ad31f8796c8fb5aad&imgtype=0&src=http%3A%2F%2Fpic23.photophoto.cn%2F20120405%2F0020033003675307_b.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187064797&di=9e5e5440ff7ef2f59cc3d3b82def4e4b&imgtype=0&src=http%3A%2F%2Fimg.hexun.com%2F2011-06-09%2F130365728.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187064799&di=656d38ba928aaa046cf3293b48d7ab81&imgtype=0&src=http%3A%2F%2Fimage03.71.net%2Fimage03%2F09%2F15%2F38%2F95%2F0eb25e42-5ecb-4df9-b683-b2fc60b6a540.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187110383&di=40ddb6224ec5ea6f04950e236519ddf4&imgtype=0&src=http%3A%2F%2Ffile16.zk71.com%2FFile%2FCorpEditInsertImages%2F2017%2F10%2F12%2F0_cdzxb_20171012105007.jpg',
        'https://timgsa.baidu.com/timg?image&quality=80&size=b9999_10000&sec=1572187110385&di=9fccf15297fe46a019b5d6146fcfceba&imgtype=0&src=http%3A%2F%2Fimg003.hc360.cn%2Fy5%2FM05%2F3A%2F44%2FwKhQUVXNBFSEXeScAAAAALqh1-w298.jpg',
    ];
    const EXPECTED_URL_SRCS = [
        'http://img14.360buyimg.com/n1/jfs/t24178/137/1056052833/154182/3cc8901b/5b4eb752N3906ab64.jpg',
        'http://img14.360buyimg.com/n1/s350x449_jfs/t18295/194/1604708725/83557/6ed57ab3/5ad09766N2e11eafa.jpg%21cc_350x449.jpg',
        'http://pic27.nipic.com/20130326/11678744_080329047000_2.jpg',
        'http://file03.16sucai.com/2016/10/1100/16sucai_p20161026111_4bd.JPG',
        'http://img.pptjia.com/image/20171229/0a6aa1e4b3962a92d7a5b741f75c74c9.jpg',
        'http://pic23.photophoto.cn/20120405/0020033003675307_b.jpg',
        'http://img.hexun.com/2011-06-09/130365728.jpg',
        'http://image03.71.net/image03/09/15/38/95/0eb25e42-5ecb-4df9-b683-b2fc60b6a540.jpg',
        'http://file16.zk71.com/File/CorpEditInsertImages/2017/10/12/0_cdzxb_20171012105007.jpg',
        'http://img003.hc360.cn/y5/M05/3A/44/wKhQUVXNBFSEXeScAAAAALqh1-w298.jpg',
    ];

    const INVALID_URLS = [
        'https://something.com/mygreatpicture.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/16/Maltese_kitten.jpeg',
        'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
        'https://upload.wikimedia.org/wikipedia/commons/d/dc/BrownSpiderMonkey_%28edit2%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/3/39/Narval.JPG',
        'https://upload.wikimedia.org/wikipedia/commons/4/4c/Push_van_cat.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/BrownSpiderMonkey_%28edit2%29.jpg/244px-BrownSpiderMonkey_%28edit2%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Narval.JPG/244px-Narval.JPG',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Push_van_cat.jpg/244px-Push_van_cat.jpg',
    ];

});


