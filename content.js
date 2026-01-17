// LeetCode LeetCode EasyRepeat - Content Script
// This script runs on the LeetCode page itself. It is responsible for:
// 1. Detecting when a user submits a solution.
// 2. Checking if that solution was "Accepted".
// 3. Saving the result to the browser's storage so we can track it.
console.log("[LeetCode EasyRepeat] Extension content script loaded (v2 - Hybrid Detection).");

// --- Messaging with Popup ---
// This section listens for messages from the extension popup (the little window that opens when you click the extension icon).
// We need this because sometimes the automatic detection might fail, and the user wants to click "Scan Now" manually.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if the message action is "scanPage"
    if (request.action === "scanPage") {
        console.log("[LeetCode EasyRepeat] Manual scan requested.");
        // Run our check function immediately (async)
        checkForAcceptedStateAsync().then(result => {
            sendResponse(result);
        });
        return true; // Required for async sendResponse
    }

    // Handle getDifficulty request from popup (for syncing stored data)
    if (request.action === "getDifficulty") {
        // Force refresh the cache first
        updateDifficultyCache();
        const difficulty = cachedDifficulty || 'Medium';
        console.log(`[LeetCode EasyRepeat] getDifficulty requested, returning: ${difficulty}`);
        sendResponse({ difficulty: difficulty });
        return false; // Sync response
    }
});

// --- SRS Logic ---
// Logic is now imported from srs_logic.js

// This function actually saves the "Accepted" submission to the browser's local storage.
async function saveSubmission(problemTitle, problemSlug, difficulty) {
    // Safety Check: Sometimes if the extension updates in the background, the "connection" to the browser is lost.
    // We check if 'chrome.runtime.id' exists to make sure we are still connected.
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
    if (problems[problemKey] && problems[problemKey].lastSolved === today) {
        console.log("[LeetCode EasyRepeat] Already logged today. Skipping storage update to prevent dups.");
        // Return duplicate status for manual scan response
        return { duplicate: true, problemTitle: problemTitle };
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

// --- Robust Detection Logic ---

// --- Caching Logic ---
// We cache the difficulty because it might disappear from the DOM when the "Submission Result" view is active.
let cachedDifficulty = null;
let lastProblemSlug = null; // Track current problem to detect SPA navigation

// Get current problem slug from URL
function getCurrentProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : null;
}

// Periodically scan for the difficulty badge while the user is just browsing the problem.
function updateDifficultyCache() {
    // CRITICAL: Check if we navigated to a different problem (SPA navigation)
    const currentSlug = getCurrentProblemSlug();
    if (currentSlug !== lastProblemSlug) {
        console.log(`[LeetCode EasyRepeat] Problem changed: ${lastProblemSlug} → ${currentSlug}`);
        cachedDifficulty = null; // Reset cache when problem changes!
        lastProblemSlug = currentSlug;
    }

    // 2024 Stable Selector: div with class containing 'text-difficulty-'
    // This was verified to be robust for Easy/Medium/Hard.
    const difficultyNode = document.querySelector('div[class*="text-difficulty-"]');

    if (difficultyNode) {
        const text = difficultyNode.innerText.trim();
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

// Async version for manual scan - returns detailed response for popup
async function checkForAcceptedStateAsync() {
    // Use the same detection logic as the sync version
    const isGreen = (color) => {
        if (!color) return false;
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const [_, r, g, b] = match.map(Number);
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

// 1. MutationObserver (Legacy/Passive Detection)
// This code watches for ANY changes to the webpage (DOM mutations).
// If LeetCode updates the page content (e.g. showing results), this triggers.
const observer = new MutationObserver((mutations) => {
    // Debounce: We don't want to run the check 100 times per second if many things change at once.
    // We wait until changes stop for 300ms before running the check.
    if (window._srsObsTimeout) clearTimeout(window._srsObsTimeout);
    window._srsObsTimeout = setTimeout(() => {
        checkForAcceptedState();
    }, 300);
});

// Start observing the entire document body
observer.observe(document.body, { childList: true, subtree: true });


// 2. Click Listener on "Submit" (Active Polling Detection)
// Sometimes the Observer is too slow or misses the update.
// We also listen for when the user physically clicks the "Submit" button.
document.addEventListener('click', (e) => {
    // Check if clicked element (or its parent) looks like a Submit button
    const target = e.target;
    const isSubmitBtn = target.innerText.includes('Submit') ||
        target.getAttribute('data-cy') === 'submit-code-btn' ||
        target.closest('button[data-e2e-locator="console-submit-button"]');

    if (isSubmitBtn) {
        console.log("[LeetCode EasyRepeat] 'Submit' clicked. Starting aggressive polling...");
        // Start checking repeately
        startPolling();
    }
}, true); // 'true' means we capture this event early (Capture Phase)

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

// Export for testing if in Node environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractProblemDetails,
        checkForAcceptedState
    };
}
