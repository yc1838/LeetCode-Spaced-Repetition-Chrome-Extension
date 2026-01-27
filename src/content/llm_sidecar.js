/**
 * LLM Sidecar - Vanilla JS "Liquid Chrome" Implementation
 * Replicates the React component functionality in pure JS.
 */

(function () {
    // --- Constants ---

    const MODELS = {
        gemini: [
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', meta: 'NEXT-GEN', provider: 'google' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', meta: 'HYPER-SPEED', provider: 'google' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', meta: 'REASONING', provider: 'google' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', meta: 'BALANCED', provider: 'google' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', meta: 'EFFICIENT', provider: 'google' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', meta: 'LEGACY // FAST', provider: 'google' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', meta: 'STABLE', provider: 'google' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', meta: 'FREE // OLD', provider: 'google' },
            // Embedding models (hidden from standard selection but used internally)
            { id: 'text-embedding-004', name: 'Gemini Embedding', meta: 'EMBED', provider: 'google', type: 'embedding' }
        ],
        openai: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', meta: 'EFFICIENT', provider: 'openai' },
            { id: 'gpt-4o', name: 'GPT-4o', meta: 'SOTA', provider: 'openai' },
            // Embedding models
            { id: 'text-embedding-3-small', name: 'OpenAI Embedding Small', meta: 'EMBED', provider: 'openai', type: 'embedding' }
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', meta: 'BALANCED', provider: 'anthropic' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', meta: 'SPEED', provider: 'anthropic' },
        ]
    };

    const ALL_MODELS = [...MODELS.gemini, ...MODELS.openai, ...MODELS.anthropic];
    const CHAT_MODELS = ALL_MODELS.filter(m => m.type !== 'embedding');

    // --- Icons (SVG Strings) ---
    const ICONS = {
        minimize: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`,
        sparkles: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
        terminal: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>`,
        trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
        send: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
        key: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`,
    };

    // --- State ---
    let state = {
        isOpen: false,
        position: { x: 20, y: 20 },
        activeTab: 'settings', // 'settings' or 'chat'
        keys: { google: '', openai: '', anthropic: '' },
        selectedModelId: MODELS.gemini[0].id,
        messages: [],
        input: '',
        isLoading: false
    };

    // --- References ---
    let container = null;
    let dragOffset = { x: 0, y: 0 };
    let isDragging = false;

    // --- Persistence ---
    function loadState() {
        try {
            const savedKeys = localStorage.getItem('llm_sidecar_keys');
            if (savedKeys) state.keys = JSON.parse(savedKeys);

            const savedModel = localStorage.getItem('llm_sidecar_model');
            if (savedModel) state.selectedModelId = savedModel;

            const savedPos = localStorage.getItem('llm_sidecar_pos');
            if (savedPos) state.position = JSON.parse(savedPos);
        } catch (e) { console.error("Error loading state", e); }
    }

    function saveState() {
        localStorage.setItem('llm_sidecar_keys', JSON.stringify(state.keys));
        localStorage.setItem('llm_sidecar_model', state.selectedModelId);
        localStorage.setItem('llm_sidecar_pos', JSON.stringify(state.position));
    }

    // --- API Logic ---
    async function callLLM(prompt, systemPrompt = '', signal = null) {
        const model = ALL_MODELS.find(m => m.id === state.selectedModelId);
        const provider = model?.provider || 'google';
        const apiKey = state.keys[provider];

        if (!apiKey) throw new Error(`Missing API Key for ${provider}`);

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: signal
        };

        if (provider === 'google') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.selectedModelId}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                ...fetchOptions,
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt ? `${systemPrompt}\n${prompt}` : prompt }] }] })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            return data.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                ...fetchOptions,
                headers: { ...fetchOptions.headers, 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: state.selectedModelId,
                    messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }]
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            return data.choices?.[0]?.message?.content;
        }

        if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                ...fetchOptions,
                headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: state.selectedModelId, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: prompt }] })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            return data.content?.[0]?.text;
        }
    }

    async function embed(text) {
        // Determine provider based on selected model's provider
        const currentModel = ALL_MODELS.find(m => m.id === state.selectedModelId);
        const provider = currentModel?.provider || 'google';
        const apiKey = state.keys[provider];

        if (!apiKey) throw new Error(`Missing API Key for ${provider} to generate embeddings`);

        if (provider === 'google') {
            const modelId = 'text-embedding-004';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:embedContent?key=${apiKey}`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text }] },
                    model: `models/${modelId}`
                })
            });
            const data = await res.json();
            if (data.error) throw new Error("Embedding Error: " + data.error.message);
            return data.embedding.values;
        }

        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    input: text,
                    model: 'text-embedding-3-small'
                })
            });
            const data = await res.json();
            if (data.error) throw new Error("Embedding Error: " + data.error.message);
            return data.data[0].embedding;
        }

        // Fallback or error for Anthropic (no embedding API yet publicly strictly standard)
        // Or mock it with local hashing if needed, but for now throw.
        throw new Error("Embeddings not supported for this provider yet.");
    }

    function hasAnyKey() {
        return Object.values(state.keys || {}).some((k) => !!k);
    }

    function isAnalysisEnabled() {
        return hasAnyKey();
    }

    async function analyzeMistake(code, errorDetails, meta = {}, signal = null) {
        const title = meta.title || 'Unknown Problem';
        const difficulty = meta.difficulty || 'Unknown';
        const queryText = `Error: ${errorDetails}\nCode Snippet: ${code.substring(0, 300)}`; // Truncate for embedding

        let contextMsg = "";
        let isRecurrence = false;

        // --- RAG: Retrieval Step ---
        if (window.VectorDB) {
            try {
                // 1. Embed
                // Only embed if we have an API key for the provider
                if (hasAnyKey()) { // Simple check, embed() has more specific checks
                    const vector = await embed(queryText);

                    // 2. Search
                    const matches = await window.VectorDB.search(vector, 3, 0.75); // Threshold 0.75

                    if (matches && matches.length > 0) {
                        const topMatch = matches[0];
                        console.log(`[LLMSidecar] RAG Match Found! Score: ${topMatch.score.toFixed(2)}`);

                        // 3. Decision Gate
                        if (topMatch.score > 0.92) {
                            // High Confidence -> Return Cached Advice
                            console.log(`%c[AI Service] 🟢 LOCAL HIT (RAG) | Similarity: ${(topMatch.score * 100).toFixed(1)}%`, "color: #4ade80; font-weight: bold;");
                            return `💡 **Recurring Mistake Detected**\n\nIt seems you've made a very similar mistake before (${(topMatch.score * 100).toFixed(0)}% match).\n\n**Previous Advice:**\n${topMatch.advice}`;
                        }

                        // Medium Confidence -> Add Context
                        contextMsg = `\n\nCONTEXT: The user previously made a similar mistake (Similarity: ${topMatch.score.toFixed(2)}). Their previous advice was: "${topMatch.advice}". If this is the same issue, be brief and reference this.`;
                        isRecurrence = true;
                    }
                }
            } catch (e) {
                console.warn("[LLMSidecar] RAG step failed (continuing with standard analysis):", e);
            }
        }

        const systemPrompt = [
            'You are a LeetCode mentor.',
            'Analyze the failure, point out the likely bug or misconception, and suggest a fix.',
            isRecurrence ? 'Be VERY CONCISE. The user has seen this before.' : 'Be concise and focus on actionable guidance.'
        ].join(' ');

        const prompt = [
            `Problem: ${title}`,
            `Difficulty: ${difficulty}`,
            `Error: ${errorDetails || 'Unknown Error'}`,
            'Code:',
            code || '// No code captured',
            contextMsg,
            '',
            'Classify the error into one of these SPECIFIC TAGS.',
            'CRITICAL: Do NOT invent new tags. You MUST choose exactly one from the list below.',
            'If the error fits multiple, choose the most specific one.',
            '',
            '--- PYTHON SPECIFIC ---',
            '- PY_LIST_INDEX (IndexError: list index out of range)',
            '- PY_DICT_KEY (KeyError: key not found)',
            '- PY_STR_IMMUTABLE (TypeError: object does not support item assignment)',
            '- PY_SCOPE_UNBOUND (UnboundLocalError)',
            '- PY_SHALLOW_COPY (Modifying copy affected original)',
            '- PY_INDENTATION (IndentationError)',
            '',
            '--- ITERATION & POINTERS ---',
            '- OFF_BY_ONE (Loop range error or index alignment)',
            '- TWO_POINTER_COLLISION (Pointers crossed incorrectly)',
            '- SLIDING_WINDOW_INVALID (Window constraint violation)',
            '- INFINITE_LOOP (While condition never false)',
            '',
            '--- GRAPH & TREES ---',
            '- VISITED_MISSING (Forgot to track visited nodes)',
            '- NULL_NODE_ACCESS (Accessing val/left on None)',
            '- DISCONNECTED_GRAPH (Handling only one component)',
            '- CYCLE_DETECTION_FAIL (Failed to detect cycle)',
            '',
            '--- RECURSION & DP ---',
            '- BASE_CASE_MISSING (No recursion stop condition)',
            '- MEMOIZATION_MISSING (Brute force without cache)',
            '- DP_INIT_ERROR (Table init size/value wrong)',
            '- OVERLAPPING_LOGIC (Recomputing subproblems)',
            '',
            '--- MATH & DATA ---',
            '- MODULO_MISSING (Forgot mod 10^9+7)',
            '- INT_OVERFLOW (Exceeded integer limits)',
            '- FLOAT_PRECISION (Comparing floats with ==)',
            '- TYPE_MISMATCH (Comparing int vs str)',
            '',
            '--- SETUP ---',
            '- STATE_RESET_MISSING (Global vars not cleared)',
            '- EDGE_CASE_EMPTY (Failed on [] or 0)',
            '- RETURN_MISSING (Function returns None)',
            '',
            '--- STACK & QUEUE ---',
            '- STACK_UNDERFLOW (Pop from empty)',
            '- ORDER_MISMATCH (LIFO/FIFO confusion)',
            '',
            '--- BIT MANIPULATION ---',
            '- NEGATIVE_SHIFT (ValueError: negative shift count)',
            '- BITWISE_PRECEDENCE (Forgot parentheses around & |)',
            '',
            'Respond with this JSON format only:',
            '{',
            '  "root_cause": "1 sentence explanation",',
            '  "fix": "Code fix or strategy",',
            '  "family": "PYTHON" or "LOGIC" or "ALGO" or "STACK" or "BIT_MANIPULATION",',
            '  "specific_tag": "TAG_FROM_LIST (or NEW_TAG if distinct)",',
            '  "is_recurring": false',
            '}'
        ].join('\n');

        const activeModel = ALL_MODELS.find(m => m.id === state.selectedModelId);
        console.log(`%c[AI Service] ☁️ CLOUD REQUEST | Model: ${activeModel?.name || state.selectedModelId} (${activeModel?.provider})`, "color: #38bdf8; font-weight: bold;");

        let advice = await callLLM(prompt, systemPrompt, signal);

        // 1. Parse JSON Response
        let parsed = null;
        try {
            // Remove markdown code blocks if present
            const cleanJson = advice.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            console.warn("[LLMSidecar] JSON Parse Failed. Fallback to raw text.", e);
            // Attempt fallback extraction for legacy/malformed responses
            const catMatch = advice.match(/Category:?\s*([A-Z_]+)/i);
            parsed = {
                root_cause: advice,
                fix: "See explanation.",
                family: catMatch ? catMatch[1].toUpperCase() : 'UNCATEGORIZED',
                specific_tag: 'GENERAL',
                is_recurring: false
            };
        }

        // 2. Format for Display (Markdown)
        const displayAdvice = `### 🤖 Analysis: ${parsed.specific_tag}\n\n**Cause:** ${parsed.root_cause}\n\n**Fix:** ${parsed.fix}\n\n*(Family: ${parsed.family})*`;

        // 3. RAG Indexing
        if (window.VectorDB) {
            try {
                const vector = await embed(queryText);
                await window.VectorDB.add({
                    vector,
                    text: queryText,
                    advice: displayAdvice, // Save the readble version
                    metadata: {
                        title,
                        difficulty,
                        category: parsed.family,   // Legacy support
                        family: parsed.family,
                        tag: parsed.specific_tag,
                        timestamp: Date.now()
                    }
                });
                console.log(`[LLMSidecar] Saved mistake: ${parsed.family}/${parsed.specific_tag}`);
            } catch (e) {
                console.warn("[LLMSidecar] Failed to index mistake:", e);
            }
        }

        return displayAdvice;
        return displayAdvice;
    }

    async function reclassifyMistakes(onProgress) {
        if (!window.VectorDB || !hasAnyKey()) return;

        try {
            const records = await window.VectorDB.getAllWithKeys();
            // multiple legacy formats: no tag, or tag is GENERAL
            const legacy = records.filter(r => !r.metadata.tag || r.metadata.tag === 'GENERAL');

            if (legacy.length === 0) {
                if (onProgress) onProgress("No legacy records found.");
                return;
            }

            let completed = 0;
            if (onProgress) onProgress(`Found ${legacy.length} legacy records. Starting...`);

            for (const r of legacy) {
                // Extract original context
                // Format was: "Error: ...\nCode Snippet: ..."
                const parts = r.text.split('\nCode Snippet:');
                const errorDetails = parts[0].replace('Error: ', '').trim();
                const code = parts[1] ? parts[1].trim() : '';

                // Re-use the SAME prompt structure as analyzeMistake to get granular tags
                // We create a minimal version of the prompt here for the specific classification task
                const prompt = [
                    `Problem: ${r.metadata.title || 'Unknown'}`,
                    `Error: ${errorDetails}`,
                    `Code: ${code.substring(0, 500)}`, // truncated
                    '',
                    'Classify this OLD mistake into a specific tag from this list (JSON only):',
                    '--- PYTHON SPECIFIC ---',
                    '- PY_LIST_INDEX, PY_DICT_KEY, PY_STR_IMMUTABLE, PY_SCOPE_UNBOUND',
                    '--- LOGIC ---',
                    '- OFF_BY_ONE, VISITED_MISSING, BASE_CASE_MISSING, INFINITE_LOOP, EDGE_CASE_EMPTY',
                    '--- DATA ---',
                    '- INT_OVERFLOW, TYPE_MISMATCH',
                    '',
                    'Respond {"family": "...", "specific_tag": "..."} only.'
                ].join('\n');

                try {
                    const advice = await callLLM(prompt, "You are a code classifier. output JSON.");

                    // Parse
                    const cleanJson = advice.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);

                    if (parsed.specific_tag && parsed.family) {
                        // Update DB
                        const newMeta = { ...r.metadata, family: parsed.family, tag: parsed.specific_tag };
                        // Update display text too to reflect new tag? Maybe just metadata is enough for stats.
                        // Let's keep advice as is or append a note? Users requested "fix data", primarily for stats.
                        // We will just update metadata for the stats to be correct.
                        await window.VectorDB.update(r.id, { metadata: newMeta });
                    }
                } catch (e) {
                    console.warn(`[Reclassify] Failed for ${r.id}`, e);
                }

                completed++;
                if (onProgress) onProgress(`Processed ${completed}/${legacy.length}...`);
            }
            if (onProgress) onProgress("Done! Refresh Stats.");

        } catch (e) {
            console.error(e);
            if (onProgress) onProgress("Error: " + e.message);
        }
    }

    // --- UI Rendering ---

    function createElement(tag, className, innerHTML = '') {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    }

    function render() {
        if (!container) return; // Should allow re-render if needed

        // Clear existing content to re-render (naive React imitation)
        // Optimization: In real prod, modify DOM instead of full rebuild, but this is fine for this scale.
        container.innerHTML = '';
        container.className = `llm-sidecar-container ${state.isOpen ? 'llm-sidecar-expanded' : 'llm-sidecar-collapsed'}`;
        container.style.top = `${state.position.y}px`;
        container.style.left = `${state.position.x}px`;

        // === Header ===
        const header = createElement('div', state.isOpen ? 'llm-header llm-header-expanded' : 'llm-header llm-header-collapsed');

        // Drag Logic
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.no-drag')) return;
            isDragging = true;
            const rect = container.getBoundingClientRect();
            dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        const currentModel = ALL_MODELS.find(m => m.id === state.selectedModelId);
        const hasKey = !!state.keys[currentModel?.provider || 'google'];

        if (state.isOpen) {
            const titleBlock = createElement('div', '');
            titleBlock.appendChild(createElement('h2', 'llm-title', 'NEURAL LINK'));
            const statusRow = createElement('div', 'llm-status-row');
            statusRow.appendChild(createElement('div', `llm-status-dot ${hasKey ? 'llm-status-online' : 'llm-status-offline'}`));
            statusRow.appendChild(createElement('p', 'llm-model-name', currentModel?.id.toUpperCase() || 'UNKNOWN'));
            titleBlock.appendChild(statusRow);

            const controls = createElement('div', 'no-drag');
            const minBtn = createElement('button', 'llm-icon-btn', ICONS.minimize);
            minBtn.onclick = () => { state.isOpen = false; render(); };
            controls.appendChild(minBtn);

            header.appendChild(titleBlock);
            header.appendChild(controls);
        } else {
            // Collapsed Sparkle
            const spark = createElement('div', '', ICONS.sparkles);
            spark.style.color = 'var(--color-cyan)';
            if (!hasKey) {
                // Add red dot
                const dot = createElement('div', '');
                dot.style.cssText = "position:absolute; top:-2px; right:-2px; width:8px; height:8px; background:red; border-radius:50%; animation: pulse 1s infinite;";
                spark.appendChild(dot);
            }
            header.appendChild(spark);
            header.onclick = () => { if (!isDragging) { state.isOpen = true; render(); } };
        }

        container.appendChild(header);

        if (!state.isOpen) return; // Stop here if collapsed

        // === Content ===
        const content = createElement('div', 'llm-content');

        // Tabs
        const tabs = createElement('div', 'llm-tabs no-drag');
        const configTab = createElement('button', `llm-tab-btn ${state.activeTab === 'settings' ? 'active' : ''}`, '// CONFIG');
        configTab.onclick = () => { state.activeTab = 'settings'; render(); };
        const chatTab = createElement('button', `llm-tab-btn ${state.activeTab === 'chat' ? 'active' : ''}`, '// TERMINAL');
        chatTab.onclick = () => { state.activeTab = 'chat'; render(); };
        tabs.appendChild(configTab);
        tabs.appendChild(chatTab);
        content.appendChild(tabs);

        // Views
        if (state.activeTab === 'settings') renderSettings(content);
        else renderChat(content);

        // Footer
        const footer = createElement('div', 'llm-footer');
        footer.appendChild(createElement('span', 'llm-footer-text', 'V.2.0.5 // STABLE'));
        footer.appendChild(createElement('span', 'llm-footer-text', 'SECURE STORE'));
        content.appendChild(footer);

        container.appendChild(content);
    }

    function renderSettings(parent) {
        const area = createElement('div', 'llm-settings-area llm-custom-scroll no-drag');

        // Selector
        area.appendChild(createElement('span', 'llm-section-label', 'SELECT SUBSTRATE (MODEL)'));
        const list = createElement('div', 'llm-model-list');
        ALL_MODELS.filter(m => m.type !== 'embedding').forEach(m => {
            const item = createElement('div', `llm-model-item ${state.selectedModelId === m.id ? 'selected' : ''}`);
            item.onclick = () => { state.selectedModelId = m.id; saveState(); render(); };
            item.innerHTML = `<span class="llm-model-item-name">${m.name}</span><span class="llm-model-item-meta">${m.meta}</span>`;
            list.appendChild(item);
        });
        area.appendChild(list);

        // Keys
        area.appendChild(createElement('span', 'llm-section-label', 'ACCESS KEYS'));
        ['google', 'openai', 'anthropic'].forEach(p => {
            const group = createElement('div', 'llm-key-group');
            group.innerHTML = `<div class="llm-key-icon">${ICONS.key}</div>`;
            const input = createElement('input', 'llm-key-input');
            input.type = 'password';
            input.placeholder = `ENTER ${p.toUpperCase()} KEY`;
            input.value = state.keys[p] || '';
            input.oninput = (e) => { state.keys[p] = e.target.value; saveState(); }; // Auto save
            input.onblur = () => { render(); } // Re-render to update status dots
            group.appendChild(input);
            area.appendChild(group);
        });

        // Migration Tool
        area.appendChild(createElement('div', 'llm-spacer', ''));
        const fixBtn = createElement('button', 'llm-action-btn', '⚡ FIX LEGACY DATA');
        fixBtn.style.width = '100%';
        fixBtn.style.marginTop = '15px';
        fixBtn.style.justifyContent = 'center';
        fixBtn.onclick = async () => {
            fixBtn.disabled = true;
            fixBtn.innerText = "Scanning...";
            await reclassifyMistakes((status) => {
                fixBtn.innerText = status;
            });
            setTimeout(() => {
                fixBtn.disabled = false;
                fixBtn.innerText = "⚡ FIX LEGACY DATA";
            }, 3000);
        };
        area.appendChild(fixBtn);

        parent.appendChild(area);
    }

    function renderChat(parent) {
        const area = createElement('div', 'llm-chat-area');

        // Messages
        const msgList = createElement('div', 'llm-messages llm-custom-scroll');
        if (state.messages.length === 0) {
            msgList.innerHTML = `<div class="llm-empty-state"><div style="opacity:0.5; margin-bottom:10px">${ICONS.terminal}</div><p>SYSTEM READY<br>AWAITING INPUT...</p></div>`;
        } else {
            state.messages.forEach(msg => {
                const wrapper = createElement('div', `llm-msg-wrapper llm-msg-${msg.role}`);
                wrapper.innerHTML = `
                    <span class="llm-msg-label">${msg.role === 'user' ? 'USR_01' : 'SYS_CORE'}</span>
                    <div class="llm-msg-bubble">${msg.content}</div>
                `;
                msgList.appendChild(wrapper);
            });
            if (state.isLoading) {
                const loading = createElement('div', 'llm-loading');
                loading.innerHTML = `<span>PROCESSING</span> <span class="animate-spin">.</span>`;
                msgList.appendChild(loading);
            }
        }
        area.appendChild(msgList);
        // Auto scroll
        setTimeout(() => msgList.scrollTop = msgList.scrollHeight, 0);

        // Input
        const inputRow = createElement('div', 'llm-input-row no-drag');

        const trashBtn = createElement('button', 'llm-action-btn llm-btn-trash', ICONS.trash);
        trashBtn.onclick = () => { state.messages = []; render(); };

        const input = createElement('input', 'llm-input');
        input.placeholder = "Enter command...";
        input.value = state.input;
        input.oninput = (e) => { state.input = e.target.value; }; // Bind
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSend();
        };

        const sendBtn = createElement('button', 'llm-action-btn llm-btn-send', ICONS.send);
        sendBtn.disabled = state.isLoading;
        sendBtn.onclick = handleSend;

        inputRow.appendChild(trashBtn);
        inputRow.appendChild(input);
        inputRow.appendChild(sendBtn);
        area.appendChild(inputRow);

        parent.appendChild(area);

        // Focus input if not loading
        if (!state.isLoading) setTimeout(() => input.focus(), 50);
    }

    // --- Actions ---

    async function handleSend() {
        const prompt = state.input.trim();
        if (!prompt) return;

        state.messages.push({ role: 'user', content: prompt });
        state.input = '';
        state.isLoading = true;
        render();

        try {
            const res = await callLLM(prompt);
            state.messages.push({ role: 'assistant', content: res });
        } catch (e) {
            state.messages.push({ role: 'system', content: `Error: ${e.message}` });
        } finally {
            state.isLoading = false;
            render();
        }
    }

    function handleMouseMove(e) {
        if (!isDragging) return;
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        state.position = {
            x: Math.min(Math.max(0, newX), Math.max(0, window.innerWidth - 80)),
            y: Math.min(Math.max(0, newY), Math.max(0, window.innerHeight - 80))
        };

        // Direct DOM update for performance
        if (container) {
            container.style.left = `${state.position.x}px`;
            container.style.top = `${state.position.y}px`;
        }
    }

    function handleMouseUp() {
        if (isDragging) {
            isDragging = false;
            saveState(); // Save position on drop
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    }

    // --- Initialization ---

    function init() {
        // Create root container
        container = createElement('div', 'llm-sidecar-container');
        container.id = 'llm-sidecar-root';
        document.body.appendChild(container);

        loadState();
        render();
        console.log("[LLMSidecar] Neural Link Active.");
    }

    // Expose API globally
    window.LLMSidecar = {
        init,
        callLLM,
        embed,
        analyzeMistake,
        reclassifyMistakes,
        isAnalysisEnabled
    };

})();
