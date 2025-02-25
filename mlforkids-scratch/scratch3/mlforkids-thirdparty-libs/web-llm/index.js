(async () => {
    if (!window.mlforkidsWebLlm) {
        const module = await import("https://esm.run/@mlc-ai/web-llm");
        window.mlforkidsWebLlm = module;
    }
})();
