/**
 * Shared SRS (Spaced Repetition System) Logic
 * 
 * WHAT IS SRS?
 * Spaced Repetition is a learning technique where you review information at increasing
 * intervals. The idea is: the better you know something, the less often you need to review it.
 * This is based on the "forgetting curve" - we forget things over time unless we reinforce them.
 * 
 * This file implements a simplified version of the SM-2 algorithm (SuperMemo 2),
 * originally developed by Piotr Wozniak in 1987. It's the same algorithm used by
 * popular apps like Anki.
 * 
 * KEY CONCEPTS:
 * - Interval: Days until your next review (starts at 1, grows over time)
 * - Repetition: How many times you've successfully reviewed this item
 * - Ease Factor: A multiplier (default 2.5) that affects how fast intervals grow
 */

/**
 * UMD (Universal Module Definition) Pattern
 * 
 * PROBLEM: JavaScript code can run in different environments:
 *   1. Browser - uses <script> tags, variables are global on `window`
 *   2. Node.js - uses require() and module.exports (CommonJS)
 *   3. ES Modules - uses import/export (not covered here)
 * 
 * SOLUTION: UMD wraps code so it works in BOTH environments automatically.
 * 
 * HOW IT WORKS:
 * This is an IIFE (Immediately Invoked Function Expression) - a function that
 * runs immediately when the file loads. The pattern is: (function() { ... })()
 * 
 * The outer function takes two arguments:
 *   1. `root` - The global object (window in browser, global in Node)
 *   2. `factory` - A function that creates and returns our actual code
 * 
 * Inside, it checks which environment we're in and exports accordingly.
 */
