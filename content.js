/**
 * LeetCode EasyRepeat - Content Script
 * 
 * WHAT IS A CONTENT SCRIPT?
 * In Chrome Extensions, a "content script" is JavaScript that runs IN THE CONTEXT
 * of a web page. Unlike the popup (which runs in its own window), this code can:
 * - Read and modify the page's DOM (document)
 * - React to page events (clicks, mutations)
 * - Communicate with the popup via Chrome's messaging API
 * 
 * WHEN DOES IT RUN?
 * This script runs automatically on every LeetCode problem page, as defined in
 * manifest.json under "content_scripts" -> "matches": ["https://leetcode.com/problems/*"]
 * 
 * RESPONSIBILITIES:
 * 1. Detecting when a user submits a solution
 * 2. Checking if that solution was "Accepted"
 * 3. Saving the result to browser storage for SRS tracking
 */
console.log("[LeetCode EasyRepeat] Extension content script loaded (v2 - Hybrid Detection).");

/**
 * ============================================================================
 * CHROME EXTENSION MESSAGE PASSING
 * ============================================================================
 * 
 * Chrome Extensions have separate "worlds" that can't directly call each other:
 * - Popup script (popup.js) - runs when you click the extension icon
 * - Content script (this file) - runs inside the web page
 * - Background script (not used here) - runs in the background
 * 
 * To communicate between them, we use Chrome's MESSAGE PASSING API.
 * 
 * HOW IT WORKS:
 * 1. Sender calls: chrome.tabs.sendMessage(tabId, {action: "scanPage"}, callback)
 * 2. Receiver (this script) handles it with: chrome.runtime.onMessage.addListener(...)
 * 3. Receiver can send back a response with: sendResponse({...})
 * 
 * THE LISTENER PATTERN:
 * chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {...})
 *   - request: The message object sent (e.g., {action: "scanPage"})
 *   - sender: Information about who sent the message
 *   - sendResponse: A function to send a reply back to the sender
 *   - Return true: Required if sendResponse will be called asynchronously
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if the message action is "scanPage"
    if (request.action === "scanPage") {
        console.log("[LeetCode EasyRepeat] Manual scan requested.");

        /**
         * ASYNC MESSAGE HANDLING:
         * Since checkForAcceptedStateAsync() is async (returns a Promise),
         * we need to return `true` from this listener to tell Chrome:
         * "Don't close the message channel yet, I'll send a response later!"
         */
        checkForAcceptedStateAsync().then(result => {
            sendResponse(result);
        });
        return true; // CRITICAL: Required for async sendResponse
    }

    // Handle getDifficulty request from popup (for syncing stored data)
    if (request.action === "getDifficulty") {
        // Force refresh the cache first
        updateDifficultyCache();
        const difficulty = cachedDifficulty || 'Medium';
        console.log(`[LeetCode EasyRepeat] getDifficulty requested, returning: ${difficulty}`);
        sendResponse({ difficulty: difficulty });
        return false; // Sync response - no need to keep channel open
    }
});

// --- SRS Logic ---
// Logic is now imported from srs_logic.js

/**
 * Save a successful submission to Chrome's local storage.
 * 
 * ASYNC FUNCTION:
 * The 'async' keyword means this function returns a Promise and can use 'await'.
 * Callers can use: await saveSubmission(...) or saveSubmission(...).then(...)
 * 
 * @param {string} problemTitle - Display name like "1. Two Sum"
 * @param {string} problemSlug - URL identifier like "two-sum"
 * @param {string} difficulty - "Easy", "Medium", or "Hard"
 */
