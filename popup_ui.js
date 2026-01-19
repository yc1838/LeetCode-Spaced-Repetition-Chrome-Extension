/**
 * LeetCode EasyRepeat - Popup UI Logic
 * 
 * Contains purely visual rendering functions for the extension popup.
 * Separated from popup.js to improve maintainability.
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

    // --- Rendering Functions ---

    /**
     * Render the list of problem cards (vectors).
     * @param {Array} problemList - Array of problem objects
     * @param {string} containerId - Element ID to inject into
     * @param {boolean} isInteractive - True for "Due" list (shows buttons), False for "All"
     */
    function renderVectors(problemList, containerId, isInteractive) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (problemList.length === 0) {
            container.innerHTML = `<div style="padding:20px; text-align:center; color:#555; font-size:0.7rem;">NO_DATA_DETECTED // BUFFER_EMPTY</div>`;
            return;
        }

        problemList.forEach(problem => {
            const uniqueId = problem.slug; // Assuming unique
            const interval = problem.interval;
            const nextReview = new Date(problem.nextReviewDate).toLocaleDateString();

            const card = document.createElement('div');
            card.className = 'vector-card';

            // Buttons HTML (Hidden in details)
            const ratingHtml = isInteractive ? `
                <div class="rating-row">
                    <div class="rating-btn" style="border-color:#ff2a6d" data-id="${problem.slug}" data-ease="1.3">HARD</div>
                    <div class="rating-btn" style="border-color:#f1c40f" data-id="${problem.slug}" data-ease="2.5">MED</div>
                    <div class="rating-btn" style="border-color:#00FF41" data-id="${problem.slug}" data-ease="3.5">EASY</div>
                </div>
            ` : '';

            // Determine badge style
            const diffStyle = `difficulty-${(problem.difficulty || 'medium').toLowerCase()}`;

            card.innerHTML = `
                <div class="vector-meta">
                    <span>#${problem.slug}</span>
                    <span>RETENTION: ${Math.min(100, Math.round(problem.easeFactor * 40))}%</span>
                </div>
                <div class="vector-title">${problem.title.toUpperCase()}</div>
                <div class="vector-stats">
                    <span class="stat-tag ${diffStyle}">${(problem.difficulty || 'MEDIUM').toUpperCase()}</span>
                    <span class="stat-tag">INT: ${interval}D</span>
                    <span class="stat-tag">DUE: ${nextReview}</span>
                    <button class="go-btn" data-slug="${problem.slug}">GO</button>
                </div>
                <button class="tactical-btn">INITIALIZE_SEQUENCE</button>
                
                <div class="vector-details">
                    ${ratingHtml}
                    <div class="mini-heatmap-label">PROJECTED_TIMELINE:</div>
                    <div class="heatmap-grid mini-heatmap" id="grid-${uniqueId}"></div>
                </div>
            `;

            // Expand Handler
            card.onclick = (e) => {
                // Prevent button click from toggling
                if (e.target.classList.contains('rating-btn')) return;
                if (e.target.classList.contains('go-btn')) return;

                // Toggle
                card.classList.toggle('expanded');

                // Render Mini Heatmap on expand
                if (card.classList.contains('expanded')) {
                    renderMiniHeatmap(problem, `grid-${uniqueId}`);
                }
            };

            // GO Button Handler
            const goBtn = card.querySelector('.go-btn');
            if (goBtn) {
                goBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                        chrome.tabs.create({ url: `https://leetcode.com/problems/${problem.slug}/` });
                    }
                };
            }

            // Rating Handlers
            if (isInteractive) {
                card.querySelectorAll('.rating-btn').forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation(); // Stop bubble 
                        const slug = btn.getAttribute('data-id');
                        const ease = parseFloat(btn.getAttribute('data-ease'));
                        // Check if updateProblemSRS is available (it should be global)
                        if (typeof updateProblemSRS === 'function') {
                            await updateProblemSRS(slug, ease);
                        } else {
                            console.error("updateProblemSRS is not defined");
                        }
                    };
                });
            }

            container.appendChild(card);
        });
    }

    // Renders the mini projection grid inside a card
    function renderMiniHeatmap(problem, gridId) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.innerHTML = '';

        // Expect getCurrentDate and projectSchedule to be global
        const today = (typeof getCurrentDate === 'function') ? getCurrentDate() : new Date();
        const projectedDates = (typeof projectSchedule === 'function')
            ? projectSchedule(problem.interval, problem.repetition, problem.easeFactor, today)
            : [];

        const dateSet = new Set(projectedDates);

        // Generate ~60 days
        const start = new Date(today);

        // Date formatter for tooltips: "Mon, Jan 15"
        const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        for (let i = 0; i < 60; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dayStr = d.toISOString().split('T')[0];

            const cell = document.createElement('div');
            cell.className = 'cell';

            // JS Tooltip Logic
            const dateText = formatter.format(d);
            cell.onmouseenter = (e) => {
                const tooltip = document.getElementById('global-tooltip');
                if (!tooltip) return;

                tooltip.textContent = dateText;
                tooltip.classList.add('visible');

                // Position calculation
                const rect = cell.getBoundingClientRect();
                // Center horizontally, position above
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top}px`;
            };

            cell.onmouseleave = () => {
                const tooltip = document.getElementById('global-tooltip');
                if (tooltip) tooltip.classList.remove('visible');
            };

            if (dateSet.has(dayStr)) cell.classList.add('v-4'); // High intensity for review
            else if (i === 0) cell.classList.add('v-3'); // Today

            grid.appendChild(cell);
        }
    }

    // Renders the top decorative heatmap
    function renderGlobalHeatmap() {
        const grid = document.getElementById('global-heatmap');
        if (!grid) return;
        grid.innerHTML = '';

        // random decorative data for "Vibes"
        for (let i = 0; i < 140; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const rand = Math.random();
            // Weighted towards empty/low
            if (rand > 0.95) cell.classList.add('v-4');
            else if (rand > 0.85) cell.classList.add('v-3');
            else if (rand > 0.70) cell.classList.add('v-2');
            else if (rand > 0.50) cell.classList.add('v-1');
            grid.appendChild(cell);
        }
    }

    // --- Styled Notification Function ---
    function showNotification(type, code, message) {
        // Remove any existing notification
        const existing = document.querySelector('.srs-notification');
        if (existing) existing.remove();

        const colors = {
            error: { border: '#ff2a6d', bg: 'rgba(255, 42, 109, 0.1)', icon: '✕' },
            warning: { border: '#f1c40f', bg: 'rgba(241, 196, 15, 0.1)', icon: '⚠' },
            info: { border: '#2DE2E6', bg: 'rgba(45, 226, 230, 0.1)', icon: 'ℹ' }
        };
        const style = colors[type] || colors.info;

        const notification = document.createElement('div');
        notification.className = 'srs-notification';
        notification.innerHTML = `
            <div class="notif-header">
                <span class="notif-icon">${style.icon}</span>
                <span class="notif-code">[${code}]</span>
            </div>
            <div class="notif-message">${message}</div>
            <button class="notif-close">DISMISS</button>
        `;

        // Apply inline styles (since we can't easily add to popup.css dynamically)
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #111;
            border: 2px solid ${style.border};
            padding: 16px 24px;
            font-family: 'JetBrains Mono', monospace;
            z-index: 1000;
            animation: slideUp 0.2s ease;
            box-shadow: 0 0 20px ${style.bg}, 0 0 0 1000px rgba(0,0,0,0.5);
            min-width: 300px;
            max-width: 80%;
            text-align: center;
        `;

        notification.querySelector('.notif-header').style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 11px;
            color: ${style.border};
        `;

        notification.querySelector('.notif-icon').style.cssText = `font-size: 14px;`;
        notification.querySelector('.notif-code').style.cssText = `letter-spacing: 1px;`;

        notification.querySelector('.notif-message').style.cssText = `
            font-size: 12px;
            color: #fff;
            margin-bottom: 10px;
            line-height: 1.4;
        `;

        notification.querySelector('.notif-close').style.cssText = `
            background: transparent;
            border: 1px solid ${style.border};
            color: ${style.border};
            font-family: inherit;
            font-size: 10px;
            padding: 6px 12px;
            cursor: pointer;
            width: 100%;
        `;

        notification.querySelector('.notif-close').onclick = () => notification.remove();

        document.body.appendChild(notification);

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 8000);
    }

    return {
        renderVectors,
        renderMiniHeatmap,
        renderGlobalHeatmap,
        showNotification
    };
}));
