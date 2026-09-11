describe('mlImageLoaderParseUrl', function () {

    it('should parse simple key=value pairs', function () {
        var result = mlImageLoaderParseUrl('a=1&b=2');
        expect(result.a).toBe('1');
        expect(result.b).toBe('2');
    });

    it('should decode URI-encoded keys and values', function () {
        var result = mlImageLoaderParseUrl('imgurl=https%3A%2F%2Fexample.com%2Fpic.jpg');
        expect(result.imgurl).toBe('https://example.com/pic.jpg');
    });

    it('should parse PHP-style array syntax', function () {
        var pushed = mlImageLoaderParseUrl('items[]=a&items[]=b');
        expect(pushed.items).toEqual(['a', 'b']);

        var indexed = mlImageLoaderParseUrl('items[0]=a&items[1]=b');
        expect(indexed.items[0]).toBe('a');
        expect(indexed.items[1]).toBe('b');
    });

    it('should not pollute Object.prototype via a __proto__ key', function () {
        expect(({}).polluted).toBeUndefined();

        mlImageLoaderParseUrl('__proto__[polluted]=pwned');

        // the real assertion: parsing a malicious fragment must not have
        //  changed what *every other object on the page* looks like
        expect(({}).polluted).toBeUndefined();
    });

    it('should not pollute Object.prototype via a __proto__ key with array push syntax', function () {
        expect(({}).polluted).toBeUndefined();

        mlImageLoaderParseUrl('__proto__[]=pwned');

        expect(({}).polluted).toBeUndefined();
    });

    it('should still return an own "__proto__" value that behaves like a normal property', function () {
        var result = mlImageLoaderParseUrl('__proto__[polluted]=pwned');
        expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true);
        expect(result.__proto__.polluted).toBe('pwned');
        expect(({}).polluted).toBeUndefined();
    });

});
