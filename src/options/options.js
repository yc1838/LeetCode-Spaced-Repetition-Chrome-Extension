(function () {
    const MODELS = {
        gemini: [
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview (NEXT-GEN)', provider: 'google' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview (HYPER-SPEED)', provider: 'google' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (REASONING)', provider: 'google' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (BALANCED)', provider: 'google' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (EFFICIENT)', provider: 'google' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (FAST)', provider: 'google' }
        ],
        openai: [
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' }
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' }
        ],
        local: [
            { id: 'llama3.1', name: 'Llama 3.1 (Local)', provider: 'local' },
            { id: 'mistral-nemo', name: 'Mistral Nemo (Local)', provider: 'local' },
            { id: 'llama3', name: 'Llama 3 (Legacy Local)', provider: 'local' },
            { id: 'deepseek-coder', name: 'DeepSeek Coder (Local)', provider: 'local' },
            { id: 'mistral', name: 'Mistral (Legacy Local)', provider: 'local' }
        ]
    };

    const DEFAULTS = {
        aiProvider: 'local',
        keys: { google: '', openai: '', anthropic: '' },
        localEndpoint: 'http://127.0.0.1:11434',
        selectedModelId: 'llama3.1',
        aiAnalysisEnabled: true,
        uiLanguage: 'en'
    };

    const I18N = {
        en: {
            page_title: 'LeetCode EasyRepeat - AI Setup',
            ai_gate_heading: 'Enable AI Analysis',
            ai_gate_hint: 'Turn this on to unlock AI-powered mistake analysis and neural retention features.',
            ai_gate_enable_title: 'Enable AI Analysis',
            ai_gate_enable_subtitle: 'Allows mistake analysis, model setup, nightly digest, and drill generation.',
            ai_gate_disable_title: 'Disable AI Analysis',
            ai_gate_disable_subtitle: 'Hides AI setup and neural retention modules.',
            ai_gate_features_title: 'AI-only features when enabled:',
            ai_feature_item_1: 'Automatic wrong-answer analysis after failed submissions.',
            ai_feature_item_2: 'Local/Cloud model configuration and connection testing.',
            ai_feature_item_3: 'Backfill, nightly digest, and weak-skill drill generation.',
            ai_feature_item_4: 'Agent scheduling and debug settings.',
            model_group_local: 'Local (Ollama)',
            model_group_google: 'Google Gemini',
            model_group_openai: 'OpenAI',
            model_group_anthropic: 'Anthropic',
            status_ai_gate_enabled: 'AI analysis is enabled. AI setup and neural modules are now available.',
            status_ai_gate_disabled: 'AI analysis is disabled. AI setup and neural modules are hidden.',
            status_settings_saved: 'Settings Saved!',
            status_testing: 'Testing {url}...',
            status_test_success: 'Success! Found {count} models.',
            status_http_error: 'Error: HTTP {status}',
            status_connection_failed: 'Connection Failed: {message}',
            status_processing_history: 'Processing all history...',
            status_backfill_success: '✅ Processed {count} problems, updated {skills} skills{entries}{source}',
            status_backfill_source: ' (source: {source})',
            status_backfill_entries: ', {entries} events',
            status_no_history: 'No history found',
            status_warning_prefix: '⚠️ ',
            status_error_prefix: '❌ ',
            status_run_digest: 'Running digest...',
            status_digest_complete_detailed: '✅ Digest complete at {time}! Processed {items} items, updated {skills} skills.',
            status_digest_complete: '✅ Digest complete!',
            status_no_data: 'No data to process',
            status_generating_drills: 'Refilling drill queue...',
            status_drills_generated: '✅ Refilled +{count}. Queue now {pending}/{target} pending.{rotated}{fallback}',
            status_drills_queue_full: '✅ Queue is full: {pending}/{target} pending. Finish some drills before refilling.{cleanup}',
            status_drills_target_met: '✅ Queue is at target: {pending}/{target} pending.{cleanup}',
            status_drills_queue_snapshot: 'Queue status: {pending}/{target} pending.',
            status_drills_fallback: ' Reason: {fallback}.',
            status_drills_cleanup: ' Auto-cleaned {count} stale drill(s).',
            status_drills_rotated: ' Replaced {count} oldest pending drill(s) to make room.',
            status_no_weak_skills: 'No weak skills found',
            status_drills_cooldown: 'Please wait {seconds}s before refilling again.',
            status_fallback_queue_full: 'queue is already full',
            status_fallback_queue_target_met: 'queue already at target',
            status_fallback_cooldown: 'cooldown active',
            status_fallback_no_weak_skills: 'no weak skills detected',
            status_fallback_missing_api_key: 'no model key configured; used template drills',
            status_fallback_history_low_ratings: 'used low-rating history as weak-skill fallback',
            status_fallback_history_topics: 'used topic history as weak-skill fallback',
            status_fallback_no_history: 'no history available for weak-skill fallback',
            status_agent_saved: '✅ Settings saved!',
            tools_heading: '🧰 Tools',
            tools_hint: 'Manual maintenance utilities.',
            streak_repair_date_label: 'Date to mark active (YYYY-MM-DD)',
            streak_repair_hint: 'Use this when a streak day was missed because activity was not logged.',
            streak_repair_button: 'Repair Streak Day',
            status_streak_invalid_date: 'Invalid date. Use YYYY-MM-DD.',
            status_streak_repair_saved: '✅ Streak activity logged for {date}.',
            status_streak_repair_exists: 'ℹ️ {date} is already in your streak log.'
        },
        zh: {
            page_title: 'LeetCode EasyRepeat - AI 设置',
            hero_title: 'LeetCode EasyRepeat',
            hero_subtitle: 'AI 设置',
            language_label: '语言',
            hero_note: '配置本地或云端 AI 提供商并验证连接。',
            ai_gate_heading: '是否开启 AI 分析',
            ai_gate_hint: '开启后才能使用 AI 错误分析与神经记忆相关功能。',
            ai_gate_enable_title: '开启 AI 分析',
            ai_gate_enable_subtitle: '可用错题分析、模型配置、夜间总结与练习生成。',
            ai_gate_disable_title: '关闭 AI 分析',
            ai_gate_disable_subtitle: '将隐藏 AI 配置与神经记忆模块。',
            ai_gate_features_title: '开启后可用功能：',
            ai_feature_item_1: '提交失败后自动进行 Wrong Answer 分析。',
            ai_feature_item_2: '本地/云端模型配置与连接测试。',
            ai_feature_item_3: '历史回填、夜间总结、薄弱技能练习生成。',
            ai_feature_item_4: 'Agent 定时与调试设置。',
            ai_configuration_heading: 'AI 配置',
            active_model_label: '当前模型（请先选择）',
            active_model_hint: '模型选项会根据当前模式（本地 / 云端）自动切换。',
            choose_intelligence_source_heading: '选择智能来源',
            local_card_title: '本地（隐私）',
            local_card_subtitle: '私密离线，但推理可靠性较低。',
            cloud_card_title: '云端 API',
            cloud_card_subtitle: '逻辑能力更强，通常付费，需要 API Key。',
            cloud_access_keys_heading: '云端访问密钥',
            cloud_key_help_link: '不知道怎么获取 API Key？点这里。',
            google_key_label: 'Google Gemini API Key',
            openai_key_label: 'OpenAI API Key',
            anthropic_key_label: 'Anthropic API Key',
            cloud_local_endpoint_note: '在 Cloud 模式下不会使用 Local Endpoint。',
            local_setup_heading: '本地 LLM 配置',
            local_setup_hint: '使用 Ollama 或 LM Studio 在本地运行模型。',
            local_quality_warning_strong: '质量提醒：',
            local_quality_warning_rest: '本地模型可能会显著降低分析质量。',
            local_warning_item_1: '在复杂 LeetCode 正确性判断和边界情况上，它们可能判断错误。',
            local_warning_item_2: '夜间总结笔记可能变得泛化、不完整或不一致。',
            local_warning_item_3: '如果你需要高置信度评分和高质量笔记，请优先使用云模型。',
            local_endpoint_label: 'Local Endpoint',
            local_endpoint_hint_html: '这不是自动发现的。它只在 Local 模式下生效，用于指向你的本地模型服务地址（默认 <code>http://127.0.0.1:11434</code>）。',
            test_connection_button: '测试连接',
            quick_setup_heading: '快速配置指南',
            quick_setup_step_1: '安装本地模型服务。',
            quick_setup_step_2: '启动服务并保持运行。',
            quick_setup_step_3: '在上方填入 Endpoint 并点击“测试连接”。',
            ollama_example_heading: 'Ollama（示例）',
            lm_studio_heading: 'LM Studio（OpenAI 兼容）',
            troubleshooting_heading: '故障排查',
            troubleshooting_item_1: '如果测试显示网络错误，通常是本地服务未启动。',
            troubleshooting_item_2: '如果看到 CORS 错误，请在本地服务中启用 CORS。',
            save_all_settings_button: '保存全部设置',
            neural_retention_heading: '🧠 神经记忆代理',
            neural_retention_hint: '手动触发总结和练习生成功能用于测试。',
            backfill_button: '📚 从历史重建技能画像（一次性）',
            run_digest_button: '⚡ 分析今天记录并更新弱项',
            generate_drills_button: '🎯 补满练习队列（基于弱项）',
            neural_note_backfill_html: '• <b>历史重建</b>：扫描全部历史提交，重建你的 Skill DNA',
            neural_note_nightly_html: '• <b>今日分析</b>：只分析今天的数据并更新弱项',
            neural_note_generate_html: '• <b>补队列</b>：把待练习队列补到目标上限',
            neural_note_generate_cap_html: '• <b>上限</b>：同一弱项最多 9 题（每种题型最多 3 题）',
            agent_settings_heading: '⚙️ Agent 设置',
            digest_time_label: '夜间总结时间：',
            pattern_threshold_label: '错误模式阈值：',
            pattern_threshold_hint: '激活一个模式所需的错误次数',
            debug_logs_label: '详细调试日志：',
            debug_logs_hint: '启用后台调试日志',
            save_agent_settings_button: '💾 保存 Agent 设置',
            model_group_local: '本地（Ollama）',
            model_group_google: 'Google Gemini',
            model_group_openai: 'OpenAI',
            model_group_anthropic: 'Anthropic',
            status_ai_gate_enabled: 'AI 分析已开启。AI 配置与神经模块现已可用。',
            status_ai_gate_disabled: 'AI 分析已关闭。AI 配置与神经模块已隐藏。',
            status_settings_saved: '设置已保存！',
            status_testing: '正在测试 {url}...',
            status_test_success: '连接成功！发现 {count} 个模型。',
            status_http_error: '错误：HTTP {status}',
            status_connection_failed: '连接失败：{message}',
            status_processing_history: '正在处理全部历史...',
            status_backfill_success: '✅ 已处理 {count} 道题，更新 {skills} 个技能{entries}{source}',
            status_backfill_source: '（来源：{source}）',
            status_backfill_entries: '，{entries} 条事件',
            status_no_history: '未找到历史记录',
            status_warning_prefix: '⚠️ ',
            status_error_prefix: '❌ ',
            status_run_digest: '正在运行总结...',
            status_digest_complete_detailed: '✅ 总结完成于 {time}！处理了 {items} 条记录，更新 {skills} 个技能。',
            status_digest_complete: '✅ 总结完成！',
            status_no_data: '没有可处理的数据',
            status_generating_drills: '正在补充练习队列...',
            status_drills_generated: '✅ 已补充 {count} 题。当前队列 {pending}/{target}（待练习/目标）。{rotated}{fallback}',
            status_drills_queue_full: '✅ 队列已满：{pending}/{target}（待练习/目标）。请先完成一些题目再补充。{cleanup}',
            status_drills_target_met: '✅ 队列已达目标：{pending}/{target}（待练习/目标）。{cleanup}',
            status_drills_queue_snapshot: '队列状态：{pending}/{target}（待练习/目标）。',
            status_drills_fallback: '原因：{fallback}。',
            status_drills_cleanup: ' 已自动清理 {count} 条旧练习。',
            status_drills_rotated: ' 已移除最旧的 {count} 条待练习以腾出位置。',
            status_no_weak_skills: '未找到薄弱技能',
            status_drills_cooldown: '请等待 {seconds} 秒后再补充。',
            status_fallback_queue_full: '队列已经满了',
            status_fallback_queue_target_met: '队列已达到目标',
            status_fallback_cooldown: '冷却中',
            status_fallback_no_weak_skills: '未识别到可用弱项',
            status_fallback_missing_api_key: '未配置可用模型，已使用模板练习',
            status_fallback_history_low_ratings: '使用了低分历史作为弱项兜底',
            status_fallback_history_topics: '使用了题目主题历史作为弱项兜底',
            status_fallback_no_history: '没有可用历史记录用于弱项兜底',
            status_agent_saved: '✅ 设置已保存！',
            tools_heading: '🧰 工具',
            tools_hint: '用于手动维护的实用工具。',
            streak_repair_date_label: '补记活跃日期（YYYY-MM-DD）',
            streak_repair_hint: '当某天活动未被记录导致断签时，可在这里补记。',
            streak_repair_button: '补记连续天数',
            status_streak_invalid_date: '日期格式错误，请使用 YYYY-MM-DD。',
            status_streak_repair_saved: '✅ 已记录 {date} 的活跃状态。',
            status_streak_repair_exists: 'ℹ️ {date} 已存在于连续记录中。'
        }
    };

    let currentLanguage = DEFAULTS.uiLanguage;
    let latestDrillGenerationState = null;
    const DRILL_STATUS_PRESERVE_MS = 15000;

    const els = {};
    const statusTimers = new WeakMap();

    function getEl(id) {
        return document.getElementById(id);
    }

    function interpolate(template, values = {}) {
        return String(template).replace(/\{(\w+)\}/g, (match, key) => {
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
        });
    }

    function t(key, values = {}) {
        const table = I18N[currentLanguage] || I18N.en;
        const fallback = I18N.en || {};
        const template = table[key] ?? fallback[key] ?? key;
        return interpolate(template, values);
    }

    const DRILL_QUEUE_DEFAULT_TARGET = 12;

    function formatDrillFallback(fallbackCode) {
        if (!fallbackCode) return '';
        const reasonKey = {
            queue_full: 'status_fallback_queue_full',
            queue_target_met: 'status_fallback_queue_target_met',
            cooldown: 'status_fallback_cooldown',
            no_weak_skills: 'status_fallback_no_weak_skills',
            missing_api_key: 'status_fallback_missing_api_key',
            history_low_ratings: 'status_fallback_history_low_ratings',
            history_topics: 'status_fallback_history_topics',
            no_history: 'status_fallback_no_history'
        }[fallbackCode];

        return reasonKey ? t(reasonKey) : fallbackCode;
    }

    function buildDrillStatusMessage(payload = {}) {
        const pending = payload.pendingCount || 0;
        const target = payload.targetPending || DRILL_QUEUE_DEFAULT_TARGET;
        const fallbackCode = payload.fallback || '';
        const cleanupCount = payload.queueCleanupRemoved || 0;
        const rotatedCount = payload.queueRotatedOut || 0;
        const cleanup = cleanupCount > 0
            ? t('status_drills_cleanup', { count: cleanupCount })
            : '';
        const rotated = rotatedCount > 0
            ? t('status_drills_rotated', { count: rotatedCount })
            : '';

        if (fallbackCode === 'queue_full') {
            return t('status_drills_queue_full', { pending, target, cleanup });
        }

        if (fallbackCode === 'queue_target_met') {
            return t('status_drills_target_met', { pending, target, cleanup });
        }

        const fallbackReason = fallbackCode === 'queue_rotated' ? '' : formatDrillFallback(payload.fallback);
        const fallback = fallbackReason
            ? t('status_drills_fallback', { fallback: fallbackReason })
            : '';

        return t('status_drills_generated', {
            count: payload.count || 0,
            pending,
            target,
            rotated,
            fallback
        });
    }

    function shouldStickyDrillStatus(payload = {}) {
        const count = Number(payload.count || 0);
        const fallbackCode = payload.fallback || '';
        if (fallbackCode === 'queue_full' || fallbackCode === 'queue_target_met') return true;
        if (count <= 0) return false;
        return true;
    }

    function getDrillStatusTimestamp(status = {}) {
        const candidates = [
            Number(status._renderedAt || 0),
            Number(status.completedAt || 0),
            Number(status.startedAt || 0)
        ];

        for (const candidate of candidates) {
            if (Number.isFinite(candidate) && candidate > 0) return candidate;
        }
        return 0;
    }

    function shouldPreserveDrillStatus(status = {}) {
        if (!status || !status.status) return false;
        if (status.status === 'snapshot') return false;

        const timestamp = getDrillStatusTimestamp(status);
        if (timestamp > 0 && (Date.now() - timestamp) > DRILL_STATUS_PRESERVE_MS) {
            return false;
        }

        if (status.status === 'generating') return true;
        if (status.status === 'cooldown' || status.status === 'error') return true;
        if (status.status === 'complete' && shouldStickyDrillStatus(status)) return true;
        return false;
    }

    function renderDrillGenerationStatus(status, drillsStatusEl, triggerBtn) {
        if (triggerBtn) {
            triggerBtn.disabled = status?.status === 'generating';
        }

        if (!drillsStatusEl || !status || !status.status) return;
        latestDrillGenerationState = {
            ...status,
            _renderedAt: Date.now()
        };

        if (status.status === 'generating') {
            showStatus(drillsStatusEl, t('status_generating_drills'), 'loading');
            return;
        }

        if (status.status === 'snapshot') {
            showStatus(drillsStatusEl, t('status_drills_queue_snapshot', {
                pending: status.pendingCount || 0,
                target: status.targetPending || DRILL_QUEUE_DEFAULT_TARGET
            }), 'ok', { sticky: true });
            return;
        }

        if (status.status === 'cooldown') {
            showStatus(drillsStatusEl, t('status_warning_prefix') + t('status_drills_cooldown', {
                seconds: status.waitSeconds || 0
            }), 'error', { sticky: true });
            return;
        }

        if (status.status === 'complete') {
            showStatus(
                drillsStatusEl,
                buildDrillStatusMessage(status),
                'ok',
                { sticky: shouldStickyDrillStatus(status) }
            );
            return;
        }

        if (status.status === 'error') {
            showStatus(
                drillsStatusEl,
                t('status_error_prefix') + (status.error || t('status_no_weak_skills')),
                'error',
                { sticky: true }
            );
        }
    }

    async function fetchDrillQueueStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getDrillQueueStatus' });
            if (!response || !response.success) return null;
            return response;
        } catch (e) {
            return null;
        }
    }

    function applyTranslations() {
        document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';

        document.querySelectorAll('[data-i18n]').forEach(node => {
            if (node.dataset.i18nDefault === undefined) {
                node.dataset.i18nDefault = node.textContent;
            }
            const key = node.dataset.i18n;
            const translated = I18N[currentLanguage]?.[key];
            node.textContent = translated ?? node.dataset.i18nDefault;
        });

        document.querySelectorAll('[data-i18n-html]').forEach(node => {
            if (node.dataset.i18nDefaultHtml === undefined) {
                node.dataset.i18nDefaultHtml = node.innerHTML;
            }
            const key = node.dataset.i18nHtml;
            const translated = I18N[currentLanguage]?.[key];
            node.innerHTML = translated ?? node.dataset.i18nDefaultHtml;
        });
    }

    function populateModelSelect(mode, preferredModelId = '') {
        const select = els.modelSelect;
        if (!select) return;
        select.innerHTML = '';

        const createGroup = (label, models) => {
            const group = document.createElement('optgroup');
            group.label = label;
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                group.appendChild(option);
            });
            select.appendChild(group);
        };

        if (mode === 'local') {
            createGroup(t('model_group_local'), MODELS.local);
        } else {
            createGroup(t('model_group_google'), MODELS.gemini);
            createGroup(t('model_group_openai'), MODELS.openai);
            createGroup(t('model_group_anthropic'), MODELS.anthropic);
        }

        const values = Array.from(select.options).map(option => option.value);
        if (preferredModelId && values.includes(preferredModelId)) {
            select.value = preferredModelId;
        } else if (values.length > 0) {
            select.value = values[0];
        }
    }

    function setModeUI(mode, preferredModelId = '') {
        if (els.sectionLocal) {
            els.sectionLocal.style.display = mode === 'local' ? 'block' : 'none';
        }
        if (els.sectionCloud) {
            els.sectionCloud.style.display = mode === 'cloud' ? 'block' : 'none';
        }
        populateModelSelect(mode, preferredModelId);
    }

    function setAiFeatureVisibility(enabled) {
        const display = enabled ? 'block' : 'none';
        if (els.aiConfigCard) els.aiConfigCard.style.display = display;
        if (els.neuralRetentionCard) els.neuralRetentionCard.style.display = display;
        if (els.agentSettingsCard) els.agentSettingsCard.style.display = display;
    }

    async function applyAiAnalysisSetting(enabled, options = {}) {
        const normalized = Boolean(enabled);
        if (els.aiAnalysisEnabled) els.aiAnalysisEnabled.checked = normalized;
        if (els.aiAnalysisDisabled) els.aiAnalysisDisabled.checked = !normalized;
        setAiFeatureVisibility(normalized);

        if (options.persist) {
            const payload = { aiAnalysisEnabled: normalized };
            if (!normalized) {
                payload.agentEnabled = false;
            }
            await chrome.storage.local.set(payload);
        }

        if (options.notify) {
            showStatus(
                els.aiGateStatus,
                normalized ? t('status_ai_gate_enabled') : t('status_ai_gate_disabled'),
                'ok',
                { sticky: true }
            );
        }
    }

    async function loadSettings() {
        const settings = await chrome.storage.local.get(DEFAULTS);

        currentLanguage = settings.uiLanguage === 'zh' ? 'zh' : 'en';
        if (els.langSelect) {
            els.langSelect.value = currentLanguage;
        }
        applyTranslations();
        await applyAiAnalysisSetting(settings.aiAnalysisEnabled !== false, { notify: true });

        const mode = settings.aiProvider === 'cloud' ? 'cloud' : 'local';
        if (mode === 'local') {
            els.modeLocal.checked = true;
        } else {
            els.modeCloud.checked = true;
        }
        setModeUI(mode, settings.selectedModelId || '');

        if (settings.keys) {
            els.keyGoogle.value = settings.keys.google || '';
            els.keyOpenai.value = settings.keys.openai || '';
            els.keyAnthropic.value = settings.keys.anthropic || '';
        }

        els.localEndpoint.value = settings.localEndpoint || DEFAULTS.localEndpoint;
    }

    async function saveSettings() {
        const mode = els.modeLocal.checked ? 'local' : 'cloud';

        const payload = {
            aiProvider: mode,
            keys: {
                google: els.keyGoogle.value.trim(),
                openai: els.keyOpenai.value.trim(),
                anthropic: els.keyAnthropic.value.trim()
            },
            aiAnalysisEnabled: Boolean(els.aiAnalysisEnabled?.checked),
            localEndpoint: els.localEndpoint.value.trim(),
            selectedModelId: els.modelSelect.value,
            uiLanguage: currentLanguage
        };

        await chrome.storage.local.set(payload);
        showStatus(els.saveStatus, t('status_settings_saved'), 'ok');
    }

    function showStatus(el, text, type, options = {}) {
        if (!el) return;

        const existing = statusTimers.get(el);
        if (existing) {
            clearTimeout(existing);
            statusTimers.delete(el);
        }

        el.textContent = text;
        el.className = 'status-text ' + (type || '');

        if (options.sticky || type === 'loading') return;

        const timeout = type === 'error' ? 8000 : 2000;
        const timerId = setTimeout(() => {
            el.textContent = '';
            el.className = 'status-text';
            statusTimers.delete(el);
        }, timeout);

        statusTimers.set(el, timerId);
    }

    function getYesterdayDateString() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isValidDateString(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return false;
        const normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        return normalized === value;
    }

    async function repairStreakForDate(dateValue, statusEl) {
        if (!isValidDateString(dateValue)) {
            showStatus(statusEl, t('status_streak_invalid_date'), 'error', { sticky: true });
            return;
        }

        const { activityLog } = await chrome.storage.local.get({ activityLog: [] });
        const log = Array.isArray(activityLog) ? [...activityLog] : [];

        if (log.includes(dateValue)) {
            showStatus(statusEl, t('status_streak_repair_exists', { date: dateValue }), 'ok', { sticky: true });
            return;
        }

        log.push(dateValue);
        log.sort();
        await chrome.storage.local.set({ activityLog: log });
        showStatus(statusEl, t('status_streak_repair_saved', { date: dateValue }), 'ok', { sticky: true });
    }

    function normalizeEndpoint(input) {
        let url = (input || '').trim();

        if (!url) return DEFAULTS.localEndpoint;

        url = url.replace(/\/$/, '');
        if (!/^https?:\/\//i.test(url)) {
            url = 'http://' + url;
        }
        return url;
    }

    async function testLocalConnection() {
        const endpoint = normalizeEndpoint(els.localEndpoint.value);
        const url = `${endpoint}/api/tags`;
        showStatus(els.testStatus, t('status_testing', { url }), '');

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const count = data.models ? data.models.length : 0;
                showStatus(els.testStatus, t('status_test_success', { count }), 'ok');
            } else {
                showStatus(els.testStatus, t('status_http_error', { status: res.status }), 'error');
            }
        } catch (e) {
            showStatus(els.testStatus, t('status_connection_failed', { message: e.message }), 'error');
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
        els.aiAnalysisEnabled = getEl('ai-analysis-enabled');
        els.aiAnalysisDisabled = getEl('ai-analysis-disabled');
        els.aiGateStatus = getEl('ai-gate-status');
        els.aiConfigCard = getEl('ai-config-card');
        els.neuralRetentionCard = getEl('neural-retention-card');
        els.agentSettingsCard = getEl('agent-settings-card');
        els.saveBtn = getEl('save-settings');
        els.saveStatus = getEl('save-status');
        els.testBtn = getEl('test-local');
        els.testStatus = getEl('test-status');
        els.langSelect = getEl('lang-select');

        els.saveBtn.addEventListener('click', saveSettings);
        els.testBtn.addEventListener('click', testLocalConnection);

        els.modeLocal.addEventListener('change', () => setModeUI('local'));
        els.modeCloud.addEventListener('change', () => setModeUI('cloud'));

        if (els.aiAnalysisEnabled) {
            els.aiAnalysisEnabled.addEventListener('change', async () => {
                if (!els.aiAnalysisEnabled.checked) return;
                await applyAiAnalysisSetting(true, { persist: true, notify: true });
            });
        }

        if (els.aiAnalysisDisabled) {
            els.aiAnalysisDisabled.addEventListener('change', async () => {
                if (!els.aiAnalysisDisabled.checked) return;
                await applyAiAnalysisSetting(false, { persist: true, notify: true });
            });
        }

        if (els.langSelect) {
            els.langSelect.addEventListener('change', async () => {
                currentLanguage = els.langSelect.value === 'zh' ? 'zh' : 'en';
                applyTranslations();

                const mode = els.modeLocal.checked ? 'local' : 'cloud';
                const selectedModelId = els.modelSelect.value;
                setModeUI(mode, selectedModelId);
                await applyAiAnalysisSetting(Boolean(els.aiAnalysisEnabled?.checked), { notify: true });

                await chrome.storage.local.set({ uiLanguage: currentLanguage });
            });
        }

        await loadSettings();

        const backfillBtn = getEl('backfill-history');
        const backfillStatus = getEl('backfill-status');
        const runDigestBtn = getEl('run-digest');
        const genDrillsBtn = getEl('gen-drills');
        const digestStatus = getEl('digest-status');
        const drillsStatus = getEl('drills-status');

        if (backfillBtn) {
            backfillBtn.addEventListener('click', async () => {
                showStatus(backfillStatus, t('status_processing_history'), '');
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'backfillHistory' });
                    if (response && response.success) {
                        const source = response.source ? t('status_backfill_source', { source: response.source }) : '';
                        const entries = response.historyEntries ? t('status_backfill_entries', { entries: response.historyEntries }) : '';
                        showStatus(backfillStatus, t('status_backfill_success', {
                            count: response.count || 0,
                            skills: response.skills || 0,
                            entries,
                            source
                        }), 'ok', { sticky: true });
                    } else {
                        showStatus(backfillStatus, t('status_warning_prefix') + (response?.error || t('status_no_history')), 'error', { sticky: true });
                    }
                } catch (e) {
                    showStatus(backfillStatus, t('status_error_prefix') + e.message, 'error');
                }
            });
        }

        if (runDigestBtn) {
            runDigestBtn.addEventListener('click', async () => {
                showStatus(digestStatus, t('status_run_digest'), '');
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'runDigestNow' });
                    if (response && response.success) {
                        const { lastDigestResult } = await chrome.storage.local.get('lastDigestResult');
                        if (lastDigestResult) {
                            const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
                            const time = new Date(lastDigestResult.timestamp).toLocaleTimeString(locale);
                            showStatus(digestStatus, t('status_digest_complete_detailed', {
                                time,
                                items: lastDigestResult.submissionsProcessed,
                                skills: lastDigestResult.skillsUpdated
                            }), 'ok', { sticky: true });
                        } else {
                            showStatus(digestStatus, t('status_digest_complete'), 'ok');
                        }
                    } else {
                        showStatus(digestStatus, t('status_warning_prefix') + (response?.error || t('status_no_data')), 'error');
                    }
                } catch (e) {
                    showStatus(digestStatus, t('status_error_prefix') + e.message, 'error');
                }
            });
        }

        if (genDrillsBtn) {
            let queuePollInFlight = false;
            let queuePollTimer = null;

            const refreshQueueSnapshot = async () => {
                if (queuePollInFlight) return;
                if (shouldPreserveDrillStatus(latestDrillGenerationState)) return;

                queuePollInFlight = true;
                try {
                    const snapshot = await fetchDrillQueueStatus();
                    if (!snapshot) return;
                    renderDrillGenerationStatus(
                        {
                            status: 'snapshot',
                            pendingCount: snapshot.pendingCount,
                            targetPending: snapshot.targetPending
                        },
                        drillsStatus,
                        genDrillsBtn
                    );
                } finally {
                    queuePollInFlight = false;
                }
            };

            const { drillGenerationStatus } = await chrome.storage.local.get('drillGenerationStatus');
            if (drillGenerationStatus) {
                renderDrillGenerationStatus(drillGenerationStatus, drillsStatus, genDrillsBtn);
            }
            await refreshQueueSnapshot();

            if (chrome.storage?.onChanged) {
                chrome.storage.onChanged.addListener((changes, area) => {
                    if (area !== 'local' || !changes.drillGenerationStatus) return;
                    renderDrillGenerationStatus(
                        changes.drillGenerationStatus.newValue,
                        drillsStatus,
                        genDrillsBtn
                    );
                    if (changes.drillGenerationStatus.newValue?.status === 'complete') {
                        setTimeout(() => {
                            refreshQueueSnapshot();
                        }, 200);
                    }
                });
            }

            queuePollTimer = setInterval(() => {
                refreshQueueSnapshot();
            }, 3000);
            window.addEventListener('beforeunload', () => {
                if (queuePollTimer) clearInterval(queuePollTimer);
            }, { once: true });
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    refreshQueueSnapshot();
                }
            });

            genDrillsBtn.addEventListener('click', async () => {
                renderDrillGenerationStatus({ status: 'generating' }, drillsStatus, genDrillsBtn);
                genDrillsBtn.disabled = true;
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'generateDrillsNow' });
                    if (response && response.success) {
                        renderDrillGenerationStatus({ ...response, status: 'complete' }, drillsStatus, genDrillsBtn);
                    } else if (response?.error === 'cooldown') {
                        renderDrillGenerationStatus({ ...response, status: 'cooldown' }, drillsStatus, genDrillsBtn);
                    } else {
                        const fallbackReason = response?.fallback ? formatDrillFallback(response.fallback) : '';
                        renderDrillGenerationStatus(
                            { status: 'error', error: fallbackReason || response?.error || t('status_no_weak_skills') },
                            drillsStatus,
                            genDrillsBtn
                        );
                    }
                } catch (e) {
                    renderDrillGenerationStatus({ status: 'error', error: e.message }, drillsStatus, genDrillsBtn);
                } finally {
                    if (genDrillsBtn && genDrillsBtn.disabled) {
                        genDrillsBtn.disabled = false;
                    }
                }
            });
        }

        const digestTimeInput = getEl('digest-time');
        const patternThresholdInput = getEl('pattern-threshold');
        const debugLogsInput = getEl('debug-logs');
        const saveAgentBtn = getEl('save-agent-settings');
        const agentSaveStatus = getEl('agent-save-status');
        const streakRepairDateInput = getEl('streak-repair-date');
        const streakRepairBtn = getEl('streak-repair-btn');
        const streakRepairStatus = getEl('streak-repair-status');

        const agentSettings = await chrome.storage.local.get({
            agentDigestTime: '02:00',
            agentPatternThreshold: 3,
            agentDebugLogs: false
        });

        if (digestTimeInput) digestTimeInput.value = agentSettings.agentDigestTime;
        if (patternThresholdInput) patternThresholdInput.value = agentSettings.agentPatternThreshold;
        if (debugLogsInput) debugLogsInput.checked = Boolean(agentSettings.agentDebugLogs);

        if (saveAgentBtn) {
            saveAgentBtn.addEventListener('click', async () => {
                try {
                    await chrome.storage.local.set({
                        agentDigestTime: digestTimeInput?.value || '02:00',
                        agentPatternThreshold: parseInt(patternThresholdInput?.value || 3, 10),
                        agentDebugLogs: Boolean(debugLogsInput?.checked)
                    });
                    showStatus(agentSaveStatus, t('status_agent_saved'), 'ok');
                } catch (e) {
                    showStatus(agentSaveStatus, t('status_error_prefix') + e.message, 'error');
                }
            });
        }

        if (streakRepairDateInput && !streakRepairDateInput.value) {
            streakRepairDateInput.value = getYesterdayDateString();
        }

        if (streakRepairBtn) {
            streakRepairBtn.addEventListener('click', async () => {
                const dateValue = (streakRepairDateInput?.value || '').trim();
                try {
                    streakRepairBtn.disabled = true;
                    await repairStreakForDate(dateValue, streakRepairStatus);
                } catch (e) {
                    showStatus(streakRepairStatus, t('status_error_prefix') + e.message, 'error', { sticky: true });
                } finally {
                    streakRepairBtn.disabled = false;
                }
            });
        }
    });
})();
