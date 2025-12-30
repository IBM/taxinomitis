(function () {

    angular
        .module('app')
        .service('gpuDetectionService', gpuDetectionService);

    gpuDetectionService.$inject = [
        'loggerService'
    ];


    //
    // checks to see if the user's browser is likely to be able to
    //  successfully train a TensorFlow JS model
    //

    function gpuDetectionService(loggerService) {

        var cachedCapabilities = null;


        function getGPUCapabilities() {
            if (cachedCapabilities) {
                return cachedCapabilities;
            }

            loggerService.debug('[ml4kgpu] detecting GPU capabilities');
            var capabilities = {};

            try {
                // can we get a webgl context at all?
                var canvas = document.createElement('canvas');
                var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (!gl) {
                    loggerService.debug('[ml4kgpu] No WebGL context available');
                    capabilities = {
                        available: false,
                        constrained: true,
                        maxTextureSize: 0,
                        maxRenderBufferSize: 0,
                        renderer: 'unknown',
                        vendor: 'unknown'
                    };
                    return capabilities;
                }

                // we got a webgl context - what can we find out about it?
                var maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
                var maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
                var maxTextureImageUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
                var maxVertexTextureImageUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
                var maxCombinedTextureImageUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
                var renderer = 'unknown';
                var vendor = 'unknown';
                var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
                    vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
                }

                capabilities = {
                    // webgl available
                    available: true,
                    // decide if it looks like it'll be able to train models successfully
                    constrained: isConstrainedGPU(maxTextureSize, maxRenderBufferSize, renderer),
                    // record other data for debugging / logging purposes
                    maxTextureSize: maxTextureSize,
                    maxRenderBufferSize: maxRenderBufferSize,
                    maxTextureImageUnits: maxTextureImageUnits,
                    maxVertexTextureImageUnits: maxVertexTextureImageUnits,
                    maxCombinedTextureImageUnits: maxCombinedTextureImageUnits,
                    renderer: renderer,
                    vendor: vendor,
                    webgl2: gl instanceof WebGL2RenderingContext
                };

                loggerService.debug('[ml4kgpu] GPU capabilities detected');
                return capabilities;
            }
            catch (err) {
                loggerService.error('[ml4kgpu] Error detecting GPU capabilities', err);
                capabilities = {
                    available: false,
                    constrained: true,
                    error: err.message
                };
                return capabilities;
            }
            finally {
                // log what we've found for debugging later
                loggerService.debug('[ml4kgpu] WebGL Available: ' + capabilities.available);
                loggerService.debug('[ml4kgpu] Constrained Environment: ' + capabilities.constrained);
                loggerService.debug('[ml4kgpu] Max Texture Size: ' + capabilities.maxTextureSize);
                loggerService.debug('[ml4kgpu] Max Render Buffer Size: ' + capabilities.maxRenderBufferSize);
                loggerService.debug('[ml4kgpu] Renderer: ' + capabilities.renderer);
                loggerService.debug('[ml4kgpu] Vendor: ' + capabilities.vendor);
                loggerService.debug('[ml4kgpu] WebGL2 Support: ' + capabilities.webgl2);

                // cache the results to avoid needing to repeat this test
                cachedCapabilities = capabilities;
            }
        }


        // returns true if we see something problematic
        //   either based on numeric limits or the name of the renderer
        function isConstrainedGPU(maxTextureSize, maxRenderBufferSize, renderer) {
            if (maxTextureSize <= 4096 || maxRenderBufferSize <= 4096) {
                loggerService.debug('[ml4kgpu] Constrained GPU detected based on texture size limits');
                return true;
            }

            var problematicRenderers = [
                /Mali-400/i,
                /Mali-450/i,
                /Mali-T6/i,
                /Mali-T7/i,
                /PowerVR\s+GE8/i,
                /PowerVR\s+SGX/i,
                /VideoCore\s+IV/i,
                /SwiftShader/i,
                /Adreno \(TM\) 3/i,
                /Adreno \(TM\) 4/i,
                /llvmpipe/i
            ];
            if (problematicRenderers.some(re => re.test(renderer))) {
                loggerService.debug('[ml4kgpu] Constrained GPU detected based on name');
                return true;
            }

            loggerService.debug('[ml4kgpu] GPU detected: ' + renderer);
            return false;
        }


        function getMemoryInfo() {
            loggerService.debug('[ml4kgpu] detecting memory info');

            var memoryInfo = {
                deviceMemory: undefined,
                hardwareConcurrency: navigator.hardwareConcurrency || 1,
                constrained: false
            };

            if ('deviceMemory' in navigator) {
                memoryInfo.deviceMemory = navigator.deviceMemory;
            }

            if (performance.memory) {
                memoryInfo.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
                memoryInfo.totalJSHeapSize = performance.memory.totalJSHeapSize;
                memoryInfo.usedJSHeapSize = performance.memory.usedJSHeapSize;
            }

            loggerService.debug('[ml4kgpu] memory info', memoryInfo);

            if ((memoryInfo.deviceMemory && memoryInfo.deviceMemory <= 2) ||
                (memoryInfo.hardwareConcurrency <= 2))
            {
                memoryInfo.constrained = true;
            }

            return memoryInfo;
        }


        function getTensorFlowCapabilities() {
            loggerService.debug('[ml4kgpu] checking TensorFlow capability');

            var tfCapabilities = {
                available: false,
                backend: 'cpu',
                constrained: false
            };

            if (typeof tf !== 'undefined') {
                tfCapabilities.available = true;

                try {
                    tfCapabilities.backends = tf.engine().registryFactory;
                    tfCapabilities.backend = tf.getBackend();

                    if (tf.findBackend('webgl') && tfCapabilities.backend === 'cpu') {
                        tfCapabilities.constrained = true;
                    }
                }
                catch (err) {
                    loggerService.error('[ml4kgpu] Error checking TensorFlow capabilities', err);
                    tfCapabilities.constrained = true;
                }
            }

            return tfCapabilities;
        }



        function isShaderF16Supported() {
            if (!navigator.gpu) {
                return Promise.resolve(false);
            }
            return navigator.gpu.requestAdapter()
                .then((adapter) => {
                    if (!adapter) {
                        return false;
                    }

                    return adapter.features.has('shader-f16');
                })
                .catch((err) => {
                    loggerService.error('[ml4kgpu] Error checking GPU supported features', err);
                    return false;
                });
        }



        function isConstrained() {
            var capabilities = getGPUCapabilities();
            if (capabilities.constrained) {
                return true;
            }

            var memoryInfo = getMemoryInfo();
            if (memoryInfo.constrained) {
                return true;
            }

            var tfJsInfo = getTensorFlowCapabilities();
            if (tfJsInfo.constrained) {
                return true;
            }

            return false;
        }


        return {
            isConstrained: isConstrained,
            isShaderF16Supported: isShaderF16Supported
        };
    }
})();
