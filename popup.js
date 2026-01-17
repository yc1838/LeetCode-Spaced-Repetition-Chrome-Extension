// LeetCode LeetCode EasyRepeat - Popup Script
// This script runs when you click the extension icon in the Chrome toolbar.
// It manages the little "Checkout" window (popup).

// Theme definitions
const THEMES = {
    sakura: {
        name: 'Sakura',
        terminal: '#FF10F0',
        electric: '#FF6B35',
        accent: '#FF85A2',
        borderGlow: 'rgba(255, 16, 240, 0.4)',
        borderDim: 'rgba(255, 107, 53, 0.25)',
        statusBg: 'rgba(255, 16, 240, 0.05)',
        hoverBg: 'rgba(255, 16, 240, 0.08)',
        containerShadow: 'rgba(255, 16, 240, 0.2)',
        cellColors: ['#661450', '#AA1177', '#FF10F0', '#FF6B35']
    },
    matrix: {
        name: 'Matrix',
        terminal: '#00FF41',
        electric: '#2DE2E6',
        accent: '#00FF41',
        borderGlow: 'rgba(0, 255, 65, 0.4)',
        borderDim: 'rgba(45, 226, 230, 0.2)',
        statusBg: 'rgba(0, 255, 65, 0.05)',
        hoverBg: 'rgba(0, 255, 65, 0.05)',
        containerShadow: 'rgba(0, 255, 65, 0.15)',
        cellColors: ['#00441b', '#006d2c', '#238b45', '#00FF41']
    }
};

let currentTheme = 'sakura';

// Wait for the HTML of the popup to fully load before running code.
document.addEventListener('DOMContentLoaded', async () => {
    // 0. Load and apply theme
    await setupTheme();
    // 1. Fetch data from storage and show the list of problems due for review.
    await updateDashboard();
    // 2. Enable Test Mode logic
    await setupTestMode();
    // 3. Enable sidebar tools
    setupManualTools();
});

// --- Theme Logic ---
async function setupTheme() {
    const storage = await chrome.storage.local.get({ theme: 'sakura' });
    currentTheme = storage.theme;
    applyTheme(currentTheme);

    // Theme toggle button
    document.getElementById('btn-theme').onclick = async () => {
        currentTheme = currentTheme === 'sakura' ? 'matrix' : 'sakura';
        applyTheme(currentTheme);
        await chrome.storage.local.set({ theme: currentTheme });
    };
}

function applyTheme(themeName) {
    const theme = THEMES[themeName];
    const root = document.documentElement;

    root.style.setProperty('--terminal', theme.terminal);
    root.style.setProperty('--electric', theme.electric);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--border-glow', theme.borderGlow);
    root.style.setProperty('--border-dim', theme.borderDim);

    // Update cell color variables for heatmap
    root.style.setProperty('--cell-1', theme.cellColors[0]);
    root.style.setProperty('--cell-2', theme.cellColors[1]);
    root.style.setProperty('--cell-3', theme.cellColors[2]);
    root.style.setProperty('--cell-4', theme.cellColors[3]);

    // Update dynamic elements
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) statusBar.style.background = theme.statusBg;

    const container = document.querySelector('.extension-container');
    if (container) container.style.boxShadow = `0 0 20px ${theme.containerShadow}`;

    // Re-render heatmap with new colors
    renderGlobalHeatmap();
}

// --- Dashboard Logic ---
// Reads the data and builds the UI.
async function updateDashboard() {
    // Fetch 'problems' object from storage
    const result = await chrome.storage.local.get({ problems: {} });
    // Convert object { "two-sum": {...}, "valid-anagram": {...} } into an array [ {...}, {...} ]
    const problems = Object.values(result.problems);

    const now = getCurrentDate();
    // Filter list: Which problems have a 'nextReviewDate' that is in the past (or now)?
    const dueProblems = problems.filter(p => new Date(p.nextReviewDate) <= now);

    // Sort Due Problems: Oldest due date first (Critical stuff top)
    dueProblems.sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate));

    // Sort All Problems: Most recently solved first (History order)
    problems.sort((a, b) => {
        const lastA = a.history[a.history.length - 1]; // Get last item in history array
        const lastB = b.history[b.history.length - 1];
        return new Date(lastB.date) - new Date(lastA.date);
    });

    // Update stats (Streak display requires history parsing, for now just show count or mock)
    // document.getElementById('streak-display').innerText = `STREAK: ${calculateStreak(problems)}`

    // Initial Render
    // 'dashboard' view = Due Problems
    renderVectors(dueProblems, 'vector-list', true);

    // Setup Sidebar Tabs
    setupSidebar(dueProblems, problems);

    // Global Heatmap (Decorative + Real)
    renderGlobalHeatmap();

    // Updates
    updateClock();
    setInterval(updateClock, 1000);

    // Sync difficulty for current problem (fixes stale data)
    await syncCurrentProblemDifficulty();
}

