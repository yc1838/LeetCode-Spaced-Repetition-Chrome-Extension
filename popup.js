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

    // 1. Fetch data from storage and show the list of problems due for review
    await updateDashboard();

    // 2. Enable Test Mode logic (simulation date picker)
    await setupTestMode();

    // 3. Enable sidebar tools (Purge, Sync buttons)
    setupManualTools();
});

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
    if (streakEl) streakEl.innerText = `STREAK: ${calculateStreak(problems)}`;

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

        // CRITICAL: Strict check to ensure we are on a PROBLEM page.
        // Content script is ONLY injected on https://leetcode.com/problems/submissions/*
        if (!tab || !tab.url.includes('leetcode.com/problems/')) {
            showNotification('error', 'INVALID_TARGET', 'Please navigate to a specific LeetCode problem page (e.g. /problems/two-sum) first.');
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
            if (chrome.runtime.lastError) {
                // If we get here, the URL was correct but the content script isn't responding.
                // likely the user just navigated or the extension was reloaded.
                const err = chrome.runtime.lastError.message || "Unknown runtime error";
                console.error("[Popup] Connection failed:", err);
                showNotification('error', 'CONNECTION_LOST', `Extension context lost (${err}). Please refresh the LeetCode page.`);
            } else if (response && response.success) {
                window.close(); // Close popup, user will see toast on page
            } else if (response && response.duplicate) {
                showNotification('warning', 'DUPLICATE_DETECTED', `"${response.problemTitle}" was already logged today. Wait for its next review date.`);
            } else if (response && response.error) {
                showNotification('error', 'SCAN_ERROR', `Scan failed: ${response.error}`);
            } else {
                showNotification('error', 'SCAN_FAILED', 'No "Accepted" submission found on this page. Make sure you have solved the problem.');
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

/**
 * Calculate Streak
 * 
 * Logic:
 * - Collect all unique dates from history (converted to Local YYYY-MM-DD)
 * - Start from "Today" (getCurrentDate())
 * - If Today is present, add to streak, move to Yesterday
 * - If Today is MISSING, don't break yet (grace period), just move to Yesterday
 * - Continue backwards until a date is missing
 */
function calculateStreak(problems) {
    const activeDates = new Set();

    problems.forEach(p => {
        if (!p.history) return;
        p.history.forEach(h => {
            // Convert stored ISO string back to Local Date for consistency
            const dateObj = new Date(h.date);
            const dateStr = dateObj.getFullYear() + '-' +
                (dateObj.getMonth() + 1).toString().padStart(2, '0') + '-' +
                dateObj.getDate().toString().padStart(2, '0');
            activeDates.add(dateStr);
        });
    });

    let streak = 0;
    let checkDate = getCurrentDate();

    // Check backwards for up to 10 years (safety limit)
    for (let i = 0; i < 3650; i++) {
        const checkStr = checkDate.getFullYear() + '-' +
            (checkDate.getMonth() + 1).toString().padStart(2, '0') + '-' +
            checkDate.getDate().toString().padStart(2, '0');

        if (activeDates.has(checkStr)) {
            streak++;
            // Move back 1 day
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Grace Period: If we are checking "Today" (i===0) and it's missing, 
            // we assume the user just hasn't started YET. This doesn't break the streak.
            // We just check yesterday.
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
}

// Export for testing
// Export for testing initialization logic if needed
if (typeof module !== 'undefined') {
    module.exports = {
        updateDashboard,
        calculateStreak,
        setupSidebar
    };
}
