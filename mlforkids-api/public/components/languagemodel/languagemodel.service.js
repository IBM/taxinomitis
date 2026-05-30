(function () {

    angular
        .module('app')
        .service('languageModelService', languageModelService);

    languageModelService.$inject = [
        '$http',
        'gpuDetectionService'
    ];

    function languageModelService($http, gpuDetectionService) {

        const modelsWhenShaderF16Supported = [
            {
                id : 'SmolLM2-135M-Instruct-q0f16-MLC',
                version : 'SmolLM2',
                size : '135M',
                billionparameters : 0.135,
                label : 'Smol',
                developer : 'Hugging Face',
                storage : '276 MB',
                storagemb : 276
            },
            {
                id : 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
                version : '2.5',
                size : '0.5B',
                billionparameters : 0.5,
                label : 'Qwen',
                developer : 'Alibaba',
                storage : '289 MB',
                storagemb : 289
            },
            {
                id : 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k',
                version : '1.0',
                size : '1.1B',
                billionparameters : 1.1,
                label : 'Tiny Llama',
                developer : 'Singapore University of Technology and Design',
                storage : '625 MB',
                storagemb : 625
            },
            {
                id : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                version : '3.2',
                size : '1B',
                billionparameters : 1.0,
                label : 'Llama',
                developer : 'Meta',
                storage : '711 MB',
                storagemb : 711
            },
            {
                id : 'phi-1_5-q4f16_1-MLC',
                version : '1.5',
                size : '1.3B',
                billionparameters : 1.3,
                label : 'Phi',
                developer : 'Microsoft',
                storage : '806 MB',
                storagemb : 806
            },
            {
                id : 'stablelm-2-zephyr-1_6b-q4f16_1-MLC-1k',
                version : '2',
                size : '1.6B',
                billionparameters : 1.6,
                label : 'Zephyr',
                developer : 'Stability AI',
                storage : '932 MB',
                storagemb : 932
            },
            {
                id : 'gemma-2-2b-it-q4f16_1-MLC-1k',
                version : '2',
                size : '2B',
                billionparameters : 2.0,
                label : 'Gemma',
                developer : 'Google',
                storage : '1.5 GB',
                storagemb : 1500
            },
            {
                id : 'RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC-1k',
                version : '1',
                size : '3B',
                billionparameters : 3.0,
                label : 'RedPajama',
                developer : 'Together',
                storage : '1.5 GB',
                storagemb : 1500
            }
        ];

        const modelsWhenShaderF16NotSupported = [
            {
                id : 'SmolLM2-135M-Instruct-q0f32-MLC',
                version : 'SmolLM2',
                size : '135M',
                billionparameters : 0.135,
                label : 'Smol',
                developer : 'Hugging Face',
                storage : '269 MB',
                storagemb : 269
            },
            {
                id : 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
                version : '2.5',
                size : '0.5B',
                billionparameters : 0.5,
                label : 'Qwen',
                developer : 'Alibaba',
                storage : '289 MB',
                storagemb : 289
            },
            {
                id : 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC-1k',
                version : '1.0',
                size : '1.1B',
                billionparameters : 1.1,
                label : 'Tiny Llama',
                developer : 'Singapore University of Technology and Design',
                storage : '627 MB',
                storagemb : 627
            },
            {
                id : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                version : '3.2',
                size : '1B',
                billionparameters : 1.0,
                label : 'Llama',
                developer : 'Meta',
                storage : '711 MB',
                storagemb : 711
            },
            {
                id : 'phi-1_5-q4f32_1-MLC',
                version : '1.5',
                size : '1.3B',
                billionparameters : 1.3,
                label : 'Phi',
                developer : 'Microsoft',
                storage : '806 MB',
                storagemb : 806
            },
            {
                id : 'stablelm-2-zephyr-1_6b-q4f16_1-MLC-1k',
                version : '2',
                size : '1.6B',
                billionparameters : 1.6,
                label : 'Zephyr',
                developer : 'Stability AI',
                storage : '932 MB',
                storagemb : 932
            },
            {
                id : 'gemma-2-2b-it-q4f32_1-MLC-1k',
                version : '2',
                size : '2B',
                billionparameters : 2.0,
                label : 'Gemma',
                developer : 'Google',
                storage : '1.5 GB',
                storagemb : 1494
            },
            {
                id : 'RedPajama-INCITE-Chat-3B-v1-q4f32_1-MLC-1k',
                version : '1',
                size : '3B',
                billionparameters : 3.0,
                label : 'RedPajama',
                developer : 'Together',
                storage : '1.7 GB',
                storagemb : 1714
            }
        ];

        function cloneModel(model, useShaderF16) {
            return angular.extend({}, model, {
                supported : true,
                useShaderF16 : useShaderF16
            });
        }

        function getAllModels() {
            const allModels = [];
            const seen = {};

            modelsWhenShaderF16Supported.forEach((model) => {
                allModels.push(cloneModel(model, true));
                seen[model.id] = true;
            });

            modelsWhenShaderF16NotSupported.forEach((model) => {
                if (!seen[model.id]) {
                    allModels.push(cloneModel(model, false));
                    seen[model.id] = true;
                }
            });

            return allModels;
        }

        function getAllKnownModelIds() {
            return getAllModels().map((model) => model.id);
        }

        function getSupportedModels() {
            return gpuDetectionService.isShaderF16Supported()
                .then((useShaderF16) => {
                    const models = useShaderF16 ? modelsWhenShaderF16Supported : modelsWhenShaderF16NotSupported;
                    return models.map((model) => cloneModel(model, useShaderF16));
                });
        }

        function getAllModelsWithSupport() {
            return gpuDetectionService.isShaderF16Supported()
                .then((useShaderF16) => {
                    const supportedIds = {};
                    const supportedModels = useShaderF16 ? modelsWhenShaderF16Supported : modelsWhenShaderF16NotSupported;

                    supportedModels.forEach((model) => {
                        supportedIds[model.id] = true;
                    });

                    return getAllModels().map((model) => {
                        model.supported = !!supportedIds[model.id];
                        model.useShaderF16 = useShaderF16;
                        return model;
                    });
                });
        }

        function getModelDetails(modelId, useShaderF16) {
            const models = useShaderF16 ? modelsWhenShaderF16Supported : modelsWhenShaderF16NotSupported;
            const identifiedModel = models.find((model) => model.id === modelId);
            return identifiedModel ? cloneModel(identifiedModel, useShaderF16) : undefined;
        }

        function findModelRecord(webllm, modelId) {
            const appConfig = webllm.prebuiltAppConfig;
            const matchedItem = appConfig && appConfig.model_list && appConfig.model_list.find((item) => item.model_id === modelId);
            if (!matchedItem) {
                throw new Error('Model not found in WebLLM app config: ' + modelId);
            }
            return matchedItem;
        }

        function cleanModelUrl(webllm, modelUrl) {
            if (webllm.cleanModelUrl) {
                return webllm.cleanModelUrl(modelUrl);
            }
            return modelUrl.endsWith('/') ? modelUrl : modelUrl + '/';
        }

        function getModelCacheUrls(webllm, modelId) {
            const modelRecord = findModelRecord(webllm, modelId);
            const modelUrl = cleanModelUrl(webllm, modelRecord.model);

            return {
                modelUrl : modelUrl,
                modelLibUrl : modelRecord.model_lib,
                tokenizerModelUrl : new URL('tokenizer.model', modelUrl).href,
                tokenizerJsonUrl : new URL('tokenizer.json', modelUrl).href,
                chatConfigUrl : new URL('mlc-chat-config.json', modelUrl).href
            };
        }

        function getResponseSize(response) {
            return response.clone().arrayBuffer()
                .then((buffer) => buffer.byteLength)
                .catch(() => 0);
        }

        function getCacheStorageForRequest(cacheName, requestUrl) {
            return caches.open(cacheName)
                .then((cache) => cache.match(requestUrl))
                .then((response) => {
                    if (!response) {
                        return 0;
                    }
                    return getResponseSize(response);
                });
        }

        function getCacheStorageForPrefix(cacheName, urlPrefix) {
            return caches.open(cacheName)
                .then((cache) => cache.keys())
                .then((requests) => {
                    const matchingRequests = requests.filter((request) => request.url.indexOf(urlPrefix) === 0);
                    return Promise.all(matchingRequests.map((request) => {
                        return cacheName && caches.open(cacheName)
                            .then((cache) => cache.match(request))
                            .then((response) => response ? getResponseSize(response) : 0);
                    }));
                })
                .then((sizes) => sizes.reduce((total, size) => total + size, 0));
        }

        function getModelCacheUsage(webllm, modelId) {
            const urls = getModelCacheUrls(webllm, modelId);

            return Promise.all([
                getCacheStorageForPrefix('webllm/model', urls.modelUrl),
                getCacheStorageForRequest('webllm/config', urls.chatConfigUrl),
                getCacheStorageForRequest('webllm/wasm', urls.modelLibUrl)
            ])
                .then((sizes) => sizes.reduce((total, size) => total + size, 0));
        }

        function deleteModelCache(webllm, modelId) {
            return webllm.deleteModelAllInfoInCache(modelId, webllm.prebuiltAppConfig);
        }

        function generateNgrams(userid, tenant, inputstrings) {
            var url = '/api/classes/' + tenant + '/students/' + userid + '/training/ngrams';
            return $http.post(url, { input : inputstrings })
                .then((resp) => {
                    return resp.data;
                });
        }

        return {
            generateNgrams,

            deleteModelCache,
            findModelRecord,
            getAllKnownModelIds,
            getAllModels,
            getAllModelsWithSupport,
            getModelCacheUrls,
            getModelCacheUsage,
            getModelDetails,
            getSupportedModels
        };
    }
})();