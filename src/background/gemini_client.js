/**
 * Gemini API Client
 * 
 * Handles communication with Gemini API for skill analysis.
 * Includes retry logic with exponential backoff.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js (for testing)
        module.exports = factory();
    } else {
        // Browser
        root.GeminiClient = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    console.log('[GeminiClient] Initializing script...');

    const globalRoot = typeof self !== 'undefined'
        ? self
        : (typeof globalThis !== 'undefined' ? globalThis : this);
    const DebugLog = globalRoot?.NeuralDebug || {
        log: () => { },
        warn: () => { },
        groupCollapsed: () => { },
        groupEnd: () => { }
    };

    const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
    const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
    const DEPRECATED_GEMINI_MODELS = new Set(['gemini-1.5-flash', 'gemini-1.5-pro']);
    const DEFAULT_MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    /**
     * Get API key from chrome storage.
     */
    async function getApiKey() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.local.get(['geminiApiKey', 'keys']);
            // Backward compat + new unified settings (keys.google)
            return result.geminiApiKey || result.keys?.google || null;
        }
        return null;
    }

    /**
     * Get the selected Gemini model (falls back if not a Gemini model or deprecated).
     */
    async function getModelId() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.local.get(['selectedModelId']);
            const selected = typeof result.selectedModelId === 'string'
                ? result.selectedModelId.trim()
                : '';

            if (selected && selected.startsWith('gemini-')) {
                if (DEPRECATED_GEMINI_MODELS.has(selected)) {
                    DebugLog.warn('[GeminiClient] Selected model deprecated; falling back.', {
                        selected,
                        fallback: DEFAULT_GEMINI_MODEL
                    });
                    return DEFAULT_GEMINI_MODEL;
                }
                return selected;
            }
        }
        return DEFAULT_GEMINI_MODEL;
    }

    /**
     * Check if error is retryable (5xx errors).
     */
    function isRetryable(status) {
        return status >= 500 && status < 600;
    }

    /**
     * Sleep for a given number of milliseconds.
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Extract JSON from Gemini response text.
     * Handles both raw JSON and markdown code blocks.
     */
    function extractJSON(text) {
        if (!text) return null;

        let jsonString = text.trim();

        // 1. Try to extract from markdown code blocks (```json ... ``` or ``` ... ```)
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim();
        }

        // 2. If it still looks like it has garbage before/after, find the first '{' and last '}'
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        try {
            return JSON.parse(jsonString);
        } catch (e) {
            // Last ditch effort: sometimes models put comments in JSON? 
            // For now, just logging the failure is enough as we have a loop.
            return null;
        }
    }

    /**
     * Validate Gemini response matches expected schema.
     */
    function validateResponse(response) {
        if (!response) return false;
        if (!Array.isArray(response.skillUpdates)) return false;
        if (!Array.isArray(response.insights)) return false;

        // Validate each skill update has required fields
        for (const update of response.skillUpdates) {
            if (!update.skillId || typeof update.delta !== 'number') {
                return false;
            }
        }

        return true;
    }

    /**
     * Analyze submissions using Gemini API.
     * 
     * @param {string} prompt - The formatted prompt from DayLogHarvester
     * @param {Object} options - Options including maxRetries
     * @returns {Object} Analysis result or error
     */
    async function analyzeSubmissions(prompt, options = {}) {
        const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
        const apiKey = await getApiKey();
        const modelId = await getModelId();

        if (!apiKey) {
            return { error: 'No API key configured' };
        }

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.2,  // Low temperature for consistent analysis
                maxOutputTokens: 2048,
                "response_mime_type": "application/json"
            }
        };

        let lastError = null;
        let attempts = 0;

        DebugLog.log('[GeminiClient] Using model for generateContent:', modelId);

        while (attempts < maxRetries) {
            attempts++;

            try {
                const response = await fetch(`${GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    lastError = `HTTP ${response.status}: ${response.statusText}`;
                    let errorBody = '';
                    try {
                        errorBody = await response.text();
                    } catch (e) {
                        errorBody = '';
                    }
                    if (errorBody) {
                        DebugLog.warn('[GeminiClient] API error body:', errorBody.slice(0, 500));
                    }
                    DebugLog.warn('[GeminiClient] API error status:', {
                        status: response.status,
                        statusText: response.statusText
                    });

                    // Don't retry on 4xx errors
                    if (!isRetryable(response.status)) {
                        return { error: lastError };
                    }

                    // Retry with exponential backoff
                    if (attempts < maxRetries) {
                        await sleep(RETRY_DELAY_MS * Math.pow(2, attempts - 1));
                        continue;
                    }

                    return { error: lastError };
                }

                const data = await response.json();

                // Check for blocked content or safety issues
                if (data.promptFeedback?.blockReason) {
                    DebugLog.warn('[GeminiClient] Prompt blocked:', {
                        blockReason: data.promptFeedback.blockReason,
                        safetyRatings: data.promptFeedback.safetyRatings
                    });
                    return { error: `Prompt blocked: ${data.promptFeedback.blockReason}` };
                }

                // Check candidate finish reason for filtered content
                const candidate = data.candidates?.[0];
                if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                    DebugLog.warn('[GeminiClient] Unusual finish reason:', {
                        finishReason: candidate.finishReason,
                        safetyRatings: candidate.safetyRatings
                    });
                    if (candidate.finishReason === 'SAFETY') {
                        return { error: 'Response filtered due to safety' };
                    }
                }

                // Extract text from Gemini response
                const text = candidate?.content?.parts?.[0]?.text;
                if (!text) {
                    DebugLog.warn('[GeminiClient] Empty response text:', {
                        candidateCount: data.candidates?.length || 0,
                        finishReason: candidate?.finishReason,
                        hasParts: candidate?.content?.parts?.length || 0,
                        rawData: JSON.stringify(data).slice(0, 500)
                    });
                    return { error: 'Empty response from Gemini' };
                }

                // Parse JSON from response
                const parsed = extractJSON(text);
                if (!parsed) {
                    DebugLog.warn('[GeminiClient] Failed to parse JSON. Raw text sample:', text.slice(0, 500));
                    return { error: 'Failed to parse JSON from response', rawText: text };
                }

                // Validate response schema (for skill analysis)
                // Note: drill generation returns { drills: [...] } which won't pass this validation
                if (!validateResponse(parsed)) {
                    // Log what we got for debugging
                    DebugLog.log('[GeminiClient] Non-standard response format:', {
                        hasDrills: Array.isArray(parsed.drills),
                        drillCount: parsed.drills?.length || 0,
                        hasSkillUpdates: Array.isArray(parsed.skillUpdates),
                        keys: Object.keys(parsed)
                    });

                    // Return partial result with warning - include drills for drill generation case
                    return {
                        ...parsed,
                        warning: 'Response may be incomplete',
                        skillUpdates: parsed.skillUpdates || [],
                        insights: parsed.insights || [],
                        recommendedDrills: parsed.recommendedDrills || [],
                        drills: parsed.drills || [] // Explicitly include for drill generation
                    };
                }

                return parsed;

            } catch (e) {
                lastError = e.message;
                console.error('[GeminiClient] Request error:', e);

                if (attempts < maxRetries) {
                    await sleep(RETRY_DELAY_MS * Math.pow(2, attempts - 1));
                    continue;
                }
            }
        }

        return { error: lastError || 'Unknown error' };
    }

    /**
     * Build the analysis prompt with skill taxonomy context.
     */
    function buildAnalysisPrompt(formattedSubmissions, taxonomyContext = null) {
        let prompt = `You are a coding skill analyst for a LeetCode practice extension.

${formattedSubmissions}

Skill Taxonomy Reference (use these skill IDs):
- binary_search_basic, binary_search_bounds, search_rotated
- two_pointer_opposite, two_pointer_same, fast_slow
- sliding_fixed, sliding_variable
- bfs, dfs, dijkstra, topological_sort, union_find
- dp_1d, dp_2d, dp_knapsack, dp_memoization
- off_by_one, edge_empty, edge_boundary, null_check
- (and more from the full taxonomy)

Respond ONLY with valid JSON matching this schema:
{
  "skillUpdates": [
    { "skillId": "string (from taxonomy)", "delta": number (-15 to +10), "reason": "brief explanation" }
  ],
  "insights": ["array of 1-3 key observations about the user's mistakes"],
  "recommendedDrills": [
    { "skillId": "string", "type": "fill-in-blank|spot-bug|critique" }
  ]
}

Rules:
- delta should be negative for mistakes (-5 to -15), positive for successes (+3 to +10)
- Focus on the ROOT CAUSE of mistakes, not just symptoms
- Recommend 1-3 drills max, targeting the weakest identified skills`;

        return prompt;
    }

    return {
        analyzeSubmissions,
        extractJSON,
        validateResponse,
        getApiKey,
        buildAnalysisPrompt,
        GEMINI_API_URL: GEMINI_API_BASE
    };
}));
