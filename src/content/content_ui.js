/**
 * LeetCode EasyRepeat - Content UI Logic
 * 
 * Contains purely visual rendering functions for the content script (toasts, modals).
 * Separated from content.js to improve maintainability.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory();
    } else {
        // Browser
        const exported = factory();
        for (const key in exported) {
            root[key] = exported[key];
        }
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Helper to get theme safely
    function getTheme(themeName) {
        if (typeof TOAST_THEMES !== 'undefined') {
            return TOAST_THEMES[themeName] || TOAST_THEMES.sakura;
        }
        // Fallback if config.js not loaded for some reason
        return {
            terminal: '#FF10F0',
            electric: '#FF6B35',
            borderGlow: 'rgba(255, 16, 240, 0.4)',
            shadowMid: 'rgba(255, 16, 240, 0.2)',
            shadowInner: 'rgba(255, 16, 240, 0.05)',
            textShadow: 'rgba(255, 16, 240, 0.5)',
            electricShadow: 'rgba(255, 107, 53, 0.4)',
            electricBorderDash: 'rgba(255, 107, 53, 0.3)'
        };
    }

    /**
     * Show a custom Toast notification on the page.
     */
    async function showCompletionToast(title, nextDate) {
        const existing = document.querySelector('.lc-srs-toast');
        if (existing) existing.remove();

        const existingStyles = document.querySelector('#lc-srs-toast-styles');
        if (existingStyles) existingStyles.remove();

        let themeName = 'sakura';
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const storage = await chrome.storage.local.get({ theme: 'sakura' });
                themeName = storage.theme || 'sakura';
            }
        } catch (e) {
            console.log('[LeetCode EasyRepeat] Could not read theme, using default');
        }

        const theme = getTheme(themeName);

        const style = document.createElement('style');
        style.id = 'lc-srs-toast-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
            .lc-srs-toast, .lc-srs-toast * { all: revert !important; box-sizing: border-box !important; }
            .lc-srs-toast {
                position: fixed !important; bottom: 30px !important; right: 30px !important;
                z-index: 999999 !important; opacity: 0 !important; transform: translateY(20px) !important;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important; pointer-events: none !important;
            }
            .lc-srs-toast.show { opacity: 1 !important; transform: translateY(0) !important; }
            .lc-srs-toast-content {
                background: rgba(10, 10, 10, 0.95) !important;
                border: 2px solid ${theme.terminal} !important;
                box-shadow: 0 0 20px ${theme.borderGlow}, inset 0 0 30px ${theme.shadowInner} !important;
                backdrop-filter: blur(10px) !important; padding: 16px 20px !important;
                font-family: 'JetBrains Mono', monospace !important; min-width: 280px !important;
                max-width: 350px !important; position: relative !important; overflow: hidden !important;
            }
            .lc-srs-toast-content::before {
                content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%);
                background-size: 100% 2px; pointer-events: none; opacity: 0.3;
            }
            .lc-srs-toast-content::after {
                content: ""; position: absolute; top: 0; left: 0; width: 6px; height: 6px;
                background: ${theme.terminal}; box-shadow: 0 0 8px ${theme.terminal};
            }
            .lc-srs-toast-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
            .lc-srs-toast-icon { font-size: 16px; color: ${theme.terminal} !important; }
            .lc-srs-toast-title {
                font-weight: 700; font-size: 13px; color: ${theme.terminal} !important;
                text-transform: uppercase; text-shadow: 0 0 10px ${theme.textShadow};
            }
            .lc-srs-toast-problem {
                font-size: 14px; color: #ffffff !important; margin-bottom: 10px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;
            }
            .lc-srs-toast-meta {
                display: flex; justify-content: space-between; align-items: center; font-size: 11px;
                color: ${theme.electric} !important; border-top: 1px dashed ${theme.electricBorderDash};
                padding-top: 10px; margin-top: 4px;
            }
            .lc-srs-toast-date { font-weight: 700; color: ${theme.electric} !important; }
        `;
        document.head.appendChild(style);

        const dateStr = new Date(nextDate).toLocaleDateString();
        const toast = document.createElement('div');
        toast.className = 'lc-srs-toast';
        toast.innerHTML = `
            <div class="lc-srs-toast-content">
                <div class="lc-srs-toast-header">
                    <span class="lc-srs-toast-icon">✓</span>
                    <span class="lc-srs-toast-title">Vector Captured</span>
                </div>
                <div class="lc-srs-toast-problem">${title}</div>
                <div class="lc-srs-toast-meta">
                    <span class="lc-srs-toast-label">NEXT_REVIEW:</span>
                    <span class="lc-srs-toast-date">${dateStr}</span>
                </div>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        }, 100);
    }

    /**
     * Show a modal asking using FSRS ratings.
     */
    function showRatingModal(title) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'lc-rating-backdrop';

            const modal = document.createElement('div');
            modal.className = 'lc-rating-modal';

            // Header Container
            const header = document.createElement('div');
            header.className = 'lc-rating-header';

            const heading = document.createElement('h3');
            heading.innerText = "Difficulty Check"; // Toast like title
            header.appendChild(heading);

            const sub = document.createElement('div');
            sub.className = 'lc-rating-subtitle';
            sub.innerText = title;

            const btnContainer = document.createElement('div');
            btnContainer.className = 'lc-rating-btn-container';

            const ratings = [
                { label: "Again", value: 1, desc: "Forgot it" },
                { label: "Hard", value: 2, desc: "Struggled" },
                { label: "Good", value: 3, desc: "Recalled" },
                { label: "Easy", value: 4, desc: "Trivial" }
            ];

            ratings.forEach(r => {
                const btn = document.createElement('button');
                btn.className = `lc-rating-btn rating-btn-${r.label.toLowerCase()}`;

                // Construct button content
                const labelDiv = document.createElement('div');
                labelDiv.className = 'lc-rating-btn-label';
                labelDiv.innerText = r.label;

                const descDiv = document.createElement('div');
                descDiv.className = 'lc-rating-btn-desc';
                descDiv.innerText = r.desc;

                btn.appendChild(labelDiv);
                btn.appendChild(descDiv);

                btn.addEventListener('click', () => {
                    backdrop.remove();
                    resolve(r.value);
                });
                btnContainer.appendChild(btn);
            });

            modal.appendChild(header);
            modal.appendChild(sub);
            modal.appendChild(btnContainer);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);

            // Allow closing by clicking backdrop (optional safety, returning null/undefined)
            /*
            backdrop.onclick = (e) => {
                if (e.target === backdrop) {
                    backdrop.remove();
                    // resolve(null); // Or just close
                }
            };
            */
        });
    }

    /**
     * Inject the Notes button, handling SPA navigation updates.
     */
    function insertNotesButton(dependencies) {
        const { getCurrentProblemSlug, getNotes, saveNotes, extractProblemDetails } = dependencies || {};

        // 0. Safety Checks
        if (typeof getCurrentProblemSlug !== 'function' || typeof createNotesButton !== 'function') {
            return;
        }

        const slug = getCurrentProblemSlug();
        if (!slug) return;

        // 1. Duplication check with Slug Verification
        const existingBtn = document.querySelector('.lc-notes-btn');
        if (existingBtn) {
            if (existingBtn.dataset.slug === slug) {
                return; // Already exists for current problem
            } else {
                // Slug changed (user navigated)! Remove old button.
                console.log(`[LeetCode EasyRepeat] Slug changed (${existingBtn.dataset.slug} -> ${slug}). recreating button.`);
                existingBtn.remove();
            }
        }

        // 2. Direct Injection (Floating UI)
        console.log(`[LeetCode EasyRepeat] Injecting Floating Notes Button for ${slug}`);

        const btn = createNotesButton(slug, async () => {
            // Dependencies check inside click handler
            if (!getNotes || !saveNotes || !extractProblemDetails || !showNotesModal) {
                console.error("[LeetCode EasyRepeat] Modules not loaded fully.");
                return;
            }

            const notes = await getNotes(slug);
            const details = extractProblemDetails();
            showNotesModal(details.title, notes, async (newContent) => {
                await saveNotes(slug, newContent);
            });
        });

        document.body.appendChild(btn);
    }

    return {
        showCompletionToast,
        showRatingModal,
        createNotesButton,
        showNotesModal,
        insertNotesButton
    };
}));

