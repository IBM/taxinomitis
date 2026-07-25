describe('LanguageModelController - small model testing', function () {

    var $controller;
    var $q;
    var $rootScope;
    var $scope;

    var authServiceMock, projectsServiceMock, trainingServiceMock,
        wikipediaServiceMock, weatherServiceMock, languageModelServiceMock, txtServiceMock,
        utilServiceMock, loggerServiceMock, $mdDialogMock, $windowMock, $timeoutReal;
    var $stateParams;

    var profile;
    var createSpy, getMessageSpy;

    beforeEach(module('app'));

    beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_) {
        $controller = _$controller_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        $timeoutReal = _$timeout_;
        $scope = $rootScope.$new();
    }));

    beforeEach(function () {
        profile = { user_id : 'user1', tenant : 'class1', role : 'student' };

        authServiceMock = {
            getProfileDeferred : jasmine.createSpy('getProfileDeferred').and.returnValue($q.resolve(profile))
        };

        projectsServiceMock = jasmine.createSpyObj('projectsService', [
            'getProject', 'setLanguageModelType',
            'storeSmallLanguageModelConfig', 'storeToyLanguageModelConfig'
        ]);

        trainingServiceMock = jasmine.createSpyObj('trainingService', [
            'getTraining', 'retrieveAsset', 'newTrainingData', 'bulkAddTrainingData',
            'deleteTrainingData', 'storeAsset'
        ]);
        trainingServiceMock.getTraining.and.returnValue($q.resolve([]));

        wikipediaServiceMock = jasmine.createSpyObj('wikipediaService', ['searchByTitle']);
        weatherServiceMock = jasmine.createSpyObj('weatherService', ['getCurrentWeather']);

        languageModelServiceMock = jasmine.createSpyObj('languageModelService', [
            'generateNgrams', 'getSupportedModels', 'getAllModels', 'getModelDetails'
        ]);
        languageModelServiceMock.getSupportedModels.and.returnValue($q.resolve([]));
        languageModelServiceMock.getAllModels.and.returnValue([]);

        txtServiceMock = jasmine.createSpyObj('txtService', ['getContents']);

        createSpy = jasmine.createSpy('create');
        getMessageSpy = jasmine.createSpy('getMessage');
        var fakeWebllm = {
            MLCEngine : function () {
                this.reload = jasmine.createSpy('reload').and.returnValue($q.resolve());
                this.chat = { completions : { create : createSpy } };
                this.getMessage = getMessageSpy;
            }
        };
        utilServiceMock = jasmine.createSpyObj('utilService', ['loadWebLlmProjectSupport']);
        utilServiceMock.loadWebLlmProjectSupport.and.returnValue($q.resolve(fakeWebllm));

        loggerServiceMock = jasmine.createSpyObj('loggerService', ['debug', 'error']);

        $mdDialogMock = jasmine.createSpyObj('$mdDialog', ['show', 'hide', 'cancel']);

        $windowMock = jasmine.createSpyObj('$window', ['scrollTo']);

        $stateParams = { projectId : 'project1', userId : 'user1' };
    });

    function createController() {
        return $controller('LanguageModelController', {
            authService : authServiceMock,
            projectsService : projectsServiceMock,
            trainingService : trainingServiceMock,
            wikipediaService : wikipediaServiceMock,
            weatherService : weatherServiceMock,
            languageModelService : languageModelServiceMock,
            txtService : txtServiceMock,
            utilService : utilServiceMock,
            loggerService : loggerServiceMock,
            $mdDialog : $mdDialogMock,
            $stateParams : $stateParams,
            $scope : $scope,
            $window : $windowMock,
            $timeout : $timeoutReal,
            $q : $q
        });
    }

    function digestTwice() {
        $rootScope.$digest();
        $rootScope.$digest();
    }

    function baseProject(overrides) {
        return angular.extend({ id : 'project1', userid : 'user1', classid : 'class1', type : 'text' }, overrides || {});
    }

    function createReadyController(project) {
        projectsServiceMock.getProject.and.returnValue($q.resolve(project));
        var vm = createController();
        digestTwice();
        return vm;
    }

    // brings a small-model controller to SMALL.READY via the real
    // restore/download flow (validated in phase (c)), ready to test prompting
    function createSmallReadyController(overrides) {
        var vm = createReadyController(baseProject({
            modeltype : 'small',
            slm : angular.extend({ id : 'model1', temperature : 1, topp : 1, toolsenabled : false }, overrides || {})
        }));
        expect($scope.phase).toBe($scope.PHASES.SMALL.READY); // sanity-check the fixture itself
        return vm;
    }

    // the whole chain (useSmallLanguageModel / generateStreamedResponse /
    // generateResponseUsingTools) is built from `async function`s awaiting
    // both native promises and $q ones, plus for-await-of loops - each hop
    // needs its own microtask+digest round to settle (see phase (b) for the
    // detailed explanation of why a single flush isn't enough). This is
    // generous enough to cover the deepest chains here (multi-round tool
    // calling, multi-step context-eviction retries).
    function flushAsync(rounds) {
        function round(n) {
            if (n <= 0) { return Promise.resolve(); }
            return new Promise(function (resolve) { setTimeout(resolve, 0); })
                .then(function () {
                    $rootScope.$digest();
                    return round(n - 1);
                });
        }
        return round(rounds || 15);
    }

    function makeStream(chunks) {
        return {
            [Symbol.asyncIterator] : async function* () {
                for (const c of chunks) {
                    yield c;
                }
            }
        };
    }
    function chunk(content) {
        return { choices : [ { delta : { content : content } } ] };
    }
    function completion(finishReason, message) {
        return { choices : [ { finish_reason : finishReason, message : message || {} } ] };
    }


    describe('testModel dispatch', function () {

        it('routes to the small language model and clears the prompt box on completion', async function () {
            createSmallReadyController();
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('hi') ])));
            getMessageSpy.and.returnValue($q.resolve('hi'));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            expect($scope.generating).toBe(true);
            await flushAsync();
            $timeoutReal.flush();

            expect($scope.generating).toBe(false);
            expect($scope.textgenerated).toBe(true);
            // unlike the toy model, the small model DOES clear the prompt box
            expect($scope.prompt.message).toBe('');
        });

    });


    describe('generateStreamedResponse (tools disabled)', function () {

        it('sends the conversation, temperature and top-p to the model', async function () {
            createSmallReadyController({ temperature : 0.7, topp : 0.8 });
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('hi') ])));
            getMessageSpy.and.returnValue($q.resolve('hi'));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var payload = createSpy.calls.mostRecent().args[0];
            expect(payload.stream).toBe(true);
            expect(payload.top_p).toBe(0.8);
            expect(payload.temperature).toBe(0.7);
            expect(payload.messages[0].role).toBe('system');
            expect(payload.messages[1]).toEqual({ role : 'user', content : 'hello' });
        });

        it('streams chunks into the render text, converting newlines to <br>', async function () {
            createSmallReadyController();
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('line one\n'), chunk('line two') ])));
            getMessageSpy.and.returnValue($q.resolve('line one\nline two'));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.role).toBe('assistant');
            expect(assistantMsg.content).toBe('line one\nline two');
            expect(assistantMsg.render).toBe('line one<br>line two');
            expect(assistantMsg.inprogress).toBeUndefined();
        });

        it('skips empty deltas without corrupting the streamed text', async function () {
            createSmallReadyController();
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('a'), chunk(''), chunk(undefined), chunk('b') ])));
            getMessageSpy.and.returnValue($q.resolve('ab'));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.content).toBe('ab');
        });

        it('shows an error alert (with a refresh hint) if the model call fails for an unrelated reason', async function () {
            var vm = createSmallReadyController();
            createSpy.and.returnValue($q.reject({ status : 500, message : 'engine crashed' }));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('engine crashed Please refresh the page.');
            // the in-progress placeholder must not be left behind
            expect($scope.generatedmessages.some(function (m) { return m.inprogress; })).toBe(false);
        });

        it('regression: leaves generating stuck (testing disabled) after a failure, since the WebLLM engine may now be broken', async function () {
            // production Sentry reports show that after a WebGPU "device lost"
            // failure like this, the engine can throw again on further use in
            // ways nothing in this file can catch - so unlike the toy model
            // path, generating is deliberately NOT reset here, permanently
            // disabling the Generate/Reset buttons (via their existing
            // ng-disabled="generating" wiring) until the user refreshes
            createSmallReadyController();
            createSpy.and.returnValue($q.reject({
                status : 500,
                message : 'OperationError: A valid external Instance reference no longer exists.'
            }));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect($scope.generating).toBe(true);
        });

        it('falls back to a generic message plus the refresh hint when the error has no message', async function () {
            var vm = createSmallReadyController();
            createSpy.and.returnValue($q.reject({ status : 500 }));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect(vm.errors[0].message).toBe('Something went wrong. Please refresh the page.');
        });

    });


    describe('RAG context injection', function () {

        it('embeds the context document in the first user message only', async function () {
            createSmallReadyController({
                initialcontext : { state : 'provide', doc : { type : 'text', title : 't', contents : 'Cats are cute.' } }
            });
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('ok') ])));
            getMessageSpy.and.returnValue($q.resolve('ok'));
            $scope.prompt.message = 'Tell me about cats';

            $scope.testModel();
            await flushAsync();

            var userMsg = $scope.generatedmessages.find(function (m) { return m.role === 'user'; });
            expect(userMsg.content).toBe('Question: Tell me about cats\n\nContext:\nCats are cute.');
            // the rendered/displayed text is always the raw prompt, not the augmented content
            expect(userMsg.render).toBe('Tell me about cats');

            var payload = createSpy.calls.mostRecent().args[0];
            expect(payload.messages[0].content).toContain('You will be given additional context');
        });

        it('does not re-embed context on a second turn of the same conversation', async function () {
            createSmallReadyController({
                initialcontext : { state : 'provide', doc : { type : 'text', title : 't', contents : 'Cats are cute.' } }
            });
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('ok') ])));
            getMessageSpy.and.returnValue($q.resolve('ok'));
            $scope.prompt.message = 'first';
            $scope.testModel();
            await flushAsync();
            $timeoutReal.flush();

            $scope.prompt.message = 'second';
            $scope.testModel();
            await flushAsync();

            var userMessages = $scope.generatedmessages.filter(function (m) { return m.role === 'user'; });
            expect(userMessages[1].content).toBe('second');
        });

        it('does not embed context when none has been provided', async function () {
            createSmallReadyController();
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('ok') ])));
            getMessageSpy.and.returnValue($q.resolve('ok'));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var payload = createSpy.calls.mostRecent().args[0];
            expect(payload.messages[0].content).not.toContain('additional context');
        });

    });


    describe('generateResponseUsingTools (tools enabled)', function () {

        function toolsReadyController() {
            return createSmallReadyController({ toolsenabled : true });
        }

        it('sends the tool definitions and tool_choice=auto', async function () {
            toolsReadyController();
            createSpy.and.returnValue($q.resolve(completion('stop', { content : 'plain answer' })));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var payload = createSpy.calls.mostRecent().args[0];
            expect(payload.tool_choice).toBe('auto');
            expect(payload.tools.map(function (t) { return t.function.name; })).toEqual([
                'get_date_time', 'multiply_two_numbers', 'get_weather'
            ]);
            // the system prompt is sent as a user message when tools are enabled
            expect(payload.messages[0].role).toBe('user');
        });

        it('uses a plain text response directly when no tool call is requested', async function () {
            toolsReadyController();
            createSpy.and.returnValue($q.resolve(completion('stop', { content : 'plain answer' })));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.content).toBe('plain answer');
        });

        it('shows a context-window-full alert and uses the partial content when truncated', async function () {
            var vm = toolsReadyController();
            createSpy.and.returnValue($q.resolve(completion('length', { content : 'cut off mid-sent' })));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect(vm.errors[0].message).toContain('ran out of room in its context window');
            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.content).toBe('cut off mid-sent');
        });

        it('runs the requested tool and uses its output as the response', async function () {
            toolsReadyController();
            createSpy.and.returnValue($q.resolve(completion('tool_calls', {
                content : null,
                tool_calls : [ { id : 'call1', function : { name : 'multiply_two_numbers', arguments : '{"number1":6,"number2":7}' } } ]
            })));
            $scope.prompt.message = 'what is 6 times 7?';

            $scope.testModel();
            await flushAsync();

            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.content).toBe('42');
            var toolMsg = $scope.generatedmessages.find(function (m) { return m.role === 'tool'; });
            expect(toolMsg.tool_call_id).toBe('call1');
            expect(toolMsg.content).toBe('42');
        });

        it('reports an unknown tool name as an error result, and retries', async function () {
            toolsReadyController();
            createSpy.and.returnValues(
                $q.resolve(completion('tool_calls', {
                    tool_calls : [ { id : 'call1', function : { name : 'not_a_real_tool', arguments : '{}' } } ]
                })),
                $q.resolve(completion('stop', { content : 'recovered' }))
            );
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect(createSpy.calls.count()).toBe(2);
            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.content).toBe('recovered');
        });

        it('reports a missing required parameter as an error result', async function () {
            toolsReadyController();
            createSpy.and.returnValues(
                $q.resolve(completion('tool_calls', {
                    tool_calls : [ { id : 'call1', function : { name : 'multiply_two_numbers', arguments : '{"number1":6}' } } ]
                })),
                $q.resolve(completion('stop', { content : 'recovered' }))
            );
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var toolMsg = $scope.generatedmessages.find(function (m) { return m.role === 'tool'; });
            expect(toolMsg.content).toBe('Error: missing required parameter "number2"');
        });

        it('reports malformed tool arguments as an error result', async function () {
            toolsReadyController();
            createSpy.and.returnValues(
                $q.resolve(completion('tool_calls', {
                    tool_calls : [ { id : 'call1', function : { name : 'multiply_two_numbers', arguments : 'not valid json' } } ]
                })),
                $q.resolve(completion('stop', { content : 'recovered' }))
            );
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            var toolMsg = $scope.generatedmessages.find(function (m) { return m.role === 'tool'; });
            expect(toolMsg.content).toMatch(/^Error: /);
        });

        it('falls back to a generic message if tools keep failing until the call limit is reached', async function () {
            toolsReadyController();
            createSpy.and.returnValue($q.resolve(completion('tool_calls', {
                tool_calls : [ { id : 'call1', function : { name : 'unknown_tool', arguments : '{}' } } ]
            })));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync(30);

            expect(createSpy.calls.count()).toBe(10); // MAX_TOOL_CALLS
            var assistantMsg = $scope.generatedmessages[$scope.generatedmessages.length - 1];
            expect(assistantMsg.content).toBe('Sorry - I was not able to use tools to answer that.');
        });

    });


    describe('getMessagesPayload', function () {

        it('omits tool-calling messages from the payload when tools are disabled', async function () {
            createSmallReadyController();
            $scope.generatedmessages = [
                { role : 'system', content : 'sys' },
                { role : 'user', content : 'hi' },
                { role : 'assistant', content : '', tool_calls : [ { id : 'x' } ] },
                { role : 'tool', tool_call_id : 'x', content : 'result' }
            ];
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('ok') ])));
            getMessageSpy.and.returnValue($q.resolve('ok'));
            $scope.prompt.message = 'next';

            $scope.testModel();
            await flushAsync();

            var payload = createSpy.calls.mostRecent().args[0];
            expect(payload.messages.some(function (m) { return m.role === 'tool'; })).toBe(false);
            expect(payload.messages.some(function (m) { return m.tool_calls; })).toBe(false);
        });

        it('excludes in-progress messages from the payload', async function () {
            createSmallReadyController();
            $scope.generatedmessages = [
                { role : 'system', content : 'sys' },
                { role : 'assistant', content : 'stale', inprogress : true }
            ];
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('ok') ])));
            getMessageSpy.and.returnValue($q.resolve('ok'));
            $scope.prompt.message = 'hi';

            $scope.testModel();
            await flushAsync();

            var payload = createSpy.calls.mostRecent().args[0];
            expect(payload.messages.some(function (m) { return m.content === 'stale'; })).toBe(false);
        });

    });


    describe('context-overflow retry', function () {

        function overflowError() {
            // must include the exact phrase simplifyError() looks for, so it
            // gets replaced with the (context-aware) shorter-prompt guidance
            return {
                status : 400,
                message : 'InputError: tokens exceed context window size of 4096. Consider shortening the prompt, ' +
                          'or increase `context_window_size`, or using sliding window via `sliding_window_size`'
            };
        }

        it('rethrows (and shows a generic alert) for errors unrelated to context overflow', async function () {
            var vm = createSmallReadyController();
            createSpy.and.returnValue($q.reject({ status : 500, message : 'totally different problem' }));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toBe('totally different problem Please refresh the page.');
        });

        it('shows a simplified error with no retry when overflow happens on the first (RAG) turn', async function () {
            var vm = createSmallReadyController({
                initialcontext : { state : 'provide', doc : { type : 'text', title : 't', contents : 'long context...' } }
            });
            createSpy.and.returnValue($q.reject(overflowError()));
            $scope.prompt.message = 'hello';

            $scope.testModel();
            await flushAsync();

            expect(createSpy.calls.count()).toBe(1); // no retry attempted
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toContain('Try a shorter prompt and initial context');
        });

        it('drops the oldest turn and retries when overflow happens with removable history', async function () {
            createSmallReadyController();
            // first turn succeeds normally, building up some history
            createSpy.and.returnValue($q.resolve(makeStream([ chunk('first reply') ])));
            getMessageSpy.and.returnValue($q.resolve('first reply'));
            $scope.prompt.message = 'first message';
            $scope.testModel();
            await flushAsync();
            $timeoutReal.flush();
            expect($scope.generatedmessages.length).toBe(3); // system, user, assistant

            // second turn overflows once, then succeeds after the retry drops history
            var callCount = 0;
            createSpy.and.callFake(function () {
                callCount += 1;
                if (callCount === 1) {
                    return $q.reject(overflowError());
                }
                return $q.resolve(makeStream([ chunk('recovered reply') ]));
            });
            getMessageSpy.and.returnValue($q.resolve('recovered reply'));
            $scope.prompt.message = 'second message';
            $scope.testModel();
            await flushAsync();

            expect(callCount).toBe(2);
            // eviction only removes the single oldest message (the first
            // user prompt) - its assistant reply is a regular message (no
            // tool_calls), so it is NOT removed as part of the same unit,
            // and survives as context for the retried turn
            expect($scope.generatedmessages.map(function (m) { return m.role; })).toEqual([
                'system', 'assistant', 'user', 'assistant'
            ]);
            expect($scope.generatedmessages[1].content).toBe('first reply');
            expect($scope.generatedmessages[2].content).toBe('second message');
            expect($scope.generatedmessages[3].content).toBe('recovered reply');
        });

        it('drops a tool-calling exchange as a whole unit (assistant + its tool result) when it is the oldest entry', async function () {
            createSmallReadyController({ toolsenabled : true });
            // directly seed history so a completed tool-calling exchange is
            // already the oldest non-system entry - reaching this naturally
            // needs two eviction rounds (first dropping the lone user prompt
            // that originally preceded it), so this sets it up directly
            $scope.generatedmessages = [
                { role : 'system', content : 'sys' },
                { role : 'assistant', content : '',
                  tool_calls : [ { id : 'call1', function : { name : 'get_date_time', arguments : '{}' } } ] },
                { role : 'tool', tool_call_id : 'call1', content : 'Monday' },
                { role : 'assistant', content : 'It is Monday.' }
            ];

            var callCount = 0;
            createSpy.and.callFake(function () {
                callCount += 1;
                if (callCount === 1) {
                    return $q.reject(overflowError());
                }
                return $q.resolve(completion('stop', { content : 'second reply' }));
            });
            $scope.prompt.message = 'second question';

            $scope.testModel();
            await flushAsync();

            expect(callCount).toBe(2);
            // the tool-calling assistant message and its tool result are
            // removed together as a unit, not just the assistant message alone
            expect($scope.generatedmessages.map(function (m) { return m.role; })).toEqual([
                'system', 'assistant', 'user', 'assistant'
            ]);
            expect($scope.generatedmessages[1].content).toBe('It is Monday.');
            expect($scope.generatedmessages[2].content).toBe('second question');
            expect($scope.generatedmessages[3].content).toBe('second reply');
        });

        it('shows a simplified error with no retry when there is no removable history', async function () {
            var vm = createSmallReadyController();
            createSpy.and.returnValue($q.reject(overflowError()));
            $scope.prompt.message = 'a single huge message';

            $scope.testModel();
            await flushAsync();

            expect(createSpy.calls.count()).toBe(1);
            expect(vm.errors.length).toBe(1);
            expect(vm.errors[0].message).toContain('Try a shorter prompt or increase the size of the context window');
            expect(vm.errors[0].message).not.toContain('initial context');
        });

    });

});
