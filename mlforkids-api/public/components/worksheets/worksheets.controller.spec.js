describe('WorksheetsController', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;
    var $sce;

    var $translateMock, $mdDialogMock, $locationMock;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$sce_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
        $sce = _$sce_;
    }));

    beforeEach(function () {
        // identity translations - each key resolves to itself, so tests can
        // assert on the translation keys used to build each worksheet
        $translateMock = jasmine.createSpy('$translate').and.callFake(function (keys) {
            var translations = {};
            keys.forEach(function (key) {
                translations[key] = key;
            });
            return $q.resolve(translations);
        });
        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);
        $locationMock = {
            search : jasmine.createSpy('search').and.returnValue({})
        };
    });

    function createController() {
        return $controller('WorksheetsController', {
            $translate : $translateMock,
            $mdDialog : $mdDialogMock,
            $scope : $scope,
            $location : $locationMock,
            $sce : $sce
        });
    }


    describe('worksheets list', function () {

        it('populates vm.worksheets with translated content after $translate resolves', function () {
            var vm = createController();
            $rootScope.$digest();

            expect(vm.worksheets.length).toBeGreaterThan(0);

            var mailmanmax = vm.worksheets.find(function (w) {
                return w.title === 'WORKSHEETS.MAILMANMAX.TITLE';
            });
            expect(mailmanmax).toBeDefined();
            expect(mailmanmax.summary).toBe('WORKSHEETS.MAILMANMAX.SUMMARY');
            expect(mailmanmax.downloads[0].worksheet).toBe('WORKSHEETS.MAILMANMAX.WORKSHEET_1.URL');
        });

        it('is empty before $translate resolves', function () {
            var vm = createController();

            expect(vm.worksheets).toEqual([]);
        });

        it('includes multiple downloads with their own descriptions for worksheets with several parts', function () {
            var vm = createController();
            $rootScope.$digest();

            var smartclassroom = vm.worksheets.find(function (w) {
                return w.title === 'WORKSHEETS.SMARTCLASSROOM.TITLE';
            });
            expect(smartclassroom.downloads.length).toBe(3);
            expect(smartclassroom.downloads[0].description).toBe('WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.DESCRIPTION');
            expect(smartclassroom.downloads[1].description).toBe('WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.DESCRIPTION');
        });

    });


    describe('featured worksheet selection', function () {

        it('selects the featured worksheet matching the ?worksheet= query parameter, case-insensitively', function () {
            $locationMock.search.and.returnValue({ worksheet : 'workSHEETS.pacman.TITLE' });

            createController();
            $rootScope.$digest();

            expect($scope.featuredWorksheet.title).toBe('WORKSHEETS.PACMAN.TITLE');
        });

        it('falls back to a random featured worksheet when the query parameter does not match any worksheet', function () {
            $locationMock.search.and.returnValue({ worksheet : 'not-a-real-worksheet' });
            spyOn(Math, 'random').and.returnValue(0);

            createController();
            $rootScope.$digest();

            // first worksheet in the list with a "featured" array is mailmanmax
            expect($scope.featuredWorksheet.title).toBe('WORKSHEETS.MAILMANMAX.TITLE');
        });

        it('picks a random featured worksheet when no query parameter is present', function () {
            spyOn(Math, 'random').and.returnValue(0);

            createController();
            $rootScope.$digest();

            expect($scope.featuredWorksheet.title).toBe('WORKSHEETS.MAILMANMAX.TITLE');
        });

        it('only ever picks a worksheet that has "featured" content', function () {
            createController();
            $rootScope.$digest();

            expect($scope.featuredWorksheet.featured).toBeDefined();
        });

        it('trusts a YouTube URL built from the featured worksheet video id', function () {
            $locationMock.search.and.returnValue({ worksheet : 'WORKSHEETS.PACMAN.TITLE' });

            createController();
            $rootScope.$digest();

            var url = $sce.getTrustedResourceUrl($scope.featuredWorksheetVideo);
            expect(url).toContain('https://www.youtube-nocookie.com/embed/5oNjvYEEvDo');
        });

    });


    describe('downloadWorksheet', function () {

        var worksheetWithVideo = { title : 'Test worksheet with video', video : 'abc123' };
        var worksheetWithoutVideo = { title : 'Test worksheet without video' };

        it('opens an $mdDialog with the worksheet and triggering event', function () {
            var vm = createController();
            $rootScope.$digest();

            var ev = { target : 'download-button' };
            vm.downloadWorksheet(ev, worksheetWithVideo);

            expect($mdDialogMock.show).toHaveBeenCalled();
            var options = $mdDialogMock.show.calls.mostRecent().args[0];
            expect(options.locals.worksheet).toBe(worksheetWithVideo);
            expect(options.templateUrl).toBe('static/components/worksheets/download.tmpl.html');
            expect(options.targetEvent).toBe(ev);
            expect(options.clickOutsideToClose).toBe(true);
        });

        it('trusts a video URL on the dialog scope when the worksheet has a video', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.downloadWorksheet({}, worksheetWithVideo);
            var options = $mdDialogMock.show.calls.mostRecent().args[0];

            var dialogScope = {};
            options.controller(dialogScope, { worksheet : worksheetWithVideo });

            expect(dialogScope.worksheet).toBe(worksheetWithVideo);
            var url = $sce.getTrustedResourceUrl(dialogScope.video);
            expect(url).toContain('https://www.youtube-nocookie.com/embed/abc123');
        });

        it('does not set a video URL on the dialog scope when the worksheet has no video', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.downloadWorksheet({}, worksheetWithoutVideo);
            var options = $mdDialogMock.show.calls.mostRecent().args[0];

            var dialogScope = {};
            options.controller(dialogScope, { worksheet : worksheetWithoutVideo });

            expect(dialogScope.video).toBeUndefined();
        });

        it('hide() and cancel() on the dialog scope delegate to $mdDialog', function () {
            var vm = createController();
            $rootScope.$digest();

            vm.downloadWorksheet({}, worksheetWithVideo);
            var options = $mdDialogMock.show.calls.mostRecent().args[0];

            var dialogScope = {};
            options.controller(dialogScope, { worksheet : worksheetWithVideo });

            dialogScope.hide();
            expect($mdDialogMock.hide).toHaveBeenCalled();

            dialogScope.cancel();
            expect($mdDialogMock.cancel).toHaveBeenCalled();
        });

    });


    describe('filterWorksheets', function () {

        var vm;

        beforeEach(function () {
            vm = createController();
            $rootScope.$digest();

            $scope.projecttype = 'ALL';
            $scope.projectdifficulty = 'ALL';
            $scope.projectmaketype = 'ALL';
        });

        it('matches everything when all filters are ALL', function () {
            var item = { type : 'images', difficulty : 2, maketypes : [ 'scratch3' ] };
            expect($scope.filterWorksheets(item)).toBe(true);
        });

        describe('type filter', function () {

            it('matches an item with the same type', function () {
                $scope.projecttype = 'images';
                var item = { type : 'images', difficulty : 1, maketypes : [] };
                expect($scope.filterWorksheets(item)).toBe(true);
            });

            it('rejects an item with a different type', function () {
                $scope.projecttype = 'images';
                var item = { type : 'sounds', difficulty : 1, maketypes : [] };
                expect($scope.filterWorksheets(item)).toBe(false);
            });

        });

        describe('difficulty filter', function () {

            it('matches loosely, treating the filter string and item number as equal', function () {
                $scope.projectdifficulty = '2';
                var item = { type : 'images', difficulty : 2, maketypes : [] };
                expect($scope.filterWorksheets(item)).toBe(true);
            });

            it('rejects an item with a different difficulty', function () {
                $scope.projectdifficulty = '2';
                var item = { type : 'images', difficulty : 3, maketypes : [] };
                expect($scope.filterWorksheets(item)).toBe(false);
            });

        });

        describe('maketype filter', function () {

            it('matches python projects', function () {
                $scope.projectmaketype = 'python';
                var item = { type : 'numbers', difficulty : 1, maketypes : [ 'python' ] };
                expect($scope.filterWorksheets(item)).toBe(true);
            });

            it('rejects a non-python project when filtering for python', function () {
                $scope.projectmaketype = 'python';
                var item = { type : 'numbers', difficulty : 1, maketypes : [ 'scratch3' ] };
                expect($scope.filterWorksheets(item)).toBe(false);
            });

            it('matches appinventor projects', function () {
                $scope.projectmaketype = 'appinventor';
                var item = { type : 'numbers', difficulty : 1, maketypes : [ 'appinventor' ] };
                expect($scope.filterWorksheets(item)).toBe(true);
            });

            it('matches scratch2 projects when filtering for scratch', function () {
                $scope.projectmaketype = 'scratch';
                var item = { type : 'images', difficulty : 1, maketypes : [ 'scratch2' ] };
                expect($scope.filterWorksheets(item)).toBe(true);
            });

            it('matches scratch3 projects when filtering for scratch', function () {
                $scope.projectmaketype = 'scratch';
                var item = { type : 'images', difficulty : 1, maketypes : [ 'scratch3' ] };
                expect($scope.filterWorksheets(item)).toBe(true);
            });

            it('rejects a python project when filtering for scratch', function () {
                $scope.projectmaketype = 'scratch';
                var item = { type : 'images', difficulty : 1, maketypes : [ 'python' ] };
                expect($scope.filterWorksheets(item)).toBe(false);
            });

        });

        it('requires every active filter to match', function () {
            $scope.projecttype = 'images';
            $scope.projectdifficulty = '2';
            $scope.projectmaketype = 'python';

            var matching = { type : 'images', difficulty : 2, maketypes : [ 'python' ] };
            var wrongDifficulty = { type : 'images', difficulty : 1, maketypes : [ 'python' ] };

            expect($scope.filterWorksheets(matching)).toBe(true);
            expect($scope.filterWorksheets(wrongDifficulty)).toBe(false);
        });

    });

});
