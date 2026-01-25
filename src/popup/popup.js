/**
 * LeetCode EasyRepeat - Popup Script
 * 
 * WHAT IS THE POPUP?
 * This script runs when you click the extension icon in the Chrome toolbar.
 * It creates and manages the small UI window that appears below the icon.
 * 
 * POPUP LIFECYCLE:
 * - Each time you click the icon, the popup is CREATED fresh
 * - When you click away, the popup is DESTROYED
 * - Unlike content scripts, the popup doesn't persist in the background
 * 
 * FILE DEPENDENCIES:
 * - popup.html: The HTML structure the popup displays
 * - popup.css: Styling for the popup
 * - srs_logic.js: Shared SRS algorithm functions
 */

/**
 * THEME CONFIGURATION OBJECT:
 * 
 * This object defines two visual themes: "sakura" (pink) and "matrix" (green).
 * Each theme contains color values that will be applied as CSS custom properties.
 * 
 * WHY OBJECTS FOR CONFIGURATION?
 * - Easy to add new themes (just add another key)
 * - All theme values in one place (maintainability)
 * - Can be loaded from storage or server in the future
 */
// THEMES is now loaded from configuration (config.js)

// MODULE-LEVEL STATE:
// Variables at the top level of a script persist for the popup's lifetime
let currentTheme = 'sakura';  // Default theme
let storageListenersReady = false;

/**
 * DOMContentLoaded EVENT:
 * 
 * This event fires when the HTML document has been completely parsed.
 * It does NOT wait for images, stylesheets, or subframes to finish loading.
 * 
 * WHY USE IT?
 * If you try to access DOM elements before the HTML parses, they won't exist yet!
 * DOMContentLoaded ensures the DOM is ready for our JavaScript to manipulate.
 * 
 * TIMING (from fastest to slowest):
 * 1. script executes (HTML might not be ready)
 * 2. DOMContentLoaded (HTML parsed, DOM ready)
 * 3. load (everything including images loaded)
 * 
 * ASYNC/AWAIT IN EVENT HANDLER:
 * The async keyword allows us to use await inside the handler.
 * This makes the code cleaner than chains of .then() callbacks.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 0. Load and apply theme from storage
    await setupTheme();

    // 0.5 Load and apply AI analysis toggle from storage
    await setupAiModeToggle();

    // 1. Fetch data from storage and show the list of problems due for review
    await updateDashboard();

    // 1.5 Live refresh when notes update in storage
    setupStorageListeners();

    // 2. Enable Test Mode logic (simulation date picker)
    await setupTestMode();

    // 3. Enable sidebar tools (Purge, Sync buttons)
    setupManualTools();
});

/**
 * Listen to storage changes and refresh the dashboard when problems update.
 */
function setupStorageListeners() {
    if (storageListenersReady) return;
    if (!chrome?.storage?.onChanged) return;
    storageListenersReady = true;

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        if (changes.problems) {
            void updateDashboard();
        }
    });
}

/**
 * ============================================================================
 * THEME SYSTEM
 * ============================================================================
 */

/**
 * Load theme preference from storage and set up the toggle button.
 */
async function setupTheme() {
    /**
     * CHROME.STORAGE.LOCAL.GET WITH DEFAULT:
     * { theme: 'sakura' } is the default value if 'theme' doesn't exist in storage.
     * This is cleaner than checking: if (storage.theme === undefined) {...}
     */
    const storage = await chrome.storage.local.get({ theme: 'sakura' });
    currentTheme = storage.theme;
    applyTheme(currentTheme);

    /**
     * ONCLICK HANDLER ASSIGNMENT:
     * element.onclick = function is an alternative to addEventListener.
     * Only ONE onclick handler can be set this way (it gets overwritten).
     * addEventListener allows multiple handlers for the same event.
     */
    document.getElementById('btn-theme').onclick = async () => {
        // TERNARY for toggle: if sakura -> matrix, else -> sakura
        currentTheme = currentTheme === 'sakura' ? 'matrix' : 'sakura';
        applyTheme(currentTheme);
        await chrome.storage.local.set({ theme: currentTheme });
    };
}

