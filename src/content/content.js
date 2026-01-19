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
            if (typeof updateDifficultyCache === 'function') updateDifficultyCache();

            let difficulty = 'Medium';
            if (typeof getDifficultyFromCache === 'function') {
                difficulty = getDifficultyFromCache(getCurrentProblemSlug()) || 'Medium';
            }

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
// saveSubmission moved to storage.js

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

// DOM logic moved to leetcode_dom.js (including difficultyCache)
// Initialize tracking
if (typeof startDifficultyTracking === 'function') {
    startDifficultyTracking();
}


// --- Robust Detection Logic ---

// Helper function to read the webpage and find the problem details (Title, Difficulty, ID)
// extractProblemDetails moved to leetcode_dom.js

/**
 * Show a modal asking the user to rate the problem difficulty.
 * Returns a Promise that resolves to the rating (1-4).
 */
// showRatingModal moved to content_ui.js

// Initialize submission monitoring (assuming monitorSubmissionClicks is globally available via leetcode_api.js)
if (typeof monitorSubmissionClicks === 'function') {
    try {
        monitorSubmissionClicks();
    } catch (e) {
        console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Failed to start click monitoring:", e);
    }
} else if (typeof global !== 'undefined' && global.monitorSubmissionClicks) {
    // Safe guard, though usually monitorSubmissionClicks is in global scope in Browser
    global.monitorSubmissionClicks();
}
// API logic moved to leetcode_api.js

/* --- Notes Feature Injection --- */
// Run periodically to handle navigation (mounting/unmounting of React components)
/* --- Notes Feature Injection --- */
// Run periodically to handle navigation (mounting/unmounting of React components)
setInterval(() => {
    if (typeof insertNotesButton === 'function') {
        // Collect dependencies from global scope (loaded by manifest)
        const deps = {
            getCurrentProblemSlug: (typeof getCurrentProblemSlug !== 'undefined') ? getCurrentProblemSlug : null,
            getNotes: (typeof getNotes !== 'undefined') ? getNotes : null,
            saveNotes: (typeof saveNotes !== 'undefined') ? saveNotes : null,
            extractProblemDetails: (typeof extractProblemDetails !== 'undefined') ? extractProblemDetails : null
        };
        insertNotesButton(deps);
    }
}, 2000);