async function saveSubmission(problemTitle, problemSlug, difficulty) {
    /**
     * OPTIONAL CHAINING (?.) - ES2020 FEATURE
     * 
     * The ?. operator is a safe way to access nested properties.
     * 
     * !chrome.runtime?.id is equivalent to:
     *   !(chrome.runtime && chrome.runtime.id)
     * 
     * If chrome.runtime is undefined, instead of throwing an error,
     * it returns undefined (which is falsy).
     * 
     * WHY DO WE CHECK THIS?
     * When a Chrome extension is updated or disabled while a page is open,
     * the content script becomes "orphaned" - it's still running but can't
     * talk to the extension anymore. chrome.runtime.id becomes undefined.
     */
    if (!chrome.runtime?.id) {
        console.warn("[LeetCode EasyRepeat] Extension context invalidated. Please refresh the page.");
        return;
    }

    console.log(`[LeetCode EasyRepeat] Handling submission for: ${problemTitle}`);

    let result;
    try {
        // Fetch existing data from Chrome's storage.
        // We ask for "problems". If it doesn't exist, we get an empty object {}.
        result = await chrome.storage.local.get({ problems: {} });
    } catch (err) {
        // Handle the specific error where the extension context is invalid (similar to the check above)
        if (err.message.includes("Extension context invalidated")) {
            console.warn("[LeetCode EasyRepeat] Context invalidated during storage access. Please refresh.");
            return;
        }
        // If it's some other error, we can't handle it, so we throw it to be seen in the console.
        throw err;
    }

    const problems = result.problems;

    // Get today's date in YYYY-MM-DD format (so we can compare dates easily)
    const today = new Date().toISOString().split('T')[0];

    // The "slug" is the unique part of the URL for the problem (e.g., "two-sum")
    const problemKey = problemSlug;

    // Debounce: Check if we ALREADY tracked this problem TODAY.
    // If we solve the same problem 5 times in a row today, we only want to update the SRS schedule ONCE.
    // BUT: If the difficulty stored is wrong (mismatch), we should update it!
    if (problems[problemKey] && problems[problemKey].lastSolved === today) {
        if (problems[problemKey].difficulty === difficulty) {
            console.log("[LeetCode EasyRepeat] Already logged today. Skipping storage update to prevent dups.");
            // Return duplicate status for manual scan response
            return { duplicate: true, problemTitle: problemTitle };
        }
        console.log(`[LeetCode EasyRepeat] Already logged today, but difficulty mismatch detected. Updating: ${problems[problemKey].difficulty} -> ${difficulty}`);
    }

    // Prepare the data object for this problem.
    // If it exists, use it. If not, create a new default object.
    const currentProblem = problems[problemKey] || {
        title: problemTitle,
        slug: problemSlug, // unique ID
        difficulty: difficulty,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        history: [] // We keep a list of past attempts
    };

    // CRITICAL: Always update difficulty from fresh detection (fix for wrong difficulty bug)
    if (currentProblem.difficulty !== difficulty) {
        console.log(`[LeetCode EasyRepeat] Correcting difficulty: ${currentProblem.difficulty} → ${difficulty}`);
    }

    // Calculate the new schedule based on current stats
    const nextStep = calculateNextReview(currentProblem.interval, currentProblem.repetition, currentProblem.easeFactor);

    // Update the problem data with the new values
    problems[problemKey] = {
        ...currentProblem, // Keep existing fields (like title, slug)
        difficulty: difficulty, // ⬅️ ALWAYS use freshly detected difficulty
        lastSolved: today, // Mark today as the last solved date
        interval: nextStep.nextInterval,
        repetition: nextStep.nextRepetition,
        easeFactor: nextStep.nextEaseFactor,
        nextReviewDate: nextStep.nextReviewDate,
        // Add specific history entry to the array
        history: [...currentProblem.history, { date: today, status: 'Accepted' }]
    };

    // Save the ENTIRE updated 'problems' object back to storage.
    await chrome.storage.local.set({ problems });
    console.log(`[LeetCode EasyRepeat] ✅ Saved to Chrome Storage!`);

    // Show the success notification on screen
    showCompletionToast(problemTitle, nextStep.nextReviewDate);

    return { success: true };
}

// Theme colors matching popup.js THEMES
const TOAST_THEMES = {
    sakura: {
        terminal: '#FF10F0',
        electric: '#FF6B35',
        borderGlow: 'rgba(255, 16, 240, 0.4)',
        shadowMid: 'rgba(255, 16, 240, 0.2)',
        shadowInner: 'rgba(255, 16, 240, 0.05)',
        textShadow: 'rgba(255, 16, 240, 0.5)',
        electricShadow: 'rgba(255, 107, 53, 0.4)',
        electricBorderDash: 'rgba(255, 107, 53, 0.3)'
    },
    matrix: {
        terminal: '#00FF41',
        electric: '#2DE2E6',
        borderGlow: 'rgba(0, 255, 65, 0.4)',
        shadowMid: 'rgba(0, 255, 65, 0.2)',
        shadowInner: 'rgba(0, 255, 65, 0.05)',
        textShadow: 'rgba(0, 255, 65, 0.5)',
        electricShadow: 'rgba(45, 226, 230, 0.4)',
        electricBorderDash: 'rgba(45, 226, 230, 0.3)'
    }
};