/**
 * Load AI analysis toggle state from storage and wire the button.
 */
async function setupAiModeToggle() {
    const btn = document.getElementById('ai-mode-toggle');
    if (!btn) return;

    const storage = await chrome.storage.local.get({ aiAnalysisEnabled: false });
    let enabled = !!storage.aiAnalysisEnabled;

    const render = () => {
        btn.textContent = enabled ? 'AI_MODE: ON' : 'AI_MODE: OFF';
        btn.classList.toggle('on', enabled);
    };

    render();

    btn.onclick = async () => {
        enabled = !enabled;
        render();
        await chrome.storage.local.set({ aiAnalysisEnabled: enabled });
    };
}

/**
 * Apply a theme by updating CSS custom properties.
 * 
 * CSS CUSTOM PROPERTIES (CSS Variables):
 * CSS variables are defined in CSS like: --variable-name: value;
 * They can be used anywhere with: var(--variable-name)
 * 
 * Changing them with JavaScript updates ALL elements using that variable!
 * This is how we implement instant theme switching without reloading CSS.
 * 
 * @param {string} themeName - 'sakura' or 'matrix'
 */
function applyTheme(themeName) {
    const theme = THEMES[themeName];

    /**
     * document.documentElement:
     * This is the <html> element - the root of the document.
     * CSS variables defined here cascade down to all elements.
     */
    const root = document.documentElement;

    /**
     * element.style.setProperty(name, value):
     * Sets a CSS custom property (variable) programmatically.
     * 
     * These update the :root CSS variables defined in popup.css.
     * All elements using var(--terminal), var(--electric), etc. will update!
     */
    root.style.setProperty('--terminal', theme.terminal);
    root.style.setProperty('--electric', theme.electric);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--border-glow', theme.borderGlow);
    root.style.setProperty('--border-dim', theme.borderDim);

    // Update heatmap cell colors (v-1, v-2, v-3, v-4 intensity levels)
    root.style.setProperty('--cell-1', theme.cellColors[0]);
    root.style.setProperty('--cell-2', theme.cellColors[1]);
    root.style.setProperty('--cell-3', theme.cellColors[2]);
    root.style.setProperty('--cell-4', theme.cellColors[3]);

    // Some elements need direct style updates (can't use CSS variables everywhere)
    root.style.setProperty('--hover-bg', theme.hoverBg);
    root.style.setProperty('--glass', theme.glass || 'rgba(20, 10, 15, 0.85)'); // Fallback

    const statusBar = document.querySelector('.status-bar');
    if (statusBar) statusBar.style.background = theme.statusBg;

    const container = document.querySelector('.extension-container');
    if (container) container.style.boxShadow = `0 0 20px ${theme.containerShadow}`;

    // Re-render heatmap with new colors (cells already use CSS variables)
    renderGlobalHeatmap();
}

/**
 * ============================================================================
 * DASHBOARD LOGIC - Main UI Rendering
 * ============================================================================
 */

/**
 * Fetch data from Chrome storage and render the dashboard.
 * This is called on popup open and after any data changes.
 */
