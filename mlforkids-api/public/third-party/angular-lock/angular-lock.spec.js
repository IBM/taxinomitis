// Tests for the locally-maintained angular-lock binding (angular-lock.js).
//
// The fake Auth0Lock below defines its methods with Object.defineProperty and
// enumerable:false, which is how Auth0 Lock v13+ defines them (Babel's
// _createClass helper). The abandoned angular-lock npm package that this file
// replaced discovered Lock's methods with a for..in loop, which finds nothing
// on an object shaped like this - see the README in this directory. The first
// test below pins that, so it stays obvious why the method list in
// angular-lock.js is written out by hand.

describe('angular-lock', function () {

    // the most recently constructed fake Lock, so that tests can assert on how
    // the binding drove it
    var lastLock;

    function FakeAuth0Lock(clientID, domain, options) {
        this.clientID = clientID;
        this.domain = domain;
        this.options = options;

        this.calls = [];
        this.handlers = {};

        lastLock = this;
    }

    function defineNonEnumerable(target, name, fn) {
        Object.defineProperty(target, name, {
            value : fn,
            enumerable : false,
            writable : true,
            configurable : true
        });
    }

    // record the call, and keep the callback so a test can fire it later from
    // outside Angular - which is how the real Lock invokes callbacks
    ['show', 'checkSession', 'getUserInfo'].forEach(function (name) {
        defineNonEnumerable(FakeAuth0Lock.prototype, name, function () {
            this.calls.push({ name : name, args : [].slice.call(arguments) });

            var callback = arguments[arguments.length - 1];
            if (typeof callback === 'function') {
                this.pendingCallback = callback;
            }
        });
    });

    // Lock extends EventEmitter - interceptHash() calls emit() directly
    defineNonEnumerable(FakeAuth0Lock.prototype, 'on', function (event, handler) {
        this.handlers[event] = handler;
    });
    defineNonEnumerable(FakeAuth0Lock.prototype, 'emit', function (event, arg) {
        if (this.handlers[event]) {
            this.handlers[event](arg);
        }
    });


    var parseHashCallback;

    beforeEach(function () {
        lastLock = null;
        parseHashCallback = null;

        window.Auth0Lock = FakeAuth0Lock;

        // stand-in for the global that auth0.js defines. interceptHash() hands
        // the URL fragment to parseHash, so capture the callback it passes in.
        window.auth0 = {
            WebAuth : function () {
                this.parseHash = function (options, callback) {
                    parseHashCallback = callback;
                };
            }
        };

        module('auth0.lock');
        module(function (lockProvider) {
            lockProvider.init({
                clientID : 'TEST_CLIENT_ID',
                domain : 'example.auth0.com',
                options : { autoclose : true }
            });
        });
    });


    it('is not discoverable by the for..in loop the npm package used', function () {
        var found = [];
        var lock = new FakeAuth0Lock('id', 'domain', {});

        for (var name in lock) {
            if (typeof lock[name] === 'function') {
                found.push(name);
            }
        }

        expect(found).toEqual([]);
    });


    it('exposes the Lock methods that authService uses', inject(function (lock) {
        ['show', 'checkSession', 'getUserInfo', 'on', 'interceptHash'].forEach(function (name) {
            expect(typeof lock[name]).toBe('function');
        });
    }));


    it('passes the configured clientID, domain and options to Auth0Lock', inject(function (lock) {
        expect(lastLock.clientID).toBe('TEST_CLIENT_ID');
        expect(lastLock.domain).toBe('example.auth0.com');
        expect(lastLock.options.autoclose).toBe(true);
        expect(lastLock.options._telemetryInfo.name).toBe('mlforkids-angular-lock');
    }));


    it('forwards arguments through to Lock', inject(function (lock) {
        lock.show({ languageDictionary : { title : 'Log in to ML for Kids' } });

        expect(lastLock.calls[0].name).toBe('show');
        expect(lastLock.calls[0].args[0].languageDictionary.title).toBe('Log in to ML for Kids');
    }));


    it('runs Lock callbacks inside a digest', inject(function (lock, $rootScope) {
        // authService's callbacks set $rootScope.isAuthenticated and friends.
        // Lock calls them from outside Angular, so without the binding wrapping
        // them in $apply, nothing would notice the change until the next digest.
        var watched;
        $rootScope.$watch('flag', function (value) { watched = value; });
        $rootScope.$digest();

        lock.checkSession({}, function () {
            $rootScope.flag = 'set from callback';
        });
        expect(watched).toBeUndefined();

        // fire the callback the way Lock would - outside Angular, no $apply
        lastLock.pendingCallback(null, { expiresIn : 7200 });

        expect(watched).toBe('set from callback');
    }));


    it('invokes Lock callbacks with Lock as `this`', inject(function (lock) {
        var context;
        lock.getUserInfo('ACCESS_TOKEN', function () { context = this; });

        lastLock.pendingCallback(null, {});

        expect(context).toBe(lastLock);
    }));


    it('re-emits tokens found in the URL as Lock events', inject(function (lock, $rootScope) {
        // authService.setupAuth() listens for 'authenticated', so interceptHash
        // has to turn a fragment coming back from Auth0 into that event
        var authenticatedWith;
        lock.on('authenticated', function (authResult) { authenticatedWith = authResult; });
        lock.interceptHash();

        $rootScope.$broadcast('$locationChangeStart', 'https://example.com/#id_token=ID');
        expect(typeof parseHashCallback).toBe('function');

        parseHashCallback(null, { idToken : 'ID', accessToken : 'ACCESS' });

        expect(authenticatedWith.idToken).toBe('ID');
    }));


    it('re-emits a failure to parse the URL as an authorization_error event', inject(function (lock, $rootScope) {
        var errored;
        lock.on('authorization_error', function (err) { errored = err; });
        lock.interceptHash();

        $rootScope.$broadcast('$locationChangeStart', 'https://example.com/#error=unauthorized');
        parseHashCallback({ error : 'unauthorized' }, null);

        expect(errored.error).toBe('unauthorized');
    }));


    it('ignores location changes that carry no tokens', inject(function (lock, $rootScope) {
        lock.interceptHash();

        $rootScope.$broadcast('$locationChangeStart', 'https://example.com/#/projects');

        expect(parseHashCallback).toBeNull();
    }));


    it('fails at startup if Lock no longer has a method that is needed', function () {
        // a separate fake, so this test cannot leak a modified method definition
        // into the others when jasmine randomises the order they run in
        function LockWithoutCheckSession() {}
        ['show', 'getUserInfo', 'on'].forEach(function (name) {
            defineNonEnumerable(LockWithoutCheckSession.prototype, name, function () {});
        });
        window.Auth0Lock = LockWithoutCheckSession;

        expect(function () {
            inject(function (lock) { return lock; });
        }).toThrowError(/has no checkSession\(\) method/);
    });


    it('fails if interceptHash is used without auth0.js loaded', inject(function (lock) {
        window.auth0 = undefined;

        expect(function () {
            lock.interceptHash();
        }).toThrowError(/auth0\.js version 8 or higher must be loaded/);
    }));
});
