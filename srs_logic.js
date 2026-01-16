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

    function calculateNextReview(interval = 0, repetition = 0, easeFactor = 2.5) {
        let nextInterval;
        if (repetition === 0) {
            nextInterval = 1;
        } else if (repetition === 1) {
            nextInterval = 6;
        } else {
            nextInterval = Math.round(interval * easeFactor);
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + nextInterval);

        return {
            nextInterval,
            nextRepetition: repetition + 1,
            nextEaseFactor: easeFactor,
            nextReviewDate: nextDate.toISOString()
        };
    }

    return {
        calculateNextReview
    };
}));