async function updateDashboard() {
    // Fetch 'problems' object from storage
    const result = await chrome.storage.local.get({ problems: {} });

    /**
     * OBJECT.VALUES():
     * Converts an object's values into an array.
     * 
     * Input:  { "two-sum": {title: "Two Sum", ...}, "valid-anagram": {title: "Valid Anagram", ...} }
     * Output: [ {title: "Two Sum", ...}, {title: "Valid Anagram", ...} ]
     * 
     * Related methods:
     * - Object.keys(obj)    → ["two-sum", "valid-anagram"]  (keys as array)
     * - Object.entries(obj) → [["two-sum", {...}], [...]]   (key-value pairs)
     */
    const problems = Object.values(result.problems);

    const now = getCurrentDate();  // May be mocked for testing

    /**
     * ARRAY.FILTER():
     * Creates a NEW array containing only elements that pass the test.
     * 
     * problems.filter(p => ...)
     *   - p: each element (problem object)
     *   - Arrow function returns true/false
     *   - Only elements where function returns true are included
     * 
     * This finds problems whose review date has passed (they're "due").
     */
    const dueProblems = problems.filter(p => new Date(p.nextReviewDate) <= now);

    /**
     * ARRAY.SORT() - In-Place Sorting:
     * 
     * sort() modifies the original array (unlike filter which creates new).
     * It takes a "comparator" function that determines order.
     * 
     * HOW THE COMPARATOR WORKS:
     * compare(a, b) should return:
     *   - Negative number: a should come BEFORE b
     *   - Positive number:  a should come AFTER b
     *   - Zero:            order doesn't matter
     * 
     * For dates, subtracting them gives:
     *   earlierDate - laterDate = negative (earlier comes first)
     */
    dueProblems.sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate));

    // Sort All Problems: Sort exactly like dueProblems (Ascending Review Date)
    problems.sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate));

    // Update stats
    const streakEl = document.getElementById('streak-display');
    if (streakEl) {
        const count = await calculateStreakFn();
        streakEl.innerText = `STREAK: ${count}`;
    }

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
        if (!tab || !tab.url || !tab.url.includes('leetcode.com/problems/')) return;

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
    const dateStr = now.getFullYear() + '-' +
        (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
        now.getDate().toString().padStart(2, '0');
    const time = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0') + ':' +
        now.getSeconds().toString().padStart(2, '0');
    const el = document.getElementById('clock');
    if (el) el.innerText = `${dateStr} ${time}`;
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

// renderVectors moved to popup_ui.js

// Renders the mini projection grid inside a card
// renderMiniHeatmap moved to popup_ui.js

// renderGlobalHeatmap moved to popup_ui.js


// --- Manual Tools Logic ---
/**
 * Calculate Streak using Activity Log (Decoupled from Problems)
 * 
 * Logic:
 * 1. Load `activityLog` (Array of YYYY-MM-DD).
 * 2. If missing, auto-migrate from `problems` history.
 * 3. Calculate streak of consecutive days ending Today or Yesterday.
 */
async function calculateStreakFn() {
    const res = await chrome.storage.local.get({ problems: {}, activityLog: null });
    let log = res.activityLog;
    const problems = res.problems;

    // --- MIGRATION: Populate Activity Log from History if missing ---
    if (!log) {
        log = [];
        Object.values(problems).forEach(p => {
            if (p.history) {
                p.history.forEach(h => {
                    const dateObj = new Date(h.date);
                    const dateStr = dateObj.getFullYear() + '-' +
                        (dateObj.getMonth() + 1).toString().padStart(2, '0') + '-' +
                        dateObj.getDate().toString().padStart(2, '0');
                    if (!log.includes(dateStr)) log.push(dateStr);
                });
            }
        });
        log.sort();
        console.log("[Streak] Migrated history to Activity Log:", log);
        await chrome.storage.local.set({ activityLog: log });
    }

    console.log("[LeetCode EasyRepeat] DEBUG - Full Activity Log:", log);

    // --- CALCULATION ---
    let streak = 0;
    let checkDate = getCurrentDate(); // Handles Test Mode logic

    // Check backwards
    for (let i = 0; i < 3650; i++) {
        const checkStr = checkDate.getFullYear() + '-' +
            (checkDate.getMonth() + 1).toString().padStart(2, '0') + '-' +
            checkDate.getDate().toString().padStart(2, '0');

        if (log.includes(checkStr)) {
            streak++;
            // Move back 1 day
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Grace Period: If "Today" is missing, check Yesterday
            if (i === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            } else {
                break; // Streak broken
            }
        }
    }
    return streak;
}

// ... existing deleteProblem ...

// --- Manual Tools Logic ---
function setupManualTools() {
    // "Repair Streak" button
    const btnRepair = document.getElementById('btn-repair');
    if (btnRepair) {
        btnRepair.onclick = async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const defaultDate = yesterday.toISOString().split('T')[0];

            const input = prompt("Streak broken? Enter a date (YYYY-MM-DD) to mark as 'Active':", defaultDate);
            if (input) {
                // Basic Validation
                if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                    showNotification('error', 'INVALID_DATE', 'Format must be YYYY-MM-DD');
                    return;
                }

                // Call storage.js function
                if (typeof logActivity === 'function') {
                    await logActivity(input);
                    showNotification('success', 'STREAK_REPAIRED', `Activity logged for ${input}.`);
                    await updateDashboard(); // Refund UI
                } else {
                    showNotification('error', 'ERROR', 'Storage module not loaded.');
                }
            }
        };
    }

    // "Sync" button (Manual Scan)
    document.getElementById('btn-sync').onclick = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // CRITICAL: Strict check to ensure we are on a PROBLEM page.
        // Content script is ONLY injected on https://leetcode.com/problems/submissions/*
        if (!tab || !tab.url.includes('leetcode.com/problems/')) {
            showNotification('error', 'INVALID_TARGET', 'Please navigate to a specific LeetCode problem page (e.g. /problems/two-sum) first.');
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
            if (chrome.runtime.lastError) {
                const err = chrome.runtime.lastError.message || "Unknown runtime error";
                console.error("[Popup] Connection failed:", err);
                showNotification('error', 'CONNECTION_LOST', `Extension context lost (${err}). Please refresh the LeetCode page.`);
            } else if (response && response.success) {
                window.close(); // Close popup
            } else if (response && response.duplicate) {
                showNotification('warning', 'DUPLICATE_DETECTED', `"${response.problemTitle}" was already logged today.`);
            } else if (response && response.error) {
                showNotification('error', 'SCAN_ERROR', `Scan failed: ${response.error}`);
            } else {
                showNotification('error', 'SCAN_FAILED', 'No "Accepted" submission found on this page.');
            }
        });
    };
}

