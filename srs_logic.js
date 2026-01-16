// Shared SRS Logic
// Universal Module Definition (UMD) pattern to support both Node.js (Jest) and Browser

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js / CommonJS
        module.exports = factory();
    } else {
        // Browser globals
        const exported = factory();
        for (const key in exported) {
            root[key] = exported[key];
        }
    }
}(typeof self !== 'undefined' ? self : this, function () {

    function calculateNextReview(interval = 0, repetition = 0, easeFactor = 2.5, currentDate = null) {
        let nextInterval;
        if (repetition === 0) {
            nextInterval = 1;
        } else if (repetition === 1) {
            nextInterval = 6;
        } else {
            nextInterval = Math.round(interval * easeFactor);
        }

        const nextDate = currentDate ? new Date(currentDate) : new Date();
        nextDate.setDate(nextDate.getDate() + nextInterval);

        return {
            nextInterval,
            nextRepetition: repetition + 1,
            nextEaseFactor: easeFactor,
            nextReviewDate: nextDate.toISOString()
        };
    }

    function projectSchedule(interval, repetition, easeFactor, currentDate) {
        const schedule = [];
        let currentInterval = interval;
        let currentRepetition = repetition;
        let currentEase = easeFactor;

        // Start simulation from the given date (or now)
        let simDate = currentDate ? new Date(currentDate) : new Date();

        // Simulate for ~90 days
        const limitDate = new Date(simDate);
        limitDate.setDate(limitDate.getDate() + 90);

        while (simDate < limitDate) {
            // Assume user rates "Medium" (ease stays roughly same, interval grows)
            // Note: We use the logic directly here to simulate the *next* step after a review
            const result = calculateNextReview(currentInterval, currentRepetition, currentEase, simDate);

            currentInterval = result.nextInterval;
            currentRepetition = result.nextRepetition;
            currentEase = result.nextEaseFactor;

            // The result.nextReviewDate is the date due.
            const dueDate = new Date(result.nextReviewDate);

            if (dueDate > limitDate) break;

            schedule.push(dueDate.toISOString().split('T')[0]); // YYYY-MM-DD

            // Advance simulation time to that due date
            simDate = dueDate;
        }
        return schedule;
    }

    return {
        calculateNextReview,
        projectSchedule
    };
}));
