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
        ],
        openai: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', meta: 'EFFICIENT', provider: 'openai' },
            { id: 'gpt-4o', name: 'GPT-4o', meta: 'SOTA', provider: 'openai' },
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', meta: 'BALANCED', provider: 'anthropic' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', meta: 'SPEED', provider: 'anthropic' },
        ]
    };

    const ALL_MODELS = [...MODELS.gemini, ...MODELS.openai, ...MODELS.anthropic];

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
    async function callLLM(prompt, systemPrompt = '') {
        const model = ALL_MODELS.find(m => m.id === state.selectedModelId);
        const provider = model?.provider || 'google';
        const apiKey = state.keys[provider];

        if (!apiKey) throw new Error(`Missing API Key for ${provider}`);

        if (provider === 'google') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.selectedModelId}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt ? `${systemPrompt}\n${prompt}` : prompt }] }] })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            return data.candidates?.[0]?.content?.parts?.[0]?.text;
        }

        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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
                method: 'POST',
                headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: state.selectedModelId, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: prompt }] })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            return data.content?.[0]?.text;
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
        ALL_MODELS.forEach(m => {
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

    // Expose init globally if needed, or run immediately if module system allows
    // For Chrome Ext content script, we can just return an object
    window.LLMSidecar = { init };

})();