// showNotification moved to popup_ui.js

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
    if (toggle) toggle.checked = isTestMode;
    if (dateInput) dateInput.value = testDate || new Date().toISOString().split('T')[0];

    // Show/Hide controls based on mode
    if (controls) controls.style.display = isTestMode ? 'block' : 'none';

    // Toggle Change Listener
    if (toggle) {
        toggle.onchange = async () => {
            isTestMode = toggle.checked;
            if (controls) controls.style.display = isTestMode ? 'block' : 'none'; // UI Update

            // If enabling and no date set, default to today
            if (isTestMode && dateInput && !dateInput.value) {
                dateInput.value = new Date().toISOString().split('T')[0];
                testDate = dateInput.value;
            }

            await chrome.storage.local.set({ testMode: isTestMode, testDate: dateInput ? dateInput.value : null });
            await updateDashboard();
        };
    }

    // Date Change Listener
    if (dateInput) {
        dateInput.onchange = async () => {
            testDate = dateInput.value;
            await chrome.storage.local.set({ testDate: testDate });
            // Only refresh if test mode is actually on
            if (isTestMode) {
                await updateDashboard();
            }
        };
    }
}

function getCurrentDate() {
    // In Test Mode, use the selected date at 23:59:59
    if (isTestMode && testDate) {
        const [year, month, day] = testDate.split('-').map(Number);
        return new Date(year, month - 1, day, 23, 59, 59);
    }

    // In Normal Mode, ALSO use today at 23:59:59
    // This ensures that any Card due "Today" (even if due at 10pm and it's 9am)
    // shows up in the "Due" list. Standard SRS behavior: "Due" = "Due Today".
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now;
}

