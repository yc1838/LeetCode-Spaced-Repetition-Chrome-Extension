/**
 * LLM Gateway
 * 
 * Routes requests to the appropriate AI provider (Gemini, OpenAI, Local, etc.)
 * based on user settings.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LLMGateway = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    let GeminiClient, OpenAIClient;
    const globalRoot = typeof self !== 'undefined' ? self : this;

    // Load dependencies if available globally (Browser)
    if (globalRoot.GeminiClient) GeminiClient = globalRoot.GeminiClient;
    if (globalRoot.OpenAIClient) OpenAIClient = globalRoot.OpenAIClient;

    // If Node.js context (testing), might need require (skipped for now as per project structure)

    const DEFAULTS = {
        provider: 'local' // Fallback
    };

    /**
     * Get the active provider from settings.
     */
    async function getActiveProvider() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.local.get(['aiProvider']);
            return result.aiProvider || 'local'; // 'local' or 'cloud'
        }
        return 'local';
    }

    /**
     * Get the active cloud provider based on selected model (if mode is cloud).
     * Or explicit preference if we had one.
     * Currently `aiProvider` is just 'local' vs 'cloud'.
     * If 'cloud', we check the model ID to disambiguate Google vs OpenAI.
     */
    async function getCloudClient() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.local.get(['selectedModelId']);
            const modelId = result.selectedModelId || '';

            if (modelId.startsWith('gpt-')) {
                return OpenAIClient;
            }
            if (modelId.startsWith('gemini-')) {
                return GeminiClient;
            }
            // Fallback to Gemini if unknown
            return GeminiClient;
        }
        return GeminiClient;
    }

    /**
     * Unified generation method.
     */
    async function generateContent(prompt, options = {}) {
        const mode = await getActiveProvider();

        if (mode === 'local') {
            // TODO: Implement LocalClient / connect to Sidecar logic?
            // For now, if local is selected but backend logic runs, we might need a LocalClient adapter.
            // But Sprint 11.3 focus is fixing Cloud selection bug. 
            // If user selected Local, we probably shouldn't be routing to Cloud.
            // However, `DrillGenerator` runs in background. 
            // Existing `GeminiClient` was hardcoded.
            // If we lack LocalClient in background, we might fallback to Cloud or error.
            // Let's error to be safe, or fallback to Gemini if that's the legacy behavior?
            // User requested "Gemini token affected", implying they wanted OpenAI.

            return { error: 'Local LLM not yet supported in background agents. Please select Cloud mode.' };
        }

        const client = await getCloudClient();
        if (client && client.generateContent) {
            console.log(`[LLMGateway] Routing to ${client === OpenAIClient ? 'OpenAI' : 'Gemini'}`);
            return await client.generateContent(prompt, options);
        }

        return { error: 'No suitable cloud client found' };
    }

    /**
     * Unified analysis method.
     */
    async function analyzeSubmissions(prompt, options = {}) {
        const mode = await getActiveProvider();

        if (mode === 'local') {
            return { error: 'Local LLM not yet supported in background agents.' };
        }

        const client = await getCloudClient();
        if (client && client.analyzeSubmissions) {
            console.log(`[LLMGateway] Routing analysis to ${client === OpenAIClient ? 'OpenAI' : 'Gemini'}`);
            return await client.analyzeSubmissions(prompt, options);
        }

        return { error: 'No suitable cloud client found' };
    }

    return {
        generateContent,
        analyzeSubmissions
    };
}));