// Function to show a little popup notification (Toast) on the webpage itself
async function showCompletionToast(title, nextDate) {
    // If a toast already exists (maybe from a previous click), remove it so they don't stack up.
    const existing = document.querySelector('.lc-srs-toast');
    if (existing) existing.remove();

    // Also remove old styles to allow theme refresh
    const existingStyles = document.querySelector('#lc-srs-toast-styles');
    if (existingStyles) existingStyles.remove();

    // Get current theme from storage
    let themeName = 'sakura'; // default
    try {
        const storage = await chrome.storage.local.get({ theme: 'sakura' });
        themeName = storage.theme || 'sakura';
    } catch (e) {
        console.log('[LeetCode EasyRepeat] Could not read theme, using default');
    }
    const theme = TOAST_THEMES[themeName] || TOAST_THEMES.sakura;

    // Inject styles with dynamic theme colors
    const style = document.createElement('style');
    style.id = 'lc-srs-toast-styles';
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        
        .lc-srs-toast,
        .lc-srs-toast *,
        .lc-srs-toast *::before,
        .lc-srs-toast *::after {
            all: revert !important;
            box-sizing: border-box !important;
        }
        
        .lc-srs-toast {
            position: fixed !important;
            bottom: 30px !important;
            right: 30px !important;
            z-index: 999999 !important;
            opacity: 0 !important;
            transform: translateY(20px) !important;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
            pointer-events: none !important;
            border: none !important;
            background: none !important;
            outline: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 350px !important;
        }
        
        .lc-srs-toast.show {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
        
        .lc-srs-toast-content {
            background: rgba(10, 10, 10, 0.95) !important;
            border: 2px solid ${theme.terminal} !important;
            border-radius: 0 !important;
            box-shadow: 
                0 0 20px ${theme.borderGlow},
                0 0 40px ${theme.shadowMid},
                inset 0 0 30px ${theme.shadowInner} !important;
            backdrop-filter: blur(10px) !important;
            padding: 16px 20px !important;
            font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
            min-width: 280px !important;
            max-width: 350px !important;
            position: relative !important;
            overflow: hidden !important;
            outline: none !important;
            margin: 0 !important;
        }
        
        /* Scanline effect overlay */
        .lc-srs-toast-content::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
                rgba(18, 16, 16, 0) 50%, 
                rgba(0, 0, 0, 0.15) 50%
            );
            background-size: 100% 2px;
            pointer-events: none;
            opacity: 0.3;
        }
        
        /* Corner accent */
        .lc-srs-toast-content::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 6px;
            height: 6px;
            background: ${theme.terminal};
            box-shadow: 0 0 8px ${theme.terminal};
        }
        
        .lc-srs-toast-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .lc-srs-toast-icon {
            font-size: 16px;
            color: ${theme.terminal} !important;
            filter: drop-shadow(0 0 4px ${theme.terminal});
        }
        
        .lc-srs-toast-title {
            font-weight: 700;
            font-size: 13px;
            color: ${theme.terminal} !important;
            letter-spacing: 1px;
            text-transform: uppercase;
            text-shadow: 0 0 10px ${theme.textShadow};
        }
        
        .lc-srs-toast-problem {
            font-size: 14px;
            color: #ffffff !important;
            margin-bottom: 10px;
            padding-left: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 300px;
        }
        
        .lc-srs-toast-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: ${theme.electric} !important;
            letter-spacing: 0.5px;
            border-top: 1px dashed ${theme.electricBorderDash};
            padding-top: 10px;
            margin-top: 4px;
        }
        
        .lc-srs-toast-label {
            opacity: 0.7;
        }
        
        .lc-srs-toast-date {
            font-weight: 700;
            color: ${theme.electric} !important;
            text-shadow: 0 0 8px ${theme.electricShadow};
        }
    `;
    document.head.appendChild(style);

    const dateStr = new Date(nextDate).toLocaleDateString();

    // Create a new HTML element for the toast
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

    // Add it to the webpage body
    document.body.appendChild(toast);

    // Animation logic:
    // 1. Wait 100ms, then add 'show' class to trigger CSS fade-in
    setTimeout(() => {
        toast.classList.add('show');
        // 2. Wait 4 seconds, then remove 'show' class to trigger CSS fade-out
        setTimeout(() => {
            toast.classList.remove('show');
            // 3. Wait 500ms for fade-out to finish, then completely remove from the page (DOM)
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }, 100);
}

/**
 * ============================================================================
 * CACHING LOGIC FOR SPA (Single Page Application) NAVIGATION
 * ============================================================================
 * 
 * WHAT IS SPA NAVIGATION?
 * LeetCode is a Single Page Application - when you click from one problem to
 * another, the browser doesn't fully reload. Instead, JavaScript updates the
 * page content dynamically. This is faster for users but tricky for extensions.
 * 
 * THE PROBLEM:
 * When the user submits a solution, LeetCode shows the "Submission Result" view.
 * During this time, the difficulty badge might be REMOVED from the DOM!
 * If we don't cache it, we'd lose the difficulty info.
 * 
 * THE SOLUTION:
 * We periodically cache the difficulty while the user browses, BEFORE they submit.
 * Then when we need it during submission handling, we use the cached value.
 */

// MODULE-LEVEL VARIABLES (state that persists across function calls)
let cachedDifficulty = null;    // Cached difficulty: "Easy", "Medium", or "Hard"
let lastProblemSlug = null;     // Track current problem to detect navigation

/**
 * Extract the problem "slug" from the current URL.
 * 
 * REGULAR EXPRESSION EXPLAINED:
 * /\/problems\/([^\/]+)/
 *   \/problems\/  - Matches the literal string "/problems/"
 *   (           - Start of a "capture group" (what we want to extract)
 *   [^\/]+      - One or more characters that are NOT a forward slash
 *   )           - End of capture group
 * 
 * For URL "/problems/two-sum/description":
 *   match[0] = "/problems/two-sum" (full match)
 *   match[1] = "two-sum" (first capture group) <- This is what we want!
 * 
 * @returns {string|null} The problem slug or null if not on a problem page
 */
function getCurrentProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : null;  // Ternary: if match exists, return match[1], else null
}

/**
 * Periodically scan the page for the difficulty badge and cache it.
 * 
 * This runs every second (via setInterval) so we always have an up-to-date value.
 * It's a "cheap" operation because querySelector is fast.
 */
function updateDifficultyCache() {
    // DETECT SPA NAVIGATION:
    // If the slug changed, the user navigated to a different problem.
    // We must clear the cache so we don't use the OLD problem's difficulty!
    const currentSlug = getCurrentProblemSlug();
    if (currentSlug !== lastProblemSlug) {
        console.log(`[LeetCode EasyRepeat] Problem changed: ${lastProblemSlug} → ${currentSlug}`);
        cachedDifficulty = null; // Reset cache when problem changes!
        lastProblemSlug = currentSlug;
    }

    /**
     * CSS ATTRIBUTE SELECTOR:
     * div[class*="text-difficulty-"]
     *   div              - Select <div> elements
     *   [class*="..."]   - Where the class attribute CONTAINS this substring
     * 
     * This matches: <div class="text-difficulty-easy">
     * Also matches: <div class="foo text-difficulty-medium bar">
     * 
     * WHY NOT USE EXACT CLASS?
     * LeetCode might add/remove other classes, but "text-difficulty-" is stable.
     */
    const difficultyNode = document.querySelector('div[class*="text-difficulty-"]');

    if (difficultyNode) {
        // .trim() removes whitespace from both ends of the string
        const text = difficultyNode.innerText.trim();

        /**
         * ARRAY.INCLUDES() - Check if value is in array
         * ['Easy', 'Medium', 'Hard'].includes(text)
         * Equivalent to: text === 'Easy' || text === 'Medium' || text === 'Hard'
         * But cleaner and easier to extend!
         */
        if (['Easy', 'Medium', 'Hard'].includes(text)) {
            if (cachedDifficulty !== text) {
                console.log(`[LeetCode EasyRepeat] Difficulty detected: ${text}`);
            }
            cachedDifficulty = text;
        }
    }
}

// Run immediately on page load
updateDifficultyCache();

// Run this scan often (it's cheap)
setInterval(updateDifficultyCache, 1000);


// --- Robust Detection Logic ---

// Helper function to read the webpage and find the problem details (Title, Difficulty, ID)
function extractProblemDetails() {
    // Split the URL to find the problem ID (slug)
    const pathParts = window.location.pathname.split('/');
    let problemSlug = "unknown-problem";

    // Case 1: Standard problem page
    if (pathParts[1] === 'problems') {
        problemSlug = pathParts[2];
    }
    // Case 2: Submission details page (sometimes happen after submit)
    else if (document.referrer.includes('/problems/')) {
        // Look at where we came FROM (referrer)
        const refParts = new URL(document.referrer).pathname.split('/');
        problemSlug = refParts[2];
    }

    // Find the Title element on the page.
    const titleEl = document.querySelector('[data-cy="question-title"]') ||
        document.querySelector('span.text-lg.font-medium.text-label-1') ||
        document.querySelector('.mr-2.text-lg.font-medium');

    const title = titleEl ? titleEl.innerText : problemSlug.replace(/-/g, ' ');

    let difficulty = 'Medium'; // Default fallback

    // 1. Try Cache First (Best for post-submit)
    if (cachedDifficulty) {
        difficulty = cachedDifficulty;
        console.log(`[LeetCode EasyRepeat] Using cached difficulty: ${difficulty}`);
    }
    // 2. Try Live DOM (Best for initial load)
    else {
        const difficultyNode = document.querySelector('div[class*="text-difficulty-"]');
        if (difficultyNode) {
            const text = difficultyNode.innerText.trim();
            if (['Easy', 'Medium', 'Hard'].includes(text)) {
                difficulty = text;
                cachedDifficulty = difficulty; // Cache it for future
                console.log(`[LeetCode EasyRepeat] Detected difficulty from DOM: ${difficulty}`);
            }
        }
    }

    return { title, slug: problemSlug, difficulty };
}

/**
 * Async version of the "Accepted" detection - returns detailed response for popup.
 * 
 * This is used when the user clicks "Scan Now" in the popup.
 * We return an object describing what we found (for user feedback).
 */
async function checkForAcceptedStateAsync() {
    /**
     * COLOR DETECTION HELPER:
     * LeetCode shows "Accepted" in green. We need to check if a computed
     * CSS color is "greenish" to confirm we found the right element.
     * 
     * REGEX FOR RGB COLOR:
     * /rgb\((\d+),\s*(\d+),\s*(\d+)\)/
     *   rgb\(     - Matches "rgb(" (parenthesis is escaped with \)
     *   (\d+)     - Capture group: one or more digits (the red value)
     *   ,\s*      - Comma followed by optional whitespace
     *   (\d+)     - Capture group: digits (green value)
     *   ,\s*      - Comma + optional whitespace
     *   (\d+)     - Capture group: digits (blue value)
     *   \)        - Closing parenthesis
     * 
     * For "rgb(44, 187, 93)":
     *   match[0] = "rgb(44, 187, 93)" (full match)
     *   match[1] = "44" (R)
     *   match[2] = "187" (G)
     *   match[3] = "93" (B)
     * 
     * @param {string} color - A CSS color string like "rgb(44, 187, 93)"
     * @returns {boolean} True if the color looks "green"
     */
    const isGreen = (color) => {
        if (!color) return false;
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            /**
             * ARRAY DESTRUCTURING:
             * const [_, r, g, b] = match.map(Number);
             * 
             * match.map(Number) converts string matches to numbers:
             *   ["rgb(44, 187, 93)", "44", "187", "93"] → [NaN, 44, 187, 93]
             *   (The first element can't be parsed as a number)
             * 
             * Destructuring [_, r, g, b] assigns:
             *   _ = NaN (we ignore this with underscore convention)
             *   r = 44 (red)
             *   g = 187 (green)
             *   b = 93 (blue)
             */
            const [_, r, g, b] = match.map(Number);
            // Color is "green" if: green channel > 100 AND significantly larger than red
            return g > 100 && g > r * 1.5;
        }
        return false;
    };

    const specificSelectors = [
        '[data-e2e-locator="submission-result-accepted"]',
        '.text-green-s',
        '.text-success',
        '[class*="text-green"]'
    ];

    let foundNode = null;

    for (const selector of specificSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            if (el.innerText.includes('Accepted')) {
                foundNode = el;
                break;
            }
        }
        if (foundNode) break;
    }

    if (!foundNode) {
        const allSpans = document.getElementsByTagName('span');
        for (const span of allSpans) {
            if (span.innerText === 'Accepted') {
                const style = getComputedStyle(span);
                if (isGreen(style.color)) {
                    foundNode = span;
                    break;
                }
                const parentStyle = getComputedStyle(span.parentElement);
                if (isGreen(parentStyle.color)) {
                    foundNode = span;
                    break;
                }
            }
        }
    }

    if (foundNode) {
        console.log("[LeetCode EasyRepeat] Found 'Accepted' state via async scan.");
        const details = extractProblemDetails();
        const result = await saveSubmission(details.title, details.slug, details.difficulty);
        // result could be { success: true } or { duplicate: true, problemTitle: ... }
        return result || { success: true };
    }

    return { success: false }; // Nothing found
}

// The Core Check Function: "Did the user pass?" (Sync version for MutationObserver)
function checkForAcceptedState() {
    // 1. Look for the big "Accepted" text.
    // We try to find ANY element that contains "Accepted" and looks green.
    // This is more robust than relying on specific class names which change often.

    // Helper to check if a color is "green-ish"
    // rgb(44, 187, 93) or rgb(45, 181, 93) refer to standard LeetCode success greens.
    const isGreen = (color) => {
        if (!color) return false;
        // Parse rgb(r, g, b)
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const [_, r, g, b] = match.map(Number);
            // Green is dominant and significantly larger than Red
            return g > 100 && g > r * 1.5;
        }
        return false;
    };

    // Candidate elements: 
    // 1. Specific data attributes (most reliable if present)
    // 2. Classes with 'green' in them
    // 3. Any element with text "Accepted" (expensive, so we scope it if possible)

    // Strategy A: Specific Selectors
    const specificSelectors = [
        '[data-e2e-locator="submission-result-accepted"]',
        '.text-green-s',
        '.text-success',
        '[class*="text-green"]' // Catch-all for Tailwind-style green classes
    ];

    let foundNode = null;

    for (const selector of specificSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            if (el.innerText.includes('Accepted')) {
                foundNode = el;
                break;
            }
        }
        if (foundNode) break;
    }

    // Strategy B: Deep Search for exact "Accepted" text node with green style
    // This handles cases where the text is in a plain <span> inside a styled parent.
    if (!foundNode) {
        const allSpans = document.getElementsByTagName('span');
        for (const span of allSpans) {
            if (span.innerText === 'Accepted') {
                const style = getComputedStyle(span);
                if (isGreen(style.color)) {
                    foundNode = span;
                    break;
                }
                // Check parent's color if span is transparent/inherited
                const parentStyle = getComputedStyle(span.parentElement);
                if (isGreen(parentStyle.color)) {
                    foundNode = span;
                    break;
                }
            }
        }
    }

    // Validate result
    if (foundNode) {
        console.log("[LeetCode EasyRepeat] Found 'Accepted' state via selector/text scan.");
        // Get the details
        const details = extractProblemDetails();
        // Save it!
        saveSubmission(details.title, details.slug, details.difficulty);
        return true; // Return true to indicate success
    }

    return false; // Nothing found
}

/**
 * ============================================================================
 * DETECTION STRATEGY 1: MutationObserver (Passive Detection)
 * ============================================================================
 * 
 * WHAT IS MutationObserver?
 * MutationObserver is a browser API that lets you watch for changes to the DOM.
 * When elements are added, removed, or modified, your callback function runs.
 * 
 * WHY USE IT?
 * LeetCode dynamically updates the page when submission results come in.
 * We want to detect these updates and check if "Accepted" appeared.
 * 
 * ALTERNATIVE APPROACHES (less reliable):
 * - Polling (setInterval) - wastes CPU, might miss quick changes
 * - Event listeners - only work for specific events, not DOM changes
 * 
 * The callback receives an array of MutationRecord objects, but we don't
 * analyze them here - we just use it as a trigger to run our check.
 */
const observer = new MutationObserver((mutations) => {
    /**
     * DEBOUNCING:
     * When LeetCode updates the page, many mutations happen rapidly.
     * Without debouncing, checkForAcceptedState() might run 50+ times.
     * 
     * HOW IT WORKS:
     * 1. Mutation happens → set a 300ms timer to run the check
     * 2. Another mutation happens within 300ms → cancel old timer, set new one
     * 3. Repeat until mutations stop for 300ms
     * 4. Finally run the check once
     * 
     * USING WINDOW FOR STATE:
     * We store the timeout ID on `window._srsObsTimeout` so it persists
     * between calls and can be cleared on the next mutation.
     */
    if (window._srsObsTimeout) clearTimeout(window._srsObsTimeout);
    window._srsObsTimeout = setTimeout(() => {
        checkForAcceptedState();
    }, 300);
});

/**
 * STARTING THE OBSERVER:
 * 
 * observer.observe(target, options)
 *   - target: Which DOM node to watch (document.body = entire page)
 *   - options: What types of changes to observe:
 *     - childList: true - Watch for added/removed child elements
 *     - subtree: true - Also watch all descendants (not just direct children)
 *     - attributes: true (not used) - Watch for attribute changes
 *     - characterData: true (not used) - Watch for text content changes
 */
observer.observe(document.body, { childList: true, subtree: true });


/**
 * ============================================================================
 * DETECTION STRATEGY 2: Click Listener (Active Polling Detection)
 * ============================================================================
 * 
 * WHY HAVE TWO STRATEGIES?
 * MutationObserver is passive - it waits for DOM changes. But sometimes:
 * - Changes happen before our observer is fully set up
 * - LeetCode's update pattern doesn't trigger our observer reliably
 * 
 * This strategy ACTIVELY watches for the user clicking "Submit", then
 * starts polling to detect the result.
 */
document.addEventListener('click', (e) => {
    /**
     * DETECTING THE SUBMIT BUTTON:
     * LeetCode's button structure might vary, so we check multiple ways:
     * 
     * 1. innerText.includes('Submit') - Button text contains "Submit"
     * 2. data-cy="submit-code-btn" - Cypress test attribute (stable for testing)
     * 3. target.closest(...) - Check if click was inside a matching button
     * 
     * ELEMENT.CLOSEST(selector):
     * Walks up the DOM tree to find the first ancestor matching the selector.
     * Returns null if no match is found.
     * 
     * Useful because the click might be on a child element (like an icon or text)
     * inside the button, not the button itself.
     */
    const target = e.target;
    const isSubmitBtn = target.innerText.includes('Submit') ||
        target.getAttribute('data-cy') === 'submit-code-btn' ||
        target.closest('button[data-e2e-locator="console-submit-button"]');

    if (isSubmitBtn) {
        console.log("[LeetCode EasyRepeat] 'Submit' clicked. Starting aggressive polling...");
        startPolling();
    }
}, true);
/**
 * THE 'true' ARGUMENT - CAPTURE PHASE:
 * 
 * DOM events have 3 phases:
 * 1. CAPTURE: Event travels DOWN from document to target
 * 2. TARGET: Event reaches the clicked element
 * 3. BUBBLE: Event travels back UP to document
 * 
 * By default, addEventListener listens during BUBBLE phase.
 * Passing 'true' makes it listen during CAPTURE phase.
 * 
 * WHY USE CAPTURE?
 * If LeetCode calls event.stopPropagation() on their submit button,
 * the event would never bubble up to our listener. By capturing,
 * we see the event BEFORE LeetCode's handlers can stop it.
 */

let pollInterval;

// Function to check repeatedly every 500ms
function startPolling() {
    // Clear any existing poll to avoid duplicates
    if (pollInterval) clearInterval(pollInterval);

    let attempts = 0;
    pollInterval = setInterval(() => {
        attempts++;
        console.log(`[LeetCode EasyRepeat] Poll attempt ${attempts}...`);

        // Run the check
        const success = checkForAcceptedState();

        // STOP condition:
        // 1. We found the success state!
        // 2. OR we tried 40 times (20 seconds) and gave up.
        if (success || attempts >= 40) {
            clearInterval(pollInterval);
            if (success) console.log("[LeetCode EasyRepeat] Polling success!");
            else console.log("[LeetCode EasyRepeat] Polling timed out. No 'Accepted' found.");
        }
    }, 500);
}

/**
 * CONDITIONAL EXPORT FOR TESTING
 * 
 * This code only runs in Node.js (during Jest tests), not in the browser.
 * 
 * HOW IT WORKS:
 * - In Node.js: `module` is a global object → condition is true → we export
 * - In Browser: `module` is undefined → condition is false → nothing happens
 * 
 * WHY DO THIS?
 * Our tests need to import these functions using require().
 * But in the browser, we don't use module.exports (functions are just global).
 * This pattern makes the file work in BOTH environments.
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractProblemDetails,
        checkForAcceptedState,
        saveSubmission
    };
}