// Function called when you click Hard/Med/Easy
async function updateProblemSRS(slug, ease) {
    const result = await chrome.storage.local.get({ problems: {} });
    const problems = result.problems;
    const p = problems[slug];

    if (!p) return;

    let nextStep;
    const now = getCurrentDate(); // Handles Test Mode
    const nowISO = now.toISOString();

    // Determine FSRS Rating from legacy "ease" param
    // UI sends: Again (1.0), Hard (~1.3), Med (~2.5), Easy (~3.5)
    let rating = 3; // Default Good
    if (ease <= 1.1) rating = 1; // Again
    else if (ease < 2.0) rating = 2; // Hard
    else if (ease > 3.0) rating = 4; // Easy

    // Check if FSRS is available
    if (typeof fsrs !== 'undefined' && fsrs.calculateFSRS) {
        // Calculate elapsed days
        const lastReview = p.fsrs_last_review ? new Date(p.fsrs_last_review) : (p.lastSolved ? new Date(p.lastSolved) : new Date());
        let elapsed = Math.max(0, (now - lastReview) / (1000 * 60 * 60 * 24)); // Fractional days allowed in FSRS logic? Standard is integers usually, but float is fine for math.

        // FSRS Input Card
        const card = {
            state: p.fsrs_state || (p.repetition > 0 ? 'Review' : 'New'),
            stability: p.fsrs_stability || 0,
            difficulty: p.fsrs_difficulty || 0,
            last_review: lastReview
        };

        const res = fsrs.calculateFSRS(card, rating, elapsed);

        nextStep = {
            nextInterval: res.nextInterval,
            nextRepetition: p.repetition + 1,
            nextEaseFactor: p.easeFactor, // Legacy field upkeep
            nextReviewDate: (() => {
                const d = new Date(now);
                d.setDate(d.getDate() + res.nextInterval);
                return d.toISOString();
            })(),
            fsrs_stability: res.newStability,
            fsrs_difficulty: res.newDifficulty,
            fsrs_state: res.nextState,
            fsrs_last_review: nowISO
        };

    } else {
        // Fallback to SM-2
        if (typeof calculateNextReview !== 'function') {
            console.error("SRS Logic not loaded");
            return;
        }
        nextStep = calculateNextReview(p.interval, p.repetition, ease, now);
    }

    // Save update
    problems[slug] = {
        ...p,
        interval: nextStep.nextInterval,
        repetition: nextStep.nextRepetition,
        easeFactor: nextStep.nextEaseFactor,
        nextReviewDate: nextStep.nextReviewDate,
        fsrs_stability: nextStep.fsrs_stability,
        fsrs_difficulty: nextStep.fsrs_difficulty,
        fsrs_state: nextStep.fsrs_state,
        fsrs_last_review: nextStep.fsrs_last_review,
        // Log this review in history
        history: [...p.history, { date: nowISO, status: 'Reviewed', rating: rating }]
    };

    await chrome.storage.local.set({ problems });
    // Re-render the dashboard to remove the item from the "Due" list
    await updateDashboard();
}

/**
 * Delete a problem from storage.
 * @param {string} slug - The problem unique identifier
 */
async function deleteProblem(slug) {
    if (!confirm(`Are you sure you want to delete "${slug}" from your SRS history? This cannot be undone.`)) {
        return;
    }

    const result = await chrome.storage.local.get({ problems: {} });
    const problems = result.problems;

    if (problems[slug]) {
        delete problems[slug];
        await chrome.storage.local.set({ problems });
        await updateDashboard(); // Refresh UI
    }
}

// Make globally available for popup_ui.js
if (typeof window !== 'undefined') {
    window.deleteProblem = deleteProblem;
    // Also attach updateProblemSRS if not already
    window.updateProblemSRS = updateProblemSRS;
    window.getCurrentDate = getCurrentDate;
}

// Export for testing
// Export for testing initialization logic if needed
if (typeof module !== 'undefined') {
    module.exports = {
        updateDashboard,
        calculateStreak: calculateStreakFn,
        setupSidebar,
        setupAiModeToggle
    };
}
