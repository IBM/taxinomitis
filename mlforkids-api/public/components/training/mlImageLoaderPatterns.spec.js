describe('mlImageLoaderPatterns', function () {

    describe('BAIDU_IMG_REGEX', function () {

        it('should match real Baidu image URLs', function () {
            expect('https://timgsa.baidu.com/timg?a=1').toMatch(mlImageLoaderPatterns.BAIDU_IMG_REGEX);
        });

        it('should not match a host with a character substituted for the dots', function () {
            // an unescaped "." would incorrectly match this, since "." matches
            //  any character - proving the dots are properly escaped
            expect('https://timgsaXbaiduXcom/timg?a=1').not.toMatch(mlImageLoaderPatterns.BAIDU_IMG_REGEX);
        });

        it('should not match an unrelated host that happens to contain "baidu.com"', function () {
            expect('https://timgsa.baidu.com.attacker.example/timg?a=1')
                .not.toMatch(/^https:\/\/timgsa\.baidu\.com\/timg\?/);
        });

    });

    describe('BAIDU_IMG_SRCH_REGEX', function () {

        it('should match real Baidu image search URLs', function () {
            expect('https://image.baidu.com/search/detail?a=1').toMatch(mlImageLoaderPatterns.BAIDU_IMG_SRCH_REGEX);
            expect('https://images.baidu.com/search/detail?a=1').toMatch(mlImageLoaderPatterns.BAIDU_IMG_SRCH_REGEX);
        });

        it('should not match a host with a character substituted for the dots', function () {
            expect('https://imageXbaiduXcom/search/detail?a=1').not.toMatch(mlImageLoaderPatterns.BAIDU_IMG_SRCH_REGEX);
        });

    });

    describe('GOOG_IMG_REGEX', function () {

        it('should match real Google image search URLs', function () {
            expect('https://www.google.com/imgres?imgurl=https://example.com/pic.jpg')
                .toMatch(mlImageLoaderPatterns.GOOG_IMG_REGEX);
        });

        it('should not match a host with a character substituted for the first dot', function () {
            expect('https://wwwXgoogle.com/imgres?imgurl=https://example.com/pic.jpg')
                .not.toMatch(mlImageLoaderPatterns.GOOG_IMG_REGEX);
        });

    });

});
