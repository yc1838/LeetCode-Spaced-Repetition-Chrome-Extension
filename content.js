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
    try {
        // Check if the message action is "scanPage"
        if (request.action === "scanPage") {
            const currentSlug = getCurrentProblemSlug();
            console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Manual scan requested for ${currentSlug}.`);

            if (!currentSlug) {
                sendResponse({ success: false, error: "Could not determine problem slug." });
                return false;
            }

            checkLatestSubmissionViaApi(currentSlug)
                .then(result => {
                    console.log("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Manual scan result:", result);
                    sendResponse(result);
                })
                .catch(err => {
                    console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Manual scan failed:", err);
                    sendResponse({ success: false, error: err.message });
                });
            return true; // CRITICAL: Required for async sendResponse
        }

        // Handle getDifficulty request from popup (for syncing stored data)
        if (request.action === "getDifficulty") {
            // Force refresh the cache first
            updateDifficultyCache();
            const difficulty = difficultyCache[getCurrentProblemSlug()] || 'Medium'; // fallback
            console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] getDifficulty requested, returning: ${difficulty}`);
            sendResponse({ difficulty: difficulty });
            return false; // Sync response - no need to keep channel open
        }
    } catch (e) {
        console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Error in message listener:", e);
        sendResponse({ success: false, error: e.message });
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
async function saveSubmission(problemTitle, problemSlug, difficulty, difficultySource = 'unknown', rating = null) {
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

    // Capture current time as Full ISO String (e.g. "2026-01-18T17:30:00.000Z")
    // This avoids "UTC Date vs Local Date" ambiguity that caused duplicate blocks.
    const now = new Date();
    const nowISO = now.toISOString();

    const problemKey = problemSlug;

    // Helper: Check if two dates are the same LOCALLY (ignoring time)
    // This ensures "Today" means "My Waking Day", not "UTC Day".
    const isSameLocalDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    // Debounce: Check if we ALREADY tracked this problem TODAY.
    let isDuplicateDay = false;

    if (problems[problemKey] && problems[problemKey].lastSolved) {
        const lastSolvedVal = problems[problemKey].lastSolved;
        let lastSolvedDate;

        // Handle Legacy (YYYY-MM-DD) vs New (ISO) formats
        if (lastSolvedVal.length === 10) {
            // Legacy: "2026-01-18" (UTC)
            // Treated as UTC Midnight. If user is in US (UTC-5), this is 7pm PREVIOUS DAY.
            // If they are solving it "Today" (Local), likely it won't match, allowing a fix-up review.
            lastSolvedDate = new Date(lastSolvedVal);
        } else {
            // ISO String
            lastSolvedDate = new Date(lastSolvedVal);
        }

        if (isSameLocalDay(lastSolvedDate, now)) {
            isDuplicateDay = true;
        }
    }

    if (isDuplicateDay) {
        if (problems[problemKey].difficulty === difficulty) {
            console.log("[LeetCode EasyRepeat] Already logged today. Skipping storage update to prevent dups.");
            return { duplicate: true, problemTitle: problemTitle };
        }

        // If we have a stored difficulty, and the new one is just a "fallback" default,
        // TRUST THE STORED DATA! Don't overwrite "Hard" with "Medium" just because we missed the badge.
        if (difficultySource === 'fallback' && problems[problemKey].difficulty) {
            console.log(`[LeetCode EasyRepeat] Difficulty mismatch (${problems[problemKey].difficulty} vs ${difficulty}), but new value is a fallback. Keeping stored value.`);
            difficulty = problems[problemKey].difficulty;
        } else {
            console.log(`[LeetCode EasyRepeat] Already logged today, but difficulty mismatch detected. Updating: ${problems[problemKey].difficulty} -> ${difficulty} (Source: ${difficultySource})`);
        }
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

    // CRITICAL: Always update difficulty from fresh detection (unless it's a weak fallback)
    if (currentProblem.difficulty !== difficulty) {
        if (difficultySource === 'fallback' && currentProblem.difficulty) {
            console.log(`[LeetCode EasyRepeat] Keeping existing difficulty ${currentProblem.difficulty} instead of fallback ${difficulty}`);
            difficulty = currentProblem.difficulty;
        } else {
            console.log(`[LeetCode EasyRepeat] Correcting difficulty: ${currentProblem.difficulty} → ${difficulty} (Source: ${difficultySource})`);
        }
    }

    // Use FSRS logic if rating is provided, otherwise fall back to SM-2
    let nextStep;

    // Check if fsrs is available (it should be since we added it to manifest)
    if (rating && typeof fsrs !== 'undefined') {
        console.log(`[LeetCode EasyRepeat] Using FSRS algorithm with rating: ${rating}`);

        // Prepare card object for FSRS
        // We need to map our storage format to what FSRS expects or keep them separate.
        // FSRS logic expects: { stability, difficulty, state, last_review }
        const card = {
            state: currentProblem.fsrs_state || (currentProblem.repetition > 0 ? 'Review' : 'New'),
            stability: currentProblem.fsrs_stability || 0,
            difficulty: currentProblem.fsrs_difficulty || 0,
            last_review: currentProblem.fsrs_last_review ? new Date(currentProblem.fsrs_last_review) : null
        };

        // Calculate elapsed days since last review
        let elapsed_days = 0;
        if (card.last_review) {
            const diffTime = Math.abs(now - card.last_review);
            elapsed_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const fsrsResult = fsrs.calculateFSRS(card, rating, elapsed_days);

        nextStep = {
            nextInterval: fsrsResult.nextInterval,
            nextRepetition: currentProblem.repetition + 1,
            nextEaseFactor: currentProblem.easeFactor, // Legacy field, keep it
            nextReviewDate: (() => {
                const date = new Date(now);
                date.setDate(date.getDate() + fsrsResult.nextInterval);
                return date.toISOString();
            })(),

            // FSRS specific fields to save
            fsrs_stability: fsrsResult.newStability,
            fsrs_difficulty: fsrsResult.newDifficulty,
            fsrs_state: fsrsResult.nextState,
            fsrs_last_review: nowISO
        };

    } else {
        // Legacy SM-2 Path (or if user closed modal without rating?)
        console.log(`[LeetCode EasyRepeat] Using Legacy SM-2 algorithm.`);
        nextStep = calculateNextReview(currentProblem.interval, currentProblem.repetition, currentProblem.easeFactor);
    }

    // Update the problem data with the new values
    problems[problemKey] = {
        ...currentProblem, // Keep existing fields
        difficulty: difficulty,
        lastSolved: nowISO,
        interval: nextStep.nextInterval,
        repetition: nextStep.nextRepetition,
        easeFactor: nextStep.nextEaseFactor,
        nextReviewDate: nextStep.nextReviewDate,

        // FSRS fields (only if they exist in nextStep)
        fsrs_stability: nextStep.fsrs_stability !== undefined ? nextStep.fsrs_stability : currentProblem.fsrs_stability,
        fsrs_difficulty: nextStep.fsrs_difficulty !== undefined ? nextStep.fsrs_difficulty : currentProblem.fsrs_difficulty,
        fsrs_state: nextStep.fsrs_state !== undefined ? nextStep.fsrs_state : currentProblem.fsrs_state,
        fsrs_last_review: nextStep.fsrs_last_review !== undefined ? nextStep.fsrs_last_review : currentProblem.fsrs_last_review,

        // Add history
        history: [...currentProblem.history, { date: nowISO, status: 'Accepted', rating: rating }]
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
let difficultyCache = {};       // Cache map: slug -> "Easy" | "Medium" | "Hard"
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
    // We track the current slug just for logging changes, 
    // but with a Map cache, we don't need to wipe data on navigation!
    const currentSlug = getCurrentProblemSlug();
    if (!currentSlug) return;

    if (currentSlug !== lastProblemSlug) {
        console.log(`[LeetCode EasyRepeat] Problem changed: ${lastProblemSlug || 'null'} → ${currentSlug}`);
        lastProblemSlug = currentSlug;
    }

    /**
     * CSS ATTRIBUTE SELECTOR:
     * div[class*="text-difficulty-"]
     */
    const difficultyNode = document.querySelector('div[class*="text-difficulty-"]');

    if (difficultyNode) {
        const text = difficultyNode.innerText.trim();
        if (['Easy', 'Medium', 'Hard'].includes(text)) {
            if (difficultyCache[currentSlug] !== text) {
                console.log(`[LeetCode EasyRepeat] Difficulty detected for ${currentSlug}: ${text}`);
            }
            difficultyCache[currentSlug] = text;
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
    let difficultySource = 'fallback';

    // 1. Try Cache First (Most reliable if we visited the page)
    if (difficultyCache[problemSlug]) {
        difficulty = difficultyCache[problemSlug];
        difficultySource = 'cache';
        console.log(`[LeetCode EasyRepeat] Using cached difficulty for ${problemSlug}: ${difficulty}`);
    }
    // 2. Try Live DOM (If cache missed)
    else {
        const difficultyNode = document.querySelector('div[class*="text-difficulty-"]');
        if (difficultyNode) {
            const text = difficultyNode.innerText.trim();
            if (['Easy', 'Medium', 'Hard'].includes(text)) {
                difficulty = text;
                difficultySource = 'dom';
                difficultyCache[problemSlug] = difficulty; // Update cache
                console.log(`[LeetCode EasyRepeat] Detected difficulty from DOM: ${difficulty}`);
            }
        }
    }

    return { title, slug: problemSlug, difficulty, difficultySource };
}

/**
 * Show a modal asking the user to rate the problem difficulty.
 * Returns a Promise that resolves to the rating (1-4).
 */
function showRatingModal(title) {
    return new Promise((resolve) => {
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'lc-srs-rating-backdrop';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 1000000;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(5px);
        `;

        // Create Modal content
        const modal = document.createElement('div');
        modal.className = 'lc-srs-rating-modal rating-modal'; // Added rating-modal for testing

        // Basic Theme Logic (Simplified, could use TOAST_THEMES)
        // Hardcoding a sleek look for now that should work with both themes
        modal.style.cssText = `
            background: #1a1a1a;
            border: 2px solid #00FF41; /* Matrix Green Default */
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 0 30px rgba(0, 255, 65, 0.2);
            font-family: 'JetBrains Mono', monospace;
            text-align: center;
            color: #fff;
            max-width: 500px;
            width: 90%;
            animation: lc-srs-popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        // Title
        const heading = document.createElement('h3');
        heading.innerText = "How was it?";
        heading.style.cssText = "margin: 0 0 10px 0; font-size: 20px; color: #00FF41;";

        const sub = document.createElement('p');
        sub.innerText = title;
        sub.style.cssText = "margin: 0 0 25px 0; opacity: 0.7; font-size: 14px;";

        // Button Container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = "display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;";

        const ratings = [
            { label: "Again", value: 1, color: "#FF3333", desc: "Forgot it" },
            { label: "Hard", value: 2, color: "#FFAA00", desc: "Struggled" },
            { label: "Good", value: 3, color: "#00CCFF", desc: "Recalled" },
            { label: "Easy", value: 4, color: "#00FF41", desc: "Trivial" }
        ];

        ratings.forEach(r => {
            const btn = document.createElement('button');
            btn.className = `rating-btn-${r.label.toLowerCase()}`; // For testing
            btn.innerHTML = `<div style='font-size:16px; font-weight:bold;'>${r.label}</div><div style='font-size:10px; opacity:0.8;'>${r.desc}</div>`;
            btn.style.cssText = `
                padding: 12px 20px;
                border: 2px solid ${r.color};
                background: rgba(0,0,0,0.3);
                color: ${r.color};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                font-family: inherit;
                min-width: 90px;
            `;

            // Hover effect
            btn.onmouseenter = () => {
                btn.style.background = r.color;
                btn.style.color = '#000';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(0,0,0,0.3)';
                btn.style.color = r.color;
            };

            btn.addEventListener('click', () => {
                backdrop.remove();
                resolve(r.value);
            });

            btnContainer.appendChild(btn);
        });

        // Add Keyframe animation for popIn
        const style = document.createElement('style');
        style.textContent = `
            @keyframes lc-srs-popIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        modal.appendChild(heading);
        modal.appendChild(sub);
        modal.appendChild(btnContainer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    });
}

/**
 * Check the latest submission via API for the manual "Scan Now" feature.
 * 
 * @param {string} slug - The problem slug (e.g. "two-sum")
 * @returns {Promise<Object>} The result object for the popup
 */
async function checkLatestSubmissionViaApi(slug) {
    try {
        // 1. Get recent submissions
        const response = await fetch(`/api/submissions/${slug}/?offset=0&limit=1`);
        if (!response.ok) throw new Error("API request failed");

        const data = await response.json();
        const submissions = data.submission_list || data.submissions_dump;
        const latestInfo = submissions && submissions[0];

        if (!latestInfo) {
            return { success: false, error: "No submissions found." };
        }

        // 2. Check if it is Accepted
        if (latestInfo.status_display === "Accepted") {
            const details = extractProblemDetails();
            // Prompt for rating manually too? Yes.
            const rating = await showRatingModal(details.title);
            const result = await saveSubmission(details.title, details.slug, details.difficulty, 'manual_api_scan', rating);
            return result || { success: true };
        }

        return { success: false, error: `Latest submission is ${latestInfo.status_display}`, status: latestInfo.status_display };

    } catch (e) {
        console.error("[LeetCode EasyRepeat] API check failed:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Verify if the latest submission in the table is "Accepted" AND "fresh" (e.g. "just now").
 * @returns {boolean} True if fresh accepted submission found
 */
/**
 * Monitor for clicks on the Submit button to trigger API polling.
 * 
 * THIS IS THE STARTING POINT OF THE AUTOMATION.
 * We listen for the user clicking the specific "Submit" button used by LeetCode.
 * When clicked, we record the CURRENT TIME so we know which submission to look for.
 */
function monitorSubmissionClicks() {
    // LeetCode's submit button usually has data-e2e-locator="console-submit-button"
    document.addEventListener('click', (e) => {
        try {
            const btn = e.target.closest('[data-e2e-locator="console-submit-button"]');
            if (btn) {
                console.log('[LeetCode EasyRepeat] [LEETCODE-DEBUG] Submit button clicked. Starting API poll...');
                const clickTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
                const slug = getCurrentProblemSlug();
                if (slug) {
                    // Determine difficulty before polling (from cache or DOM)
                    // We use our existing helpers for this
                    const details = extractProblemDetails();
                    pollSubmissionResult(slug, clickTime, details.title, details.difficulty)
                        .catch(err => console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Polling failed:", err));
                } else {
                    console.warn("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Could not determine slug on click.");
                }
            }
        } catch (err) {
            console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Error in click listener:", err);
        }
    });
}

// Start monitoring immediately
try {
    monitorSubmissionClicks();
} catch (e) {
    console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Failed to start click monitoring:", e);
}

/**
 * ============================================================================
 * LOGIC: API POLLING FOR SUBMISSION RESULT
 * ============================================================================
 * 
 * WHY WE DO THIS:
 * LeetCode's UI is dynamic and sometimes "truncates" the timestamp (e.g. showing "submitted at Jan..." instead of the full date).
 * This breaks our ability to read the screen and check if a submission is "fresh".
 * 
 * THE SOLUTION:
 * Instead of reading the screen (DOM scraping), we ask LeetCode's server directly!
 * 
 * HOW IT WORKS:
 * 1. User clicks "Submit".
 * 2. We wait a moment, then ask the server: "Show me the list of recent submissions".
 * 3. We find the one that matches our click time.
 * 4. We ask the server: "Is this submission finished processing? Was it Accepted?"
 * 5. If yes, we save it.
 */

/**
 * Poll the LeetCode API to find the result of the submission.
 * 
 * FLOW:
 * 1. GET /api/submissions/{slug}/?offset=0&limit=5 -> Returns a list of recent attempts.
 * 2. Find the attempt whose `timestamp` is close to our `clickTime`.
 * 3. Loop until we find it (it might take a second to appear).
 * 4. Once found, get its `id`.
 * 5. Pass that `id` to `checkSubmissionStatus` to see if it passed.
 */
async function pollSubmissionResult(slug, clickTime, title, difficulty) {
    try {
        console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Polling for ${slug} since ${clickTime}`);
        let attempts = 0;
        const maxAttempts = 20; // Try for ~40-60 seconds (backoff will increase delay)

        // Step 1: Find the Submission ID
        // We might need to wait a moment for the server to register the submission
        let submissionId = null;

        const findSubmission = async () => {
            try {
                // Fetch submission list
                // Note: LeetCode API returns JSON with submission_list array
                const response = await fetch(`/api/submissions/${slug}/?offset=0&limit=5`);
                if (!response.ok) {
                    console.warn(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] API error: ${response.status} ${response.statusText}`);
                    return null;
                }
                const data = await response.json();

                // Debugging: Check structure
                const submissions = data.submission_list || data.submissions_dump;

                // Debugging: Check structure
                if (!submissions) {
                    console.warn("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Unexpected API response format (missing list):", JSON.stringify(data).substring(0, 200));
                    return null; // Retry
                }

                // Look for a submission that happened AFTER our click (with 5s buffer for clock skew)
                // The API timestamp is in seconds.
                const match = submissions.find(sub =>
                    sub.timestamp >= (clickTime - 5) &&
                    sub.status_display !== "Internal Error" // Ignore failed system errors
                );

                return match ? match.id : null;
            } catch (e) {
                console.warn("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Error fetching submission list:", e);
                return null;
            }
        };

        // Retry loop to find the ID (it might take a few seconds to appear in the list)
        while (!submissionId && attempts < 10) {
            submissionId = await findSubmission();
            if (!submissionId) {
                console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Submission list check ${attempts + 1}/10...`);
                attempts++;
                await new Promise(r => setTimeout(r, 2000)); // Wait 2s
            }
        }

        if (!submissionId) {
            console.log("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Timed out waiting for submission to appear in list.");
            return;
        }

        console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Found submission ID: ${submissionId}. Polling status...`);

        // Step 2: Poll for Result (Accepted/Wrong Answer)
        await checkSubmissionStatus(submissionId, title, slug, difficulty);
    } catch (e) {
        console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Critical error in pollSubmissionResult:", e);
    }
}

async function checkSubmissionStatus(submissionId, title, slug, difficulty) {
    let checks = 0;
    while (checks < 20) {
        try {
            const res = await fetch(`/submissions/detail/${submissionId}/check/`);
            if (!res.ok) throw new Error("Check API failed");

            const data = await res.json();
            // data.state could be "PENDING", "STARTED", "SUCCESS"

            if (data.state === "SUCCESS") {
                // DONE! Check if Accepted
                if (data.status_code === 10 || data.status_msg === "Accepted") {
                    console.log(`[LeetCode EasyRepeat] Submission ${submissionId} ACCEPTED!`);

                    // We can also get runtime/memory here if we want!

                    const rating = await showRatingModal(title);

                    // saveSubmission handles storage
                    await saveSubmission(title, slug, difficulty, 'api_poll', rating);
                    return true;
                } else {
                    console.log(`[LeetCode EasyRepeat] Submission ${submissionId} finished but NOT Accepted (${data.status_msg}).`);
                    return false;
                }
            }

            // Still Pending
            checks++;
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s

        } catch (e) {
            console.warn("[LeetCode EasyRepeat] Error polling check API:", e);
            checks++;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    console.log("[LeetCode EasyRepeat] Timed out polling submission status.");
    return false;
}

// Export removed from here, consolidated at the end of file





// [Legacy Click Listener Removed]
// We now use monitorSubmissionClicks() defined earlier for API-based polling.

/**
 * CONDITIONAL EXPORT FOR TESTING
 * 
 * This code only runs in Node.js (during Jest tests), not in the browser.
 * 
 * HOW IT WORKS:
 * - In Node.js: `module` is a global object → condition is true → we export
 * - In Browser: `module` is undefined → condition is false → nothing happens
 */
// --- Exports for Node.js Testing ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveSubmission,
        checkLatestSubmissionViaApi,
        extractProblemDetails,
        pollSubmissionResult,       // New
        // New UI function
        showRatingModal,
        checkSubmissionStatus,      // New
        monitorSubmissionClicks     // New
    };
}
