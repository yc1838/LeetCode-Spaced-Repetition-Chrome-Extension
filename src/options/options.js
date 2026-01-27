(function () {
    const DEFAULTS = {
        aiProvider: 'cloud',
        localEndpoint: 'http://localhost:11434',
        localServerType: 'auto',
        localModel: ''
    };

    const els = {};

    function getEl(id) {
        return document.getElementById(id);
    }

    function normalizeBaseUrl(url) {
        if (!url) return '';
        return url.replace(/\/+$/, '');
    }

    function applyTheme(themeName) {
        if (typeof THEMES === 'undefined') return;
        const theme = THEMES[themeName] || THEMES.sakura;
        const root = document.documentElement;
        root.style.setProperty('--terminal', theme.terminal);
        root.style.setProperty('--electric', theme.electric);
        root.style.setProperty('--accent', theme.accent);
        root.style.setProperty('--border-glow', theme.borderGlow);
        root.style.setProperty('--border-dim', theme.borderDim);
        root.style.setProperty('--bg-main', theme.bgMain);
        root.style.setProperty('--font-main', theme.fontMain);
    }

    async function loadTheme() {
        const storage = await chrome.storage.local.get({ theme: 'sakura' });
        applyTheme(storage.theme === 'neural' ? 'typography' : storage.theme);
    }

    function setProviderUI(provider) {
        const localSection = els.localSettings;
        if (!localSection) return;
        localSection.classList.toggle('hidden', provider !== 'local');
    }

    async function loadSettings() {
        const settings = await chrome.storage.local.get(DEFAULTS);
        const provider = settings.aiProvider || DEFAULTS.aiProvider;
        els.providerCloud.checked = provider === 'cloud';
        els.providerLocal.checked = provider === 'local';
        els.localEndpoint.value = settings.localEndpoint || DEFAULTS.localEndpoint;
        els.localServerType.value = settings.localServerType || DEFAULTS.localServerType;
        els.localModel.value = settings.localModel || DEFAULTS.localModel;
        setProviderUI(provider);
    }

    async function saveSettings() {
        const provider = els.providerLocal.checked ? 'local' : 'cloud';
        const payload = {
            aiProvider: provider,
            localEndpoint: els.localEndpoint.value.trim(),
            localServerType: els.localServerType.value,
            localModel: els.localModel.value.trim()
        };
        await chrome.storage.local.set(payload);
        showSaveStatus('Saved');
    }

    function showSaveStatus(text) {
        if (!els.saveStatus) return;
        els.saveStatus.textContent = text;
        setTimeout(() => {
            els.saveStatus.textContent = '';
        }, 1500);
    }

    function showTestStatus(text, type) {
        if (!els.testStatus) return;
        els.testStatus.textContent = text;
        els.testStatus.classList.remove('ok', 'error');
        if (type) els.testStatus.classList.add(type);
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            return res;
        } finally {
            clearTimeout(timeout);
        }
    }

    function buildOllamaUrl(base) {
        if (/\/api$/.test(base)) return `${base}/tags`;
        return `${base}/api/tags`;
    }

    function buildOpenAiUrl(base) {
        if (/\/v1$/.test(base)) return `${base}/models`;
        return `${base}/v1/models`;
    }

    async function tryOllama(base) {
        const url = buildOllamaUrl(base);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = Array.isArray(data.models) ? data.models : [];
        return {
            type: 'ollama',
            modelCount: models.length,
            sample: models[0]?.name || ''
        };
    }

    async function tryOpenAi(base) {
        const url = buildOpenAiUrl(base);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = Array.isArray(data.data) ? data.data : [];
        return {
            type: 'openai',
            modelCount: models.length,
            sample: models[0]?.id || ''
        };
    }

    async function testConnection() {
        const base = normalizeBaseUrl(els.localEndpoint.value.trim());
        if (!base) {
            showTestStatus('Please enter a local endpoint.', 'error');
            return;
        }

        showTestStatus('Testing connection...', null);

        const serverType = els.localServerType.value;
        const attempts = [];

        if (serverType === 'ollama') attempts.push(() => tryOllama(base));
        if (serverType === 'openai') attempts.push(() => tryOpenAi(base));
        if (serverType === 'auto') {
            attempts.push(() => tryOpenAi(base));
            attempts.push(() => tryOllama(base));
        }

        for (const attempt of attempts) {
            try {
                const result = await attempt();
                const modelText = result.modelCount > 0
                    ? `models: ${result.modelCount} (e.g. ${result.sample})`
                    : 'no models returned';
                showTestStatus(`Connected (${result.type}). ${modelText}`, 'ok');
                return;
            } catch (err) {
                continue;
            }
        }

        showTestStatus('Connection failed. Check server, endpoint, and CORS.', 'error');
    }

    function bindEvents() {
        els.providerCloud.addEventListener('change', () => setProviderUI('cloud'));
        els.providerLocal.addEventListener('change', () => setProviderUI('local'));
        els.saveBtn.addEventListener('click', saveSettings);
        els.testBtn.addEventListener('click', testConnection);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        els.providerCloud = getEl('provider-cloud');
        els.providerLocal = getEl('provider-local');
        els.localEndpoint = getEl('local-endpoint');
        els.localServerType = getEl('local-server-type');
        els.localModel = getEl('local-model');
        els.saveBtn = getEl('save-settings');
        els.testBtn = getEl('test-local');
        els.saveStatus = getEl('save-status');
        els.testStatus = getEl('test-status');
        els.localSettings = getEl('local-settings');

        await loadTheme();
        await loadSettings();
        bindEvents();
    });
})();
