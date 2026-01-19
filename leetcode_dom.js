/**
 * LeetCode EasyRepeat - DOM Interaction Layer
 * 
 * Handles reading from the LeetCode DOM to extract problem details.
 * Manages caching of difficulty which might disappear during dynamic navigation.
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

    // MODULE-LEVEL VARIABLES (encapsulated state)
    let difficultyCache = {};       // Cache map: slug -> "Easy" | "Medium" | "Hard"
    let lastProblemSlug = null;     // Track current problem to detect navigation

    /**
     * Extract the problem "slug" from the current URL.
     */
    function getCurrentProblemSlug() {
        if (typeof window === 'undefined' || !window.location) return null;
        const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Periodically scan the page for the difficulty badge and cache it.
     */
    function updateDifficultyCache() {
        const currentSlug = getCurrentProblemSlug();
        if (!currentSlug) return;

        if (currentSlug !== lastProblemSlug) {
            console.log(`[LeetCode EasyRepeat] Problem changed: ${lastProblemSlug || 'null'} → ${currentSlug}`);
            lastProblemSlug = currentSlug;
        }

        const difficultyNode = document.querySelector('div[class*="text-difficulty-"]');

        if (difficultyNode) {
            const text = difficultyNode.innerText.trim();
            if (['Easy', 'Medium', 'Hard'].includes(text)) {
                if (difficultyCache[currentSlug] !== text) {
                    // console.log(`[LeetCode EasyRepeat] Difficulty detected for ${currentSlug}: ${text}`);
                }
                difficultyCache[currentSlug] = text;
            }
        }
    }

    /**
     * Helper function to read the webpage and find the problem details (Title, Difficulty, ID)
     */
    function extractProblemDetails() {
        // Split the URL to find the problem ID (slug)
        const pathParts = window.location.pathname.split('/');
        let problemSlug = "unknown-problem";

        // Case 1: Standard problem page
        if (pathParts[1] === 'problems') {
            problemSlug = pathParts[2];
        }
        // Case 2: Submission details page (sometimes happen after submit)
        else if (document.referrer && document.referrer.includes('/problems/')) {
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

        // 1. Try Cache First
        if (difficultyCache[problemSlug]) {
            difficulty = difficultyCache[problemSlug];
            difficultySource = 'cache';
            console.log(`[LeetCode EasyRepeat] Using cached difficulty for ${problemSlug}: ${difficulty}`);
        }
        // 2. Try Live DOM
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
     * Initialize automatic difficulty tracking.
     */
    function startDifficultyTracking() {
        updateDifficultyCache();
        setInterval(updateDifficultyCache, 1000);
    }

    function getDifficultyFromCache(slug) {
        return difficultyCache[slug];
    }

    return {
        getCurrentProblemSlug,
        updateDifficultyCache,
        extractProblemDetails,
        startDifficultyTracking,
        getDifficultyFromCache
    };
}));
