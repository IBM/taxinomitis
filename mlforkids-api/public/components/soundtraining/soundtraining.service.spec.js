describe('soundTrainingService', function () {

    // The speech-commands library is replaced with a fake that copies the
    //  parts of its behaviour that matter here: collectExample() creates a
    //  BrowserFftFeatureExtractor synchronously, and the extractor's stop()
    //  throws if it has already been stopped.
    //
    // The service is driven by native promises (getUserMedia, the library)
    //  so specs are async and await it directly, with no $digest pumping.

    var soundTrainingService;
    var fakeTransferRecognizer;
    var originalSpeechCommands, originalTf;

    function FakeExtractor() {
        this.frameIntervalTask = 1;
        this.stopCount = 0;
    }
    FakeExtractor.prototype.stop = function () {
        // matches BrowserFftFeatureExtractor.stop in speech-commands 0.5.4
        if (this.frameIntervalTask == null) {
            return Promise.reject(new Error('Cannot stop because there is no ongoing streaming activity.'));
        }
        this.frameIntervalTask = null;
        this.stopCount += 1;
        return Promise.resolve();
    };

    function spectrogramCallback(recognizer) {
        // matches the end of the spectrogram callback used by collectExample
        return recognizer.audioDataExtractor.stop();
    }

    beforeEach(function () {
        fakeTransferRecognizer = {
            stopResults : [],
            modelInputShape : function () { return [null, 43, 232, 1]; },
            collectExample : function () {
                var recognizer = this;
                recognizer.audioDataExtractor = new FakeExtractor();
                return new Promise(function (resolve) {
                    // callbacks come from the extractor's interval timer,
                    //  and it fires a second time before the first callback
                    //  has finished
                    setTimeout(function () {
                        var first = spectrogramCallback(recognizer);
                        var second = spectrogramCallback(recognizer);
                        recognizer.stopResults = [ first, second ];
                        first.then(function () {
                            resolve({ data : new Float32Array([ 1, 2, 3 ]), frameSize : 232 });
                        });
                    });
                });
            }
        };

        originalSpeechCommands = window.speechCommands;
        originalTf = window.tf;
        window.speechCommands = {
            version : 'fake',
            create : function () {
                return {
                    ensureModelLoaded : function () { return Promise.resolve(); },
                    createTransfer : function () { return fakeTransferRecognizer; }
                };
            }
        };
        window.tf = {};

        spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(Promise.resolve({
            getTracks : function () { return []; }
        }));

        var utilServiceMock = jasmine.createSpyObj('utilService', [
            'loadTensorFlow', 'loadScript', 'isInternetExplorer'
        ]);
        utilServiceMock.loadTensorFlow.and.returnValue(Promise.resolve());
        utilServiceMock.loadScript.and.returnValue(Promise.resolve());

        module('app', function ($provide) {
            $provide.value('trainingService', {});
            $provide.value('modelService', {});
            $provide.value('browserStorageService', {});
            $provide.value('utilService', utilServiceMock);
            $provide.value('loggerService', jasmine.createSpyObj('loggerService', [ 'debug', 'error', 'warn' ]));
        });

        inject(function (_soundTrainingService_) {
            soundTrainingService = _soundTrainingService_;
        });
    });

    afterEach(function () {
        window.speechCommands = originalSpeechCommands;
        window.tf = originalTf;
    });


    describe('collectExample', function () {

        it('returns the collected spectrogram', async function () {
            await soundTrainingService.initSoundSupport('project-1', [ 'cat', 'dog' ], false);

            var spectrogram = await soundTrainingService.collectExample('cat');

            expect(Array.from(spectrogram.data)).toEqual([ 1, 2, 3 ]);
        });

        it('tolerates the extractor being stopped twice', async function () {
            await soundTrainingService.initSoundSupport('project-1', [ 'cat', 'dog' ], false);

            await soundTrainingService.collectExample('cat');

            // without the guard, the second stop rejects - and as nothing in
            //  the library handles that, it becomes an unhandled rejection
            await expectAsync(fakeTransferRecognizer.stopResults[0]).toBeResolved();
            await expectAsync(fakeTransferRecognizer.stopResults[1]).toBeResolved();

            // the extractor was only really stopped once
            expect(fakeTransferRecognizer.audioDataExtractor.stopCount).toBe(1);
        });
    });
});