// Query the content script for the correct difficulty and update storage if needed
async function syncCurrentProblemDifficulty() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url.includes('leetcode.com/problems/')) return;

        // Extract slug from URL
        const match = tab.url.match(/\/problems\/([^\/]+)/);
        if (!match) return;
        const currentSlug = match[1];

        // Ask content script for current difficulty
        chrome.tabs.sendMessage(tab.id, { action: "getDifficulty" }, async (response) => {
            if (chrome.runtime.lastError || !response || !response.difficulty) return;

            const result = await chrome.storage.local.get({ problems: {} });
            const problems = result.problems;

            if (problems[currentSlug] && problems[currentSlug].difficulty !== response.difficulty) {
                console.log(`[Popup] Syncing difficulty for ${currentSlug}: ${problems[currentSlug].difficulty} → ${response.difficulty}`);
                problems[currentSlug].difficulty = response.difficulty;
                await chrome.storage.local.set({ problems });
                // Re-render with updated data
                await updateDashboard();
            }
        });
    } catch (e) {
        console.warn('[Popup] Could not sync difficulty:', e);
    }
}

function updateClock() {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0') + ':' +
        now.getSeconds().toString().padStart(2, '0');
    const el = document.getElementById('clock');
    if (el) el.innerText = time;
}

function setupSidebar(dueProblems, allProblems) {
    const tabDash = document.getElementById('tab-dashboard');
    const tabAll = document.getElementById('tab-all');
    const title = document.getElementById('queue-title');

    // Remove old active classes
    tabDash.classList.remove('active');
    tabAll.classList.remove('active');
    tabDash.classList.add('active'); // Default

    tabDash.onclick = () => {
        tabDash.classList.add('active');
        tabAll.classList.remove('active');
        title.innerText = "ACTIVE_PROBLEM_VECTORS";
        renderVectors(dueProblems, 'vector-list', true);
    };

    tabAll.onclick = () => {
        tabAll.classList.add('active');
        tabDash.classList.remove('active');
        title.innerText = "ALL_ARCHIVED_VECTORS";
        renderVectors(allProblems, 'vector-list', false);
    };
}

