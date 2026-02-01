/**
 * Drill Page Logic
 * 
 * Handles the full-page drill practice experience.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DrillPage = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const DRILL_ICONS = {
        'fill-in-blank': '✍️',
        'spot-bug': '🐛',
        'critique': '💬',
        'muscle-memory': '💪'
    };

    /**
     * Parse drill ID from URL query params.
     */
    function getDrillFromURL(search) {
        const params = new URLSearchParams(search);
        return params.get('drillId') || null;
    }

    /**
     * Get URL for drill page with given drill ID.
     */
    function getDrillPageURL(drillId) {
        const base = chrome.runtime.getURL('src/drills/drills.html');
        return `${base}?drillId=${drillId}`;
    }

    /**
     * Format skill ID to display name.
     */
    function getSkillDisplayName(skillId) {
        return skillId
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Get icon for drill type.
     */
    function getDrillTypeIcon(type) {
        return DRILL_ICONS[type] || '📝';
    }

    /**
     * Render drill content HTML based on type.
     */
    function renderDrillContent(drill) {
        const icon = getDrillTypeIcon(drill.type);
        const skillName = getSkillDisplayName(drill.skillId);

        let inputHTML = '';

        switch (drill.type) {
            case 'fill-in-blank':
                inputHTML = `
                    <div class="drill-prompt">
                        <pre class="code-block">${escapeHtml(drill.content)}</pre>
                    </div>
                    <div class="drill-input">
                        <label>Fill in the blank:</label>
                        <input type="text" id="drill-answer" placeholder="Your answer..." autofocus>
                    </div>
                `;
                break;

            case 'spot-bug':
                const lines = drill.content.split('\n');
                const numberedLines = lines.map((line, i) => {
                    // Tokenize the line: keep delimiters (whitespace, punctuation) as separate tokens
                    // Split by: (whitespace) | (punctuation/symbols)
                    // We want to wrap "interactive" tokens (words, numbers, symbols) but not just whitespace?
                    // Let's wrap EVERYTHING but style whitespace as invisible/unclickable if needed.
                    // Actually, let's keep it simple: split by word boundary or non-word chars.

                    // Simple regex to split and keep delimiters: /([a-zA-Z0-9_]+|[^\s\w]+)/g
                    // This creates: ["word", "symbol", "word"]

                    let tokensHTML = '';
                    const tokens = line.split(/([a-zA-Z0-9_]+|[^\s\w]+)/g).filter(t => t);

                    tokensHTML = tokens.map(token => {
                        // If it's just whitespace, don't make it interactive
                        if (/^\s+$/.test(token)) {
                            return `<span>${escapeHtml(token)}</span>`;
                        }
                        return `<span class="code-token">${escapeHtml(token)}</span>`;
                    }).join('');

                    return `<div class="code-line" data-line="${i + 1}">
                        <span class="line-num">${i + 1}</span>
                        <span class="line-content">${tokensHTML}</span>
                     </div>`;
                }).join('');

                inputHTML = `
                    <div class="drill-prompt">
                        <div class="code-interactive">${numberedLines}</div>
                    </div>
                    <div class="drill-instruction">
                        Click the bug (token) to investigate.
                    </div>
                    <input type="hidden" id="drill-answer" value="">
                `;
                break;

            case 'critique':
                inputHTML = `
                    <div class="drill-prompt">
                        <pre class="code-block">${escapeHtml(drill.content)}</pre>
                    </div>
                    <div class="drill-input">
                        <label>Your analysis:</label>
                        <textarea id="drill-answer" rows="6" placeholder="Time complexity: O(...)\nSpace complexity: O(...)\nExplanation:"></textarea>
                    </div>
                `;
                break;

            case 'muscle-memory':
                inputHTML = `
                    <div class="drill-prompt">
                        <p>${escapeHtml(drill.content)}</p>
                    </div>
                    <div class="drill-input">
                        <div class="input-header">
                            <label>Write your solution:</label>
                            <span class="input-hint">✨ AI Evaluation Enabled (Pseudo-code or Python)</span>
                        </div>
                        <textarea id="drill-answer" rows="12" placeholder="function binarySearch(arr, target):
    left = 0, right = len(arr) - 1
    while left <= right:
        mid = (left + right) / 2
        ..." class="code-input"></textarea>
                    </div>
                `;
                break;

            default:
                inputHTML = `<div class="drill-input"><textarea id="drill-answer" rows="6"></textarea></div>`;
        }

        return `
            <div class="drill-container ${drill.type}">
                <div class="drill-header">
                    <span class="drill-icon">${icon}</span>
                    <span class="drill-type">${drill.type}</span>
                    <span class="drill-skill">${skillName}</span>
                </div>
                ${inputHTML}
                <div class="drill-actions">
                    <button id="btn-submit" class="btn-primary">Submit Answer</button>
                    <button id="btn-skip" class="btn-secondary">Skip</button>
                </div>
            </div>
        `;
    }

    /**
     * Get user's answer from the input field.
     */
    function getUserAnswer(drillType) {
        const input = document.getElementById('drill-answer');
        return input ? input.value : '';
    }

    /**
     * Render result feedback.
     */
    function renderResult(result) {
        const statusClass = result.correct ? 'correct' : 'incorrect';
        const statusIcon = result.correct ? '✅' : '❌';

        return `
            <div class="drill-result ${statusClass}">
                <div class="result-icon">${statusIcon}</div>
                <div class="result-message">${result.correct ? 'Correct!' : 'Incorrect'}</div>
                <div class="result-feedback">${escapeHtml(result.feedback || '')}</div>
                <div class="result-actions">
                    <button id="btn-next" class="btn-primary">Next Drill</button>
                    <button id="btn-finish" class="btn-secondary">Finish Session</button>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS.
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Open drill page in new tab.
     */
    function openDrillPage(drillId) {
        const url = getDrillPageURL(drillId);
        window.open(url, '_blank');
    }

    return {
        getDrillFromURL,
        getDrillPageURL,
        getSkillDisplayName,
        getDrillTypeIcon,
        renderDrillContent,
        getUserAnswer,
        renderResult,
        openDrillPage,
        escapeHtml
    };
}));