/**
 * Create the "Notes" button to inject into the page.
 * @param {Function} onClick - Handler for click event
 * @returns {HTMLElement} The button element
 */
function createNotesButton(slug, onClick) {
    const btn = document.createElement('button');
    btn.className = 'lc-notes-btn';
    btn.dataset.slug = slug;
    btn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            Notes
        `;
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    };
    return btn;
}

/**
 * Show the Notes modal.
 * @param {string} title - Problem title
 * @param {string} initialContent - Existing notes
 * @param {Function} onSave - Callback(newContent)
 */
function showNotesModal(title, initialContent, onSave) {
    // Create elements
    const backdrop = document.createElement('div');
    backdrop.className = 'lc-notes-backdrop';

    const modal = document.createElement('div');
    modal.className = 'lc-notes-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'lc-notes-header';
    header.innerHTML = `
            <div class="lc-notes-title">
                <span>📝</span> ${title}
            </div>
            <button class="lc-notes-close">×</button>
        `;

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'lc-notes-textarea';
    textarea.placeholder = "Write your thoughts, approach, or key insights here...";
    textarea.value = initialContent || '';
    // Auto-focus logic
    setTimeout(() => textarea.focus(), 100);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'lc-notes-footer';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'lc-btn lc-btn-cancel';
    btnCancel.innerText = 'CMD+ENTER to Save';

    const btnSave = document.createElement('button');
    btnSave.className = 'lc-btn lc-btn-save';
    btnSave.innerText = 'SAVE NOTES';

    // Assembly
    footer.appendChild(btnCancel);
    footer.appendChild(btnSave);

    modal.appendChild(header);
    modal.appendChild(textarea);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Logic
    const close = () => {
        // Animation out could go here
        backdrop.remove();
    };

    const save = () => {
        const content = textarea.value;
        onSave(content);
        close();
    };

    header.querySelector('.lc-notes-close').onclick = close;
    btnCancel.onclick = close; // Or maybe cancel shouldn't save? Yes.
    btnSave.onclick = save;

    // Backdrop click close
    backdrop.onclick = (e) => {
        if (e.target === backdrop) close();
    };

    // Shortcuts
    textarea.onkeydown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            save();
        }
        if (e.key === 'Escape') {
            close();
        }
    };
}