function renderVectors(problemList, containerId, isInteractive) {
    const container = document.getElementById(containerId);
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
        const diffStyle = `difficulty-${problem.difficulty.toLowerCase()}`;

        card.innerHTML = `
            <div class="vector-meta">
                <span>#${problem.slug}</span>
                <span>RETENTION: ${Math.min(100, Math.round(problem.easeFactor * 40))}%</span>
            </div>
            <div class="vector-title">${problem.title.toUpperCase()}</div>
            <div class="vector-stats">
                <span class="stat-tag ${diffStyle}">${problem.difficulty.toUpperCase()}</span>
                <span class="stat-tag">INT: ${interval}D</span>
                <span class="stat-tag">DUE: ${nextReview}</span>
            </div>
            <button class="tactical-btn">INITIALIZE_SEQUENCE</button>
            
            <div class="vector-details">
                ${ratingHtml}
                <div style="font-size:0.6rem; color:var(--electric); margin-bottom:4px;">PROJECTED_TIMELINE:</div>
                <div class="heatmap-grid" id="grid-${uniqueId}" style="grid-template-rows: repeat(3, 4px); gap:2px;"></div>
            </div>
        `;

        // Expand Handler
        card.onclick = (e) => {
            // Prevent button click from toggling
            if (e.target.classList.contains('rating-btn')) return;

            // Toggle
            card.classList.toggle('expanded');

            // Render Mini Heatmap on expand
            if (card.classList.contains('expanded')) {
                renderMiniHeatmap(problem, `grid-${uniqueId}`);
            }
        };

        // Rating Handlers
        if (isInteractive) {
            card.querySelectorAll('.rating-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation(); // Stop bubble so we don't toggle card immediately after click? (Actually card click checks target)
                    const slug = btn.getAttribute('data-id');
                    const ease = parseFloat(btn.getAttribute('data-ease'));
                    await updateProblemSRS(slug, ease);
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

    const today = getCurrentDate();
    const projectedDates = projectSchedule(problem.interval, problem.repetition, problem.easeFactor, today);
    const dateSet = new Set(projectedDates);

    // Generate ~60 days
    const start = new Date(today);
    // Align to something? Just standard 60 days

    for (let i = 0; i < 60; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dayStr = d.toISOString().split('T')[0];

        const cell = document.createElement('div');
        cell.className = 'cell';

        if (dateSet.has(dayStr)) cell.classList.add('v-4'); // High intensity for review
        else if (i === 0) cell.classList.add('v-3'); // Today

        // Random noise for "hacker" feel on empty days?
        // else if (Math.random() > 0.9) cell.classList.add('v-1'); 

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


// --- Manual Tools Logic ---
function setupManualTools() {
    // "Purge Memory" button
    document.getElementById('btn-purge').onclick = async () => {
        if (confirm("This will erase all your SRS progress. Are you sure?")) {
            // Preserve theme preference before clearing
            const savedTheme = currentTheme;
            await chrome.storage.local.clear();
            // Restore theme preference
            await chrome.storage.local.set({ theme: savedTheme });
            location.reload();
        }
    };

    // "Sync" button (Manual Scan)
    document.getElementById('btn-sync').onclick = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url.includes('leetcode.com')) {
            showNotification('error', 'INVALID_TARGET', 'Please navigate to a LeetCode problem page first.');
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
            if (chrome.runtime.lastError) {
                showNotification('error', 'CONNECTION_LOST', 'Could not connect to page. Please refresh the LeetCode tab and try again.');
            } else if (response && response.success) {
                window.close(); // Close popup, user will see toast on page
            } else if (response && response.duplicate) {
                showNotification('warning', 'DUPLICATE_DETECTED', `"${response.problemTitle}" was already logged today. Wait for its next review date.`);
            } else {
                showNotification('error', 'SCAN_FAILED', 'No "Accepted" submission found on this page. Make sure you have solved the problem.');
            }
        });
    };
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
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: ${style.bg};
        border: 1px solid ${style.border};
        padding: 12px;
        font-family: 'JetBrains Mono', monospace;
        z-index: 1000;
        animation: slideUp 0.2s ease;
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

// --- Test Mode Logic ---
let isTestMode = false;
let testDate = null;

async function setupTestMode() {
    const toggle = document.getElementById('test-mode-toggle');
    const dateInput = document.getElementById('test-mode-date');
    const controls = document.getElementById('sim-controls');

    // Load saved state
    const storage = await chrome.storage.local.get({ testMode: false, testDate: null });
    isTestMode = storage.testMode;
    testDate = storage.testDate;

    // Set initial UI state
    toggle.checked = isTestMode;
    dateInput.value = testDate || new Date().toISOString().split('T')[0];

    // Show/Hide controls based on mode
    controls.style.display = isTestMode ? 'block' : 'none';

    // Toggle Change Listener
    toggle.onchange = async () => {
        isTestMode = toggle.checked;
        controls.style.display = isTestMode ? 'block' : 'none'; // UI Update

        // If enabling and no date set, default to today
        if (isTestMode && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
            testDate = dateInput.value;
        }

        await chrome.storage.local.set({ testMode: isTestMode, testDate: dateInput.value });
        await updateDashboard();
    };

    // Date Change Listener
    dateInput.onchange = async () => {
        testDate = dateInput.value;
        await chrome.storage.local.set({ testDate: testDate });
        // Only refresh if test mode is actually on
        if (isTestMode) {
            await updateDashboard();
        }
    };
}

function getCurrentDate() {
    if (isTestMode && testDate) {
        const [year, month, day] = testDate.split('-').map(Number);
        return new Date(year, month - 1, day, 23, 59, 59);
    }
    return new Date();
}

// Function called when you click Hard/Med/Easy
async function updateProblemSRS(slug, ease) {
    const result = await chrome.storage.local.get({ problems: {} });
    const problems = result.problems;
    const p = problems[slug];

    if (!p) return;

    // Calculate next review based on the button clicked (ease)
    // Pass getCurrentDate() to handle Test Mode
    const nextStep = calculateNextReview(p.interval, p.repetition, ease, getCurrentDate());

    // Save update
    problems[slug] = {
        ...p,
        interval: nextStep.nextInterval,
        repetition: nextStep.nextRepetition,
        easeFactor: nextStep.nextEaseFactor,
        nextReviewDate: nextStep.nextReviewDate,
        // Log this review in history, using the (potentially mocked) current date
        history: [...p.history, { date: getCurrentDate().toISOString(), status: 'Reviewed' }]
    };

    await chrome.storage.local.set({ problems });
    // Re-render the dashboard to remove the item from the "Due" list
    await updateDashboard();
}
