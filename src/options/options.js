(function () {
    // Shared Model Definitions (Should ideally be in a shared file, but duplicating for now to avoid module issues)
    const MODELS = {
        gemini: [
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview (NEXT-GEN)', provider: 'google' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (HYPER-SPEED)', provider: 'google' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (REASONING)', provider: 'google' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (BALANCED)', provider: 'google' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (EFFICIENT)', provider: 'google' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (FAST)', provider: 'google' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (STABLE)', provider: 'google' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (FREE)', provider: 'google' }
        ],
        openai: [
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' }
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' }
        ],
        local: [
            { id: 'llama3', name: 'Llama 3 (Local)', provider: 'local' },
            { id: 'deepseek-coder', name: 'DeepSeek Coder (Local)', provider: 'local' },
            { id: 'mistral', name: 'Mistral (Local)', provider: 'local' }
        ]
    };

    const DEFAULTS = {
        keys: { google: '', openai: '', anthropic: '' },
        localEndpoint: 'http://127.0.0.1:11434',
        selectedModelId: 'gemini-1.5-flash'
    };

    const els = {};

    function getEl(id) { return document.getElementById(id); }

    function populateModelSelect(mode) {
        const select = els.modelSelect;
        select.innerHTML = '';

        const createGroup = (label, models) => {
            const group = document.createElement('optgroup');
            group.label = label;
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                group.appendChild(opt);
            });
            select.appendChild(group);
        };

        // Filter based on mode
        if (mode === 'local') {
            createGroup('Local (Ollama)', MODELS.local);
        } else {
            createGroup('Google Gemini', MODELS.gemini);
            createGroup('OpenAI', MODELS.openai);
            createGroup('Anthropic', MODELS.anthropic);
        }
    }

    function setModeUI(mode) {
        // Toggle Sections
        els.sectionLocal.style.display = mode === 'local' ? 'block' : 'none';
        els.sectionCloud.style.display = mode === 'cloud' ? 'block' : 'none';

        // Update Selector
        populateModelSelect(mode);
    }

    async function loadSettings() {
        const settings = await chrome.storage.local.get(DEFAULTS);

        // Mode (Infer from saved provider or default)
        // If save has "aiProvider", use it. defaults to cloud in our DEFAULTS const? No, let's default to local if recommended.
        let mode = settings.aiProvider || 'local';

        if (mode === 'local') els.modeLocal.checked = true;
        else els.modeCloud.checked = true;

        setModeUI(mode);

        // Keys
        if (settings.keys) {
            els.keyGoogle.value = settings.keys.google || '';
            els.keyOpenai.value = settings.keys.openai || '';
            els.keyAnthropic.value = settings.keys.anthropic || '';
        }

        // Local
        els.localEndpoint.value = settings.localEndpoint || DEFAULTS.localEndpoint;

        // Model
        // We need to make sure the selected model is actually valid for the current mode.
        // If not, select the first available one.
        const currentModel = settings.selectedModelId || '';
        // Check if current model exists in the populated list (which is filtered by mode)
        // Wait, populate is synchronous.
        const options = Array.from(els.modelSelect.options).map(o => o.value);
        if (options.includes(currentModel)) {
            els.modelSelect.value = currentModel;
        } else if (options.length > 0) {
            els.modelSelect.value = options[0]; // Default to first available
        }
    }

    async function saveSettings() {
        // Determine mode
        const mode = els.modeLocal.checked ? 'local' : 'cloud';

        const payload = {
            aiProvider: mode,
            keys: {
                google: els.keyGoogle.value.trim(),
                openai: els.keyOpenai.value.trim(),
                anthropic: els.keyAnthropic.value.trim()
            },
            localEndpoint: els.localEndpoint.value.trim(),
            selectedModelId: els.modelSelect.value
        };

        await chrome.storage.local.set(payload);
        showStatus(els.saveStatus, 'Settings Saved!', 'ok');

        // Also update legacy Sidecar storage if needed? 
        // No, Sidecar will be updated to read from chrome.storage directly.
    }

    function showStatus(el, text, type) {
        el.textContent = text;
        el.className = 'status-text ' + (type || '');
        setTimeout(() => el.textContent = '', 2000);
    }

    function normalizeEndpoint(input) {
        let url = input.trim();

        // Remove trailing slash
        url = url.replace(/\/$/, '');

        // If it starts with an IP or localhost without protocol, add http://
        if (!/^https?:\/\//i.test(url)) {
            url = 'http://' + url;
        }

        // If it's just http://127.0.0.1 or http://localhost without port, suggest port?
        // For now, let's just assume if they made that specific typo they wanted the default port.

        return url;
    }

    async function testLocalConnection() {
        const endpoint = normalizeEndpoint(els.localEndpoint.value);
        const url = `${endpoint}/api/tags`; // Ollama specific check
        showStatus(els.testStatus, `Testing ${url}...`, '');

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const count = data.models ? data.models.length : 0;
                showStatus(els.testStatus, `Success! Found ${count} models.`, 'ok');
            } else {
                showStatus(els.testStatus, `Error: HTTP ${res.status}`, 'error');
            }
        } catch (e) {
            showStatus(els.testStatus, `Connection Failed: ${e.message}`, 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        els.modeLocal = getEl('mode-local');
        els.modeCloud = getEl('mode-cloud');

        els.sectionLocal = getEl('section-local');
        els.sectionCloud = getEl('section-cloud');

        els.keyGoogle = getEl('key-google');
        els.keyOpenai = getEl('key-openai');
        els.keyAnthropic = getEl('key-anthropic');
        els.localEndpoint = getEl('local-endpoint');
        els.modelSelect = getEl('model-select');
        els.saveBtn = getEl('save-settings');
        els.saveStatus = getEl('save-status');
        els.testBtn = getEl('test-local');
        els.testStatus = getEl('test-status');

        els.saveBtn.addEventListener('click', saveSettings);
        els.testBtn.addEventListener('click', testLocalConnection);

        // Mode switching listeners
        els.modeLocal.addEventListener('change', () => setModeUI('local'));
        els.modeCloud.addEventListener('change', () => setModeUI('cloud'));

        await loadSettings();
    });
})();
