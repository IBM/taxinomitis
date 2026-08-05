describe('projectsService', function () {

    var $httpBackend;
    var $q;
    var $rootScope;
    var projectsService;
    var browserStorageServiceMock;

    var profile = { user_id : 'user1', tenant : 'class1' };

    beforeEach(function () {
        browserStorageServiceMock = jasmine.createSpyObj('browserStorageService', [
            'getProjects', 'idIsLocal', 'getProject', 'deleteProject', 'addLabel', 'addCloudRefToProject',
            'addProject', 'deleteLabel', 'getLabelCounts', 'countTrainingData', 'addMetadataToProject',
            'setLanguageModelType', 'storeSmallLanguageModelConfig', 'storeToyLanguageModelConfig'
        ]);

        module('app', function ($provide) {
            $provide.value('browserStorageService', browserStorageServiceMock);
        });

        inject(function (_$httpBackend_, _$q_, _$rootScope_, _projectsService_) {
            $httpBackend = _$httpBackend_;
            $q = _$q_;
            $rootScope = _$rootScope_;
            projectsService = _projectsService_;
        });
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });


    describe('getProjects', function () {

        it('combines cloud projects with locally-stored projects', function () {
            var cloudProjects = [ { id : 'cloud1', name : 'Cloud project' } ];
            var localProjects = [ { id : 'local1', name : 'Local project' } ];

            browserStorageServiceMock.getProjects.and.returnValue($q.resolve(localProjects));

            $httpBackend.expectGET('/api/classes/class1/students/user1/projects')
                .respond(200, cloudProjects);

            var result;
            projectsService.getProjects(profile).then(function (projects) {
                result = projects;
            });

            $httpBackend.flush();

            expect(browserStorageServiceMock.getProjects).toHaveBeenCalledWith('user1');
            expect(result).toEqual(cloudProjects.concat(localProjects));
        });

    });


    describe('deleteProject', function () {

        it('deletes a cloud-stored project via the API', function () {
            var project = { id : 'proj1', storage : 'cloud' };

            $httpBackend.expectDELETE('/api/classes/class1/students/user1/projects/proj1')
                .respond(204);

            projectsService.deleteProject(project, 'user1', 'class1');

            $httpBackend.flush();

            expect(browserStorageServiceMock.deleteProject).not.toHaveBeenCalled();
        });

        it('deletes a locally-stored project from browser storage, without an API call', function () {
            var project = { id : 'proj2', storage : 'local', type : 'numbers' };

            browserStorageServiceMock.deleteProject.and.returnValue($q.resolve());

            projectsService.deleteProject(project, 'user1', 'class1');

            expect(browserStorageServiceMock.deleteProject).toHaveBeenCalledWith('proj2');
        });

        it('also deletes the cloud reference for a shared local text project', function () {
            var project = { id : 'proj3', storage : 'local', type : 'text', cloudid : 'cloudref1' };

            browserStorageServiceMock.deleteProject.and.returnValue($q.resolve());

            $httpBackend.expectDELETE('/api/classes/class1/students/user1/localprojects/cloudref1')
                .respond(204);

            projectsService.deleteProject(project, 'user1', 'class1');

            $httpBackend.flush();
        });

    });


    describe('addLabelToProject', function () {

        it('recovers when the local project no longer has a cloud reference to clear', function () {
            // e.g. the project was deleted locally between the cloud PUT 404-ing
            //  and the clean-up call running - browserStorageService.addCloudRefToProject
            //  then rejects with a "not found" error, which must not go unhandled
            var project = {
                id : 'proj4', storage : 'local', type : 'text',
                cloudid : 'cloudref1', classid : 'class1', userid : 'user1'
            };

            browserStorageServiceMock.addLabel.and.returnValue($q.resolve([ 'labelA', 'labelB' ]));
            // built lazily (not a pre-built $q.reject() passed to returnValue) so the
            // rejected promise is created in the same digest turn that consumes it -
            // otherwise $q's errorOnUnhandledRejections watchdog can flag it as
            // unhandled before submitLocalProjectLabels()'s .catch() gets attached,
            // throwing from deep inside a digest and leaving $rootScope.$$phase stuck,
            // which then makes the afterEach's $httpBackend.verifyNoOutstandingExpectation()
            // fail with "$digest already in progress"
            browserStorageServiceMock.addCloudRefToProject.and.callFake(function () {
                return $q.reject({ status : 404, data : { error : 'not found' } });
            });

            $httpBackend.expectPUT('/api/classes/class1/students/user1/localprojects/cloudref1')
                .respond(404);

            var result;
            projectsService.addLabelToProject(project, 'user1', 'class1', 'labelC')
                .then(function (labels) {
                    result = labels;
                });

            $httpBackend.flush();
            $rootScope.$digest();

            expect(result).toEqual([ 'labelA', 'labelB' ]);
            expect(project.cloudid).toBeUndefined();
            expect(browserStorageServiceMock.addCloudRefToProject).toHaveBeenCalledWith('proj4', null);
        });


        it('patches the labels of a cloud project through the API', function () {
            var project = { id : 'proj1', type : 'text' };

            $httpBackend.expectPATCH('/api/classes/class1/students/user1/projects/proj1', [
                { op : 'add', path : '/labels', value : 'labelC' }
            ]).respond(200, [ 'labelA', 'labelC' ]);

            var result;
            projectsService.addLabelToProject(project, 'user1', 'class1', 'labelC')
                .then(function (labels) { result = labels; });
            $httpBackend.flush();

            expect(result).toEqual([ 'labelA', 'labelC' ]);
            expect(browserStorageServiceMock.addLabel).not.toHaveBeenCalled();
        });

        it('stores labels for a local non-text project without telling the server', function () {
            // only text projects keep a cloud copy of their labels, because
            //  only they need a Watson Assistant model built from them
            var project = { id : 'proj5', storage : 'local', type : 'imgtfjs' };
            browserStorageServiceMock.addLabel.and.returnValue($q.resolve([ 'labelA' ]));

            var result;
            projectsService.addLabelToProject(project, 'user1', 'class1', 'labelA')
                .then(function (labels) { result = labels; });
            $rootScope.$digest();

            expect(browserStorageServiceMock.addLabel).toHaveBeenCalledWith('proj5', 'labelA');
            expect(result).toEqual([ 'labelA' ]);
        });

        it('does not create a cloud reference for a local text project that has none yet', function () {
            // the reference is created lazily, when a Scratch key or model is
            //  first needed - not when labels change
            var project = { id : 'proj6', storage : 'local', type : 'text' };
            browserStorageServiceMock.addLabel.and.returnValue($q.resolve([ 'labelA' ]));

            var result;
            projectsService.addLabelToProject(project, 'user1', 'class1', 'labelA')
                .then(function (labels) { result = labels; });
            $rootScope.$digest();

            expect(result).toEqual([ 'labelA' ]);
        });

        it('pushes the new label set to the cloud reference of a local text project', function () {
            var project = {
                id : 'proj7', storage : 'local', type : 'text',
                cloudid : 'cloudref7', classid : 'class1', userid : 'user1'
            };
            browserStorageServiceMock.addLabel.and.returnValue($q.resolve([ 'labelA', 'labelB' ]));

            $httpBackend.expectPUT('/api/classes/class1/students/user1/localprojects/cloudref7',
                                   { labels : [ 'labelA', 'labelB' ] })
                .respond(200, { labels : [ 'labelA', 'labelB' ] });

            var result;
            projectsService.addLabelToProject(project, 'user1', 'class1', 'labelB')
                .then(function (labels) { result = labels; });
            $httpBackend.flush();

            expect(result).toEqual([ 'labelA', 'labelB' ]);
        });

    });


    describe('removeLabelFromProject', function () {

        it('removes the label from browser storage for a local project', function () {
            var project = { id : 'proj8', storage : 'local', type : 'imgtfjs' };
            browserStorageServiceMock.deleteLabel.and.returnValue($q.resolve([ 'labelA' ]));

            var result;
            projectsService.removeLabelFromProject(project, 'user1', 'class1', 'labelB')
                .then(function (labels) { result = labels; });
            $rootScope.$digest();

            expect(browserStorageServiceMock.deleteLabel).toHaveBeenCalledWith('proj8', 'labelB');
            expect(result).toEqual([ 'labelA' ]);
        });

        it('patches the labels of a cloud project through the API', function () {
            var project = { id : 'proj1', type : 'text' };

            $httpBackend.expectPATCH('/api/classes/class1/students/user1/projects/proj1', [
                { op : 'remove', path : '/labels', value : 'labelB' }
            ]).respond(200, [ 'labelA' ]);

            var result;
            projectsService.removeLabelFromProject(project, 'user1', 'class1', 'labelB')
                .then(function (labels) { result = labels; });
            $httpBackend.flush();

            expect(result).toEqual([ 'labelA' ]);
            expect(browserStorageServiceMock.deleteLabel).not.toHaveBeenCalled();
        });
    });


    describe('getClassProjects', function () {

        it('fetches every project in the class', function () {
            $httpBackend.expectGET('/api/classes/class1/projects')
                .respond(200, [ { id : 'proj1' }, { id : 'proj2' } ]);

            var result;
            projectsService.getClassProjects(profile).then(function (projects) { result = projects; });
            $httpBackend.flush();

            expect(result.length).toBe(2);
        });
    });


    describe('getProject', function () {

        it('reads a local project from browser storage', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(true);
            browserStorageServiceMock.getProject.and.returnValue($q.resolve({ id : 12 }));

            var result;
            projectsService.getProject(12, 'user1', 'class1').then(function (project) { result = project; });
            $rootScope.$digest();

            expect(browserStorageServiceMock.getProject).toHaveBeenCalledWith(12);
            expect(result).toEqual({ id : 12 });
        });

        it('reads a cloud project from the API', function () {
            browserStorageServiceMock.idIsLocal.and.returnValue(false);

            $httpBackend.expectGET('/api/classes/class1/students/user1/projects/proj1')
                .respond(200, { id : 'proj1' });

            var result;
            projectsService.getProject('proj1', 'user1', 'class1').then(function (project) { result = project; });
            $httpBackend.flush();

            expect(result).toEqual({ id : 'proj1' });
            expect(browserStorageServiceMock.getProject).not.toHaveBeenCalled();
        });
    });


    describe('getFields', function () {

        it('returns the fields held on a local project, without an API call', function () {
            var fields = [ { name : 'height', type : 'number' } ];
            var project = { id : 12, storage : 'local', type : 'numbers', fields : fields };

            var result;
            projectsService.getFields(project, 'user1', 'class1').then(function (value) { result = value; });
            $rootScope.$digest();

            expect(result).toBe(fields);
        });

        it('fetches the fields of a cloud project from their own endpoint', function () {
            // cloud projects keep fields in a separate table, so they need a
            //  separate request - local projects hold them inline
            var project = { id : 'proj1', type : 'numbers' };

            $httpBackend.expectGET('/api/classes/class1/students/user1/projects/proj1/fields')
                .respond(200, [ { name : 'height', type : 'number' } ]);

            var result;
            projectsService.getFields(project, 'user1', 'class1').then(function (value) { result = value; });
            $httpBackend.flush();

            expect(result.length).toBe(1);
        });
    });


    describe('getLabels', function () {

        it('counts local training data per label', function () {
            var project = { id : 12, storage : 'local', type : 'text' };
            browserStorageServiceMock.getLabelCounts.and.returnValue($q.resolve({ alpha : 2, beta : 0 }));

            var result;
            projectsService.getLabels(project, 'user1', 'class1').then(function (value) { result = value; });
            $rootScope.$digest();

            expect(result).toEqual({ alpha : 2, beta : 0 });
        });

        it('reports row and output-column counts for a local regression project', function () {
            // regression projects have no labels at all - the UI needs the
            //  number of rows and how many columns are outputs instead
            var project = {
                id : 12, storage : 'local', type : 'regression',
                columns : [
                    { label : 'height', output : false },
                    { label : 'weight', output : true },
                    { label : 'age', output : true }
                ]
            };
            browserStorageServiceMock.countTrainingData.and.returnValue($q.resolve(42));

            var result;
            projectsService.getLabels(project, 'user1', 'class1').then(function (value) { result = value; });
            $rootScope.$digest();

            expect(result).toEqual({ data : 42, outputcolumns : 2 });
            expect(browserStorageServiceMock.getLabelCounts).not.toHaveBeenCalled();
        });

        it('reports no output columns for a regression project that has none defined yet', function () {
            var project = { id : 12, storage : 'local', type : 'regression' };
            browserStorageServiceMock.countTrainingData.and.returnValue($q.resolve(0));

            var result;
            projectsService.getLabels(project, 'user1', 'class1').then(function (value) { result = value; });
            $rootScope.$digest();

            expect(result).toEqual({ data : 0, outputcolumns : 0 });
        });

        it('fetches label counts for a cloud project from the API', function () {
            var project = { id : 'proj1', type : 'text' };

            $httpBackend.expectGET('/api/classes/class1/students/user1/projects/proj1/labels')
                .respond(200, { alpha : 3 });

            var result;
            projectsService.getLabels(project, 'user1', 'class1').then(function (value) { result = value; });
            $httpBackend.flush();

            expect(result).toEqual({ alpha : 3 });
        });
    });


    describe('createProject', function () {

        it('stamps the owner onto a local project and stores it in the browser', function () {
            var attrs = { name : 'my project', type : 'text', storage : 'local' };
            browserStorageServiceMock.addProject.and.callFake(function (project) {
                return $q.resolve(Object.assign({ id : 12 }, project));
            });

            var result;
            projectsService.createProject(attrs, 'user1', 'class1').then(function (p) { result = p; });
            $rootScope.$digest();

            expect(browserStorageServiceMock.addProject).toHaveBeenCalledWith(
                jasmine.objectContaining({ userid : 'user1', classid : 'class1' }));
            expect(result.id).toBe(12);
        });

        it('posts a cloud project to the API', function () {
            var attrs = { name : 'my project', type : 'text', storage : 'cloud', language : 'en' };

            $httpBackend.expectPOST('/api/classes/class1/students/user1/projects', attrs)
                .respond(201, { id : 'proj1', name : 'my project' });

            var result;
            projectsService.createProject(attrs, 'user1', 'class1').then(function (p) { result = p; });
            $httpBackend.flush();

            expect(result.id).toBe('proj1');
            expect(browserStorageServiceMock.addProject).not.toHaveBeenCalled();
        });

        it('surfaces the API error when the project limit has been reached', function () {
            var attrs = { name : 'one too many', type : 'text', storage : 'cloud' };

            $httpBackend.expectPOST('/api/classes/class1/students/user1/projects')
                .respond(409, { error : 'User already has maximum number of projects' });

            var failure;
            projectsService.createProject(attrs, 'user1', 'class1').catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.status).toBe(409);
        });
    });


    describe('createLocalProject', function () {

        it('creates the cloud reference and records it against the local project', function () {
            var attrs = { id : 12, name : 'my project', type : 'text', labels : [ 'alpha' ] };
            browserStorageServiceMock.addCloudRefToProject.and.returnValue(
                $q.resolve({ id : 12, cloudid : 'cloudref1' }));

            $httpBackend.expectPOST('/api/classes/class1/students/user1/localprojects', attrs)
                .respond(201, { id : 'cloudref1', name : 'my project' });

            var result;
            projectsService.createLocalProject(attrs, 'user1', 'class1').then(function (p) { result = p; });
            $httpBackend.flush();

            expect(browserStorageServiceMock.addCloudRefToProject).toHaveBeenCalledWith(12, 'cloudref1');
            expect(result.cloudid).toBe('cloudref1');
        });
    });


    describe('addMetadataToProject', function () {

        it('stores metadata against a local project', function () {
            var project = { id : 12, storage : 'local', type : 'regression' };
            var columns = [ { label : 'height', output : false } ];
            browserStorageServiceMock.addMetadataToProject.and.returnValue($q.resolve({}));

            projectsService.addMetadataToProject(project, 'columns', columns);
            $rootScope.$digest();

            expect(browserStorageServiceMock.addMetadataToProject)
                .toHaveBeenCalledWith(12, 'columns', columns);
        });

        it('rejects for a cloud project, which has nowhere to put it', function () {
            var project = { id : 'proj1', type : 'text' };

            var failure;
            projectsService.addMetadataToProject(project, 'columns', [])
                .catch(function (err) { failure = err; });
            $rootScope.$digest();

            expect(failure.message).toBe('Unexpected project type');
        });
    });


    describe('language model configuration', function () {

        var languageProject = { id : 12, storage : 'local', type : 'language' };

        it('stores the model type', function () {
            browserStorageServiceMock.setLanguageModelType.and.returnValue($q.resolve({}));

            projectsService.setLanguageModelType(languageProject, 'slm');
            $rootScope.$digest();

            expect(browserStorageServiceMock.setLanguageModelType).toHaveBeenCalledWith(12, 'slm');
        });

        it('stores the small language model configuration', function () {
            browserStorageServiceMock.storeSmallLanguageModelConfig.and.returnValue($q.resolve({}));

            projectsService.storeSmallLanguageModelConfig(languageProject, { model : 'x' });
            $rootScope.$digest();

            expect(browserStorageServiceMock.storeSmallLanguageModelConfig)
                .toHaveBeenCalledWith(12, { model : 'x' });
        });

        it('stores the toy language model configuration', function () {
            browserStorageServiceMock.storeToyLanguageModelConfig.and.returnValue($q.resolve({}));

            projectsService.storeToyLanguageModelConfig(languageProject, { seed : 1 });
            $rootScope.$digest();

            expect(browserStorageServiceMock.storeToyLanguageModelConfig)
                .toHaveBeenCalledWith(12, { seed : 1 });
        });

        it('rejects for a project that is not a language project', function () {
            var failure;
            projectsService.setLanguageModelType({ id : 12, storage : 'local', type : 'text' }, 'slm')
                .catch(function (err) { failure = err; });
            $rootScope.$digest();

            expect(failure.message).toBe('Unexpected project type');
            expect(browserStorageServiceMock.setLanguageModelType).not.toHaveBeenCalled();
        });

        it('rejects for a cloud project, since language projects cannot be stored in the cloud', function () {
            var failure;
            projectsService.setLanguageModelType({ id : 'proj1', type : 'language' }, 'slm')
                .catch(function (err) { failure = err; });
            $rootScope.$digest();

            expect(failure.message).toBe('Unexpected project type');
        });
    });


    describe('checkProjectCredentials', function () {

        it('returns the support information for the class', function () {
            $httpBackend.expectGET('/api/classes/class1/modelsupport/text')
                .respond(200, { code : 'MLCRED-TEXT-VALID' });

            var result;
            projectsService.checkProjectCredentials('class1', 'text').then(function (value) { result = value; });
            $httpBackend.flush();

            expect(result).toEqual({ code : 'MLCRED-TEXT-VALID' });
        });

        it('resolves with the error body rather than rejecting, so callers get the warning code', function () {
            $httpBackend.expectGET('/api/classes/class1/modelsupport/text')
                .respond(409, { code : 'MLCRED-TEXT-NOKEYS' });

            var result, failure;
            projectsService.checkProjectCredentials('class1', 'text')
                .then(function (value) { result = value; })
                .catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure).toBeUndefined();
            expect(result).toEqual({ code : 'MLCRED-TEXT-NOKEYS' });
        });
    });


    describe('shareProject', function () {

        it('patches the crowd-sourced flag and returns the new state', function () {
            var project = { id : 'proj1' };

            $httpBackend.expectPATCH('/api/classes/class1/students/user1/projects/proj1/iscrowdsourced', [
                { op : 'replace', path : '/isCrowdSourced', value : true }
            ]).respond(204);

            var result;
            projectsService.shareProject(project, 'user1', 'class1', true)
                .then(function (state) { result = state; });
            $httpBackend.flush();

            expect(result).toBe(true);
        });

        it('treats "already in that state" as success', function () {
            var project = { id : 'proj1' };

            $httpBackend.expectPATCH('/api/classes/class1/students/user1/projects/proj1/iscrowdsourced')
                .respond(409, { error : 'isCrowdSourced already set' });

            var result;
            projectsService.shareProject(project, 'user1', 'class1', true)
                .then(function (state) { result = state; });
            $httpBackend.flush();

            expect(result).toBe(true);
        });

        it('propagates any other failure', function () {
            var project = { id : 'proj1' };

            $httpBackend.expectPATCH('/api/classes/class1/students/user1/projects/proj1/iscrowdsourced')
                .respond(403, { error : 'Forbidden' });

            var failure;
            projectsService.shareProject(project, 'user1', 'class1', true)
                .catch(function (err) { failure = err; });
            $httpBackend.flush();

            expect(failure.status).toBe(403);
        });
    });


    describe('supportedMakes', function () {

        it('offers every integration for text projects', function () {
            expect(projectsService.supportedMakes({ type : 'text' })).toEqual({
                scratch : true, edublocks : true, python : true, appinventor : true, replit : true
            });
        });

        it('offers scratch, python and colab for numbers projects', function () {
            expect(projectsService.supportedMakes({ type : 'numbers' })).toEqual({
                scratch : true, edublocks : false, python : true, colab : true
            });
        });

        it('offers only scratch for sounds projects', function () {
            expect(projectsService.supportedMakes({ type : 'sounds' })).toEqual({
                scratch : true, edublocks : false, python : false
            });
        });

        it('offers only scratch for a LOCAL image project', function () {
            // python and app inventor need the model hosted in the cloud, so a
            //  local image project cannot offer them
            expect(projectsService.supportedMakes({ type : 'imgtfjs', storage : 'local' })).toEqual({
                scratch : true, edublocks : false, python : false
            });
        });

        it('offers python and app inventor for a CLOUD image project', function () {
            expect(projectsService.supportedMakes({ type : 'imgtfjs' })).toEqual({
                scratch : true, edublocks : false, python : true, appinventor : true
            });
        });

        it('offers only scratch for regression projects', function () {
            expect(projectsService.supportedMakes({ type : 'regression' })).toEqual({
                scratch : true, edublocks : false, python : false
            });
        });

        it('offers nothing for an unrecognised project type', function () {
            expect(projectsService.supportedMakes({ type : 'language' })).toEqual({
                scratch : false, edublocks : false, python : false
            });
        });
    });

});
