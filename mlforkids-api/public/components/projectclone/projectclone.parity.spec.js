// A clone is meant to be indistinguishable from a project the user created
// themselves - "a peer of its source". Nothing downstream should be able 
// to tell the difference.
//
// This caught a real bug once already: the clone was written to IndexedDB
// without a userid, and browserStorageService.getProjects() filters local
// projects by userid in javascript, so the clone existed but never appeared
// in the user's project list.
//
// The field list is NOT hand-copied here. The new-project form builds its
// project spec inline in an ng-click expression in newproject.html, so this
// spec pulls that real expression out of $templateCache and evaluates it - if
// someone adds a field to the form, this spec sees it and the clone has to
// keep up.
describe('cloned projects match natively-created ones', function () {

    var $httpBackend, $q, $rootScope, $parse, $templateCache;
    var projectCloneService, projectsService;
    var browserStorageServiceMock, loggerServiceMock, utilServiceMock;

    var profile = { user_id : 'user1', tenant : 'class1' };

    var TEMPLATE_PATH = 'public/components/newproject/newproject.html';

    beforeEach(module('app'));
    beforeEach(module('ml4kTemplates'));

    beforeEach(function () {
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'isSupported', 'addProject', 'bulkAddTrainingData', 'idIsLocal', 'sanitizeLabel'
        ]);
        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);
        // karma has already loaded the real JSZip, so the lazy load importing
        //  does is a no-op here
        utilServiceMock = jasmine.createSpyObj('utilService', ['loadZipSupport']);

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
            $provide.value('loggerService', loggerServiceMock);
            $provide.value('utilService', utilServiceMock);
        });

        inject(function (_$httpBackend_, _$q_, _$rootScope_, _$parse_, _$templateCache_,
                         _projectCloneService_, _projectsService_)
        {
            $httpBackend = _$httpBackend_;
            $q = _$q_;
            $rootScope = _$rootScope_;
            $parse = _$parse_;
            $templateCache = _$templateCache_;
            projectCloneService = _projectCloneService_;
            projectsService = _projectsService_;
        });

        browserStorageServiceMock.isSupported.and.returnValue($q.resolve(1));
        browserStorageServiceMock.bulkAddTrainingData.and.returnValue($q.resolve());
        browserStorageServiceMock.sanitizeLabel.and.callFake(function (label) {
            return label.replace(/[^\w.]/g, '_').substring(0, 30);
        });
        utilServiceMock.loadZipSupport.and.returnValue($q.resolve());
        // mimics the real addProject: assigns the auto-increment key and
        //  returns the record it was given
        browserStorageServiceMock.addProject.and.callFake(function (projectInfo) {
            if (!projectInfo.labels) {
                projectInfo.labels = [];
            }
            if (projectInfo.type === 'sounds') {
                projectInfo.labels.push('_background_noise_');
            }
            projectInfo.id = 42;
            return $q.resolve(projectInfo);
        });
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    // pull the vm.confirm({...}) argument out of the real form template
    function newProjectSpecExpression() {
        var template = $templateCache.get(TEMPLATE_PATH);
        expect(template).toBeDefined();

        var match = /vm\.confirm\((\{[\s\S]*?\})\)/.exec(template);
        expect(match).not.toBeNull();

        return match[1];
    }

    // build the project record the new-project form would have produced, by
    //  evaluating the form's own expression and running it through the same
    //  service the form uses
    function createProjectNatively(type) {
        var scope = $rootScope.$new();
        scope.projectName = 'Example';
        scope.projectType = type;
        scope.projectStorage = 'local';
        scope.language = 'en';
        scope.isTeacher = false;
        scope.crowdSourced = false;
        scope.vm = { fields : [] };

        var projectSpec = $parse(newProjectSpecExpression())(scope);

        // vm.confirm() strips fields for every type except numbers
        if (projectSpec.type !== 'numbers') {
            delete projectSpec.fields;
        }

        var created;
        projectsService.createProject(projectSpec, profile.user_id, profile.tenant)
            .then(function (project) {
                created = project;
            });
        $rootScope.$digest();

        return created;
    }

    function createProjectByCloning(type) {
        var cloudProject = {
            id : 'cloud1',
            name : 'Example',
            type : type,
            language : 'en',
            labels : []
        };

        if (type === 'numbers') {
            $httpBackend.expectGET('/api/classes/class1/students/user1/projects/cloud1/fields')
                .respond(200, []);
        }
        $httpBackend.expectGET('/api/classes/class1/students/user1/projects/cloud1/training')
            .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

        var created;
        projectCloneService.cloneProject(cloudProject, profile)
            .then(function (result) {
                created = result.project;
            });
        $httpBackend.flush();

        return created;
    }


    // an imported project has to clear the same bar as a clone: it is a
    //  project the child now owns, and nothing downstream should be able to
    //  tell it came out of a file
    function createProjectByImporting(type) {
        var zip = new JSZip();
        zip.file('manifest.json', JSON.stringify({
            formatversion : 1,
            exported : '2026-08-08T12:00:00.000Z',
            application : 'machinelearningforkids'
        }));
        zip.file('project.json', JSON.stringify({
            id : 'projectid', userid : 'userid', classid : 'classid',
            type : type, name : 'Example', labels : [],
            language : 'en', numfields : 0, fields : [], isCrowdSourced : false
        }));
        zip.file('training.json', JSON.stringify([]));

        var created;
        var finished = false;

        zip.generateAsync({ type : 'blob' })
            .then(function (archive) {
                return projectCloneService.importProject(archive, profile);
            })
            .then(function (result) {
                created = result.project;
                finished = true;
            })
            .catch(function (err) {
                finished = true;
                fail(err);
            });

        // JSZip works in native promises, so the digest that settles the $q
        //  chain has to be pumped from a macrotask
        return new Promise(function (resolve) {
            (function pump() {
                if (finished) {
                    return resolve(created);
                }
                try {
                    $rootScope.$digest();
                }
                catch (alreadyInDigest) { /* expected */ }
                setTimeout(pump, 1);
            }());
        });
    }


    [ 'text', 'numbers', 'sounds', 'imgtfjs' ].forEach(function (type) {

        it('a cloned ' + type + ' project has every field a new ' + type + ' project has', function () {
            var native = createProjectNatively(type);
            var cloned = createProjectByCloning(type);

            expect(native).toBeDefined();
            expect(cloned).toBeDefined();

            var missing = Object.keys(native).filter(function (field) {
                return !(field in cloned);
            });

            expect(missing).toEqual([]);
        });


        it('an imported ' + type + ' project has every field a new ' + type + ' project has',
        async function () {
            var native = createProjectNatively(type);
            var imported = await createProjectByImporting(type);

            expect(native).toBeDefined();
            expect(imported).toBeDefined();

            var missing = Object.keys(native).filter(function (field) {
                return !(field in imported);
            });

            expect(missing).toEqual([]);
        });

    });


    it('never marks a clone as crowd-sourced, even when its source was', function () {
        // a shared class project can be cloned by any student in the class,
        //  but the clone is theirs alone - browser storage is single-user, and
        //  inheriting the flag would misrepresent it as shared
        $httpBackend.expectGET('/api/classes/class1/students/user1/projects/cloud1/training')
            .respond(200, [], { 'Content-Range' : 'items 0--1/0' });

        var created;
        projectCloneService.cloneProject({
                id : 'cloud1', name : 'Class project', type : 'text',
                language : 'en', labels : [], isCrowdSourced : true
            }, profile)
            .then(function (result) {
                created = result.project;
            });
        $httpBackend.flush();

        expect(created.isCrowdSourced).toBe(false);
    });


    it('gives a cloned project the same owner as a new one', function () {
        var native = createProjectNatively('text');
        var cloned = createProjectByCloning('text');

        expect(cloned.userid).toBe(native.userid);
        expect(cloned.classid).toBe(native.classid);
        expect(cloned.storage).toBe(native.storage);
    });

});