(function (root, factory) {
    // Check if we're in Node.js/CommonJS environment
    // In Node.js, `module` is a special object and `module.exports` is how you export things
    if (typeof module === 'object' && module.exports) {
        // Node.js / CommonJS - Export using module.exports
        // This allows: const { calculateNextReview } = require('./srs_logic');
        module.exports = factory();
    } else {
        // Browser environment - Attach to global object (usually `window`)
        // `factory()` returns an object like { calculateNextReview, projectSchedule }
        // We loop through and attach each function to the global scope
        const exported = factory();
        for (const key in exported) {
            root[key] = exported[key];  // e.g., window.calculateNextReview = ...
        }
    }
    // The second argument determines what `root` is:
    // - `self` exists in browsers and Web Workers
    // - `this` is a fallback (global object in non-strict mode)
}(typeof self !== 'undefined' ? self : this, function () {

    /**
     * Calculate when the next review should happen based on SM-2 algorithm.
     * 
     * THE SM-2 ALGORITHM (Simplified):
     * - First time seeing this? Review again in 1 day.
     * - Second time? Review in 6 days.
     * - After that? Multiply current interval by ease factor (e.g., 6 * 2.5 = 15 days)
     * 
     * @param {number} interval - Current interval in days (default: 0 for new items)
     * @param {number} repetition - How many times successfully reviewed (default: 0)
     * @param {number} easeFactor - Multiplier for interval growth (default: 2.5)
     *                              Higher = faster growth, Lower = more frequent reviews
     * @param {string|Date|null} currentDate - Override "today" for testing (default: now)
     * 
     * @returns {Object} Contains:
     *   - nextInterval: Days until next review
     *   - nextRepetition: Updated repetition count
     *   - nextEaseFactor: (Currently unchanged, but could adjust based on performance)
     *   - nextReviewDate: ISO string of when to review next
     * 
     * DEFAULT PARAMETERS (ES6 feature):
     * `interval = 0` means if no value is passed, use 0.
     * This is cleaner than: interval = interval || 0;
     */
    function calculateNextReview(interval = 0, repetition = 0, easeFactor = 2.5, currentDate = null) {
        let nextInterval;

        // SM-2 interval progression:
        if (repetition === 0) {
            // First successful review: wait 1 day
            nextInterval = 1;
        } else if (repetition === 1) {
            // Second successful review: wait 6 days
            nextInterval = 6;
        } else {
            // 3rd+ review: multiply previous interval by ease factor
            // Math.round() ensures we get whole days (e.g., 37.5 → 38)
            nextInterval = Math.round(interval * easeFactor);
            // SAFETY CHECK: Ensure interval always grows or stays at least 1 day to prevent infinite loops
            if (nextInterval < 1) nextInterval = 1;
        }

        // DATE MANIPULATION:
        // Create a new Date object - either from provided date or current time
        // new Date(string) parses ISO format like "2024-01-15T12:00:00.000Z"
        // new Date() with no arguments = current date/time
        const nextDate = currentDate ? new Date(currentDate) : new Date();

        // setDate() modifies the day-of-month of this Date object
        // getDate() returns current day (1-31)
        // Adding nextInterval gives us the review date
        // JavaScript handles month/year rollover automatically!
        // e.g., Jan 30 + 5 days = Feb 4
        nextDate.setDate(nextDate.getDate() + nextInterval);

        // SHORTHAND PROPERTY NAMES (ES6):
        // { nextInterval } is shorthand for { nextInterval: nextInterval }
        // When key name matches variable name, you can omit the colon and value
        return {
            nextInterval,
            nextRepetition: repetition + 1,
            nextEaseFactor: easeFactor,
            // toISOString() returns format: "2024-01-15T12:00:00.000Z"
            // This is standardized and easily parseable across systems
            nextReviewDate: nextDate.toISOString()
        };
    }

    /**
     * Project/simulate future review dates for visual timeline display.
     * 
     * This function answers: "If I keep reviewing this item successfully,
     * when will my next few reviews be?"
     * 
     * Used to render the mini-heatmap showing upcoming review dates.
     * 
     * @param {number} interval - Current interval in days
     * @param {number} repetition - Current repetition count
     * @param {number} easeFactor - Current ease factor
     * @param {string|Date} currentDate - Start date for simulation
     * 
     * @returns {string[]} Array of date strings in "YYYY-MM-DD" format
     */
    function projectSchedule(interval, repetition, easeFactor, currentDate) {
        const schedule = [];

        // Local variables to track state during simulation
        let currentInterval = interval;
        let currentRepetition = repetition;
        let currentEase = easeFactor;

        // TERNARY OPERATOR:
        let simDate = currentDate ? new Date(currentDate) : new Date();

        // Calculate 90-day boundary for simulation
        const limitDate = new Date(simDate);
        limitDate.setDate(limitDate.getDate() + 90);

        // WHILE LOOP: Keep simulating until we exceed 90-day window
        while (simDate < limitDate) {
            // Simulate what happens when user reviews on simDate
            // We assume user always rates "Medium" (ease stays constant)
            const result = calculateNextReview(currentInterval, currentRepetition, currentEase, simDate);

            // Update our simulation state with the results
            currentInterval = result.nextInterval;
            currentRepetition = result.nextRepetition;
            currentEase = result.nextEaseFactor;

            const dueDate = new Date(result.nextReviewDate);

            // Stop if next review would be beyond our 90-day window
            if (dueDate > limitDate) break;

            schedule.push(dueDate.toISOString().split('T')[0]);

            // Move simulation forward to this review date
            simDate = dueDate;
        }
        return schedule;
    }

    /**
     * Analyze the full timeline of a problem: Past, Present, and Future.
     * 
     * @param {Object} problem - The problem object including history and nextReviewDate
     * @param {Date} now - Optional "Today" date (for consistency in testing)
     * @returns {Object} map of "YYYY-MM-DD" -> Status String
     * Statuses: 'completed', 'missed', 'due', 'scheduled'
     */
    function analyzeProblemTimeline(problem, now = new Date()) {
        const timeline = {};
        const todayStr = now.toLocaleDateString('en-CA');

        // 1. History & Replay (Past -> Present)
        const history = (problem.history || []).map(h => ({
            date: new Date(h.date),
            dateStr: new Date(h.date).toLocaleDateString('en-CA'),
            rating: h.rating || 3
        })).sort((a, b) => a.date - b.date);

        // Track "Done" dates to avoid overwriting with "Missed"
        const doneDates = new Set(history.map(h => h.dateStr));

        let replayInterval = 0;
        let replayRepetition = 0;
        let replayEase = 2.5;
        let expectedDueDate = null;

        history.forEach(entry => {
            // Mark Completed
            timeline[entry.dateStr] = 'completed';

            // Check for Procrastination Gap since LAST expected date
            if (expectedDueDate) {
                const dueStr = expectedDueDate.toLocaleDateString('en-CA');

                // If the actual review was mostly LATER than due date
                // (Using time comparison to be safe)
                if (entry.date > expectedDueDate && entry.dateStr !== dueStr) {
                    let curr = new Date(expectedDueDate);
                    while (curr < entry.date) {
                        const currStr = curr.toLocaleDateString('en-CA');
                        if (!doneDates.has(currStr)) {
                            timeline[currStr] = 'missed';
                        }
                        curr.setDate(curr.getDate() + 1);
                    }
                }
            }

            // Calculate NEXT step based on this history entry
            const next = calculateNextReview(replayInterval, replayRepetition, replayEase, entry.date);
            replayInterval = next.nextInterval;
            replayRepetition = next.nextRepetition;
            replayEase = next.nextEaseFactor;

            expectedDueDate = new Date(entry.date);
            expectedDueDate.setDate(expectedDueDate.getDate() + replayInterval);
            expectedDueDate.setHours(0, 0, 0, 0); // Normalize
        });

        // 2. Current Gap (Last History -> Today)
        // We use the STORED nextReviewDate as the definitive "Next Due" source
        // to avoid drift between replay calculation and stored state.
        const storedNextDue = new Date(problem.nextReviewDate);
        storedNextDue.setHours(0, 0, 0, 0);

        // If due date is in the past, mark gap until today as missed
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        if (storedNextDue < todayMidnight) {
            let curr = new Date(storedNextDue);
            while (curr < todayMidnight) {
                const currStr = curr.toLocaleDateString('en-CA');
                if (!doneDates.has(currStr)) {
                    timeline[currStr] = 'missed';
                }
                curr.setDate(curr.getDate() + 1);
            }
        }

        // 3. Status "Due Today"
        const nextDueStr = storedNextDue.toLocaleDateString('en-CA');
        if (nextDueStr === todayStr && storedNextDue <= todayMidnight) {
            // Only mark as due if it hasn't been done today
            if (!doneDates.has(todayStr)) {
                timeline[todayStr] = 'due';
            }
        }

        // 4. Future Projection
        // Start projection from the STORED state

        // First, mark the Next Review Date itself (if future)
        if (storedNextDue > todayMidnight) {
            timeline[nextDueStr] = 'scheduled';
        }

        // Generate subsequent future dates
        let simStartDate = (storedNextDue > todayMidnight) ? storedNextDue : todayMidnight;

        const futureDates = projectSchedule(
            problem.interval,
            problem.repetition,
            problem.easeFactor,
            simStartDate
        );

        futureDates.forEach(dateStr => {
            // Don't overwrite existing history/due status
            if (!timeline[dateStr]) {
                timeline[dateStr] = 'scheduled';
            }
        });

        return timeline;
    }

    /**
     * CLOSURE & MODULE PATTERN:
     * 
     * By returning an object with our functions, we create a "module".
     * Only functions listed here are accessible from outside.
     * Any variables defined inside the factory function but not returned
     * would be "private" (not accessible from outside).
     * 
     * This is a common pattern for organizing code before ES6 modules existed.
     */
    return {
        calculateNextReview,
        projectSchedule,
        analyzeProblemTimeline
    };
}));
